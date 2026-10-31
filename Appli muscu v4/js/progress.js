'use strict';
const PROGRESS_GROUPS = [
  ['quadriceps', 'Quadriceps'], ['fessiers', 'Fessiers'], ['dos', 'Dos'],
  ['epaules', 'Épaules'], ['abdominaux', 'Abdominaux'], ['ischio-jambiers', 'Ischio-jambiers'],
  ['pectoraux', 'Pectoraux'], ['triceps', 'Triceps'], ['biceps', 'Biceps'],
  ['mollets', 'Mollets'], ['avant-bras', 'Avant-bras'], ['autres', 'Autres']
];
function readFavoriteUrls() {
  try {
    const saved = JSON.parse(localStorage.getItem('muscu.catalogue.favorites.v1') || '[]');
    return new Set(Array.isArray(saved) ? saved.filter(value => typeof value === 'string') : []);
  } catch (error) {
    console.error('Impossible de lire les favoris du catalogue.', error);
    return new Set();
  }
}
async function loadCatalogueRows() {
  const indexResponse = await fetch('catalogue/data/index-v2.json');
  if (!indexResponse.ok) throw new Error(`Index du catalogue indisponible (${indexResponse.status})`);
  const index = await indexResponse.json();
  if (!index || !Array.isArray(index.files) || !index.files.length || !index.files.every(file => /^[a-z-]+-\d{2}\.json$/.test(file))) {
    throw new Error('Index du catalogue invalide');
  }
  const results = await Promise.allSettled(index.files.map(async file => {
    const response = await fetch(`catalogue/data/${file}`);
    if (!response.ok) throw new Error(`Chargement de ${file} impossible (${response.status})`);
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error(`Format invalide pour ${file}`);
    return rows;
  }));
  const rows = [];
  const failures = [];
  results.forEach((result, resultIndex) => {
    if (result.status === 'fulfilled') rows.push(...result.value);
    else {
      failures.push(index.files[resultIndex]);
      console.error(`Impossible de charger la partie ${index.files[resultIndex]} du catalogue.`, result.reason);
    }
  });
  progressCatalogueWarning = failures.length > 0;
  if (!rows.length) throw new Error('Aucun exercice du catalogue n’a pu être chargé');
  return rows;
}
function parseProgressCatalogue(rows) {
  if (!Array.isArray(rows)) throw new Error('Format des exercices du catalogue invalide');
  const exercises = rows
    .filter(item => item && typeof item.name === 'string' && typeof item.url === 'string')
    .map(item => ({ name: item.name, url: item.url, image: typeof item.image === 'string' && /^https?:\/\//.test(item.image) ? item.image : '', groups: Array.isArray(item.groups) ? item.groups.filter(group => typeof group === 'string') : [] }));
  const byUrl = new Map(exercises.map(item => [item.url, item]));
  try {
    const custom = JSON.parse(localStorage.getItem('muscu.catalogue.custom-exercises.v1') || '[]');
    if (Array.isArray(custom)) custom.forEach(item => {
      if (item && typeof item.name === 'string' && typeof item.url === 'string' && Array.isArray(item.groups) && !byUrl.has(item.url)) {
        const exercise = { name: item.name, url: item.url, image: '', groups: item.groups.filter(group => typeof group === 'string') };
        byUrl.set(exercise.url, exercise);
        exercises.push(exercise);
      }
    });
  } catch (error) {
    console.error('Impossible de lire les exercices personnalisés du catalogue.', error);
  }
  S.exercises.forEach(item => {
    if (typeof item.catalogueUrl === 'string' && byUrl.has(item.catalogueUrl)) return;
    const url = typeof item.catalogueUrl === 'string' ? item.catalogueUrl : `manual:${item.id}`;
    if (!byUrl.has(url)) {
      const exercise = { name: item.name, url, image: typeof item.image === 'string' && /^https?:\/\//.test(item.image) ? item.image : '', groups: [] };
      byUrl.set(url, exercise);
      exercises.push(exercise);
    }
  });
  return exercises;
}
function loadProgressCatalogue() {
  if (progressCatalogueLoading) return;
  progressCatalogueLoading = true;
  progressCatalogueError = false;
  progressCatalogueWarning = false;
  loadCatalogueRows()
    .then(parseProgressCatalogue)
    .then(exercises => {
      progressCatalogue = exercises;
      progressCatalogueLoading = false;
      if (tab === 'prog' || tab === 'hist' || (tab === 'seance' && sessionCatalogueOpen) || (tab === 'plan' && planCatalogueOpen)) render();
    })
    .catch(error => {
      console.error('Impossible de charger le catalogue pour Données ou Progrès.', error);
      progressCatalogueLoading = false;
      progressCatalogueError = true;
      if (tab === 'prog' || tab === 'hist' || (tab === 'seance' && sessionCatalogueOpen) || (tab === 'plan' && planCatalogueOpen)) render();
    });
}
function refreshProgressExercises() {
  if (!progressCatalogue) return;
  const known = new Map(progressCatalogue.map(item => [item.url, item]));
  const add = (name, url, image, groups) => {
    if (known.has(url)) return;
    const exercise = { name, url, image, groups };
    known.set(url, exercise);
    progressCatalogue.push(exercise);
  };
  try {
    const custom = JSON.parse(localStorage.getItem('muscu.catalogue.custom-exercises.v1') || '[]');
    if (!Array.isArray(custom)) throw new Error('format');
    custom.forEach(item => {
      if (item && typeof item.name === 'string' && typeof item.url === 'string' && Array.isArray(item.groups) && item.groups.every(group => typeof group === 'string')) {
        add(item.name, item.url, '', item.groups);
      }
    });
  } catch (error) {
    console.error('Impossible d’actualiser les exercices personnalisés de Données.', error);
  }
  S.exercises.forEach(item => {
    if (typeof item.catalogueUrl === 'string' && known.has(item.catalogueUrl)) return;
    const url = typeof item.catalogueUrl === 'string' ? item.catalogueUrl : `manual:${item.id}`;
    add(item.name, url, typeof item.image === 'string' && /^https?:\/\//.test(item.image) ? item.image : '', []);
  });
}
function progressPlanExerciseUrls() {
  const urls = new Set(readPendingExercises().map(item => item.url));
  const templateExerciseIds = new Set(S.templates.flatMap(template => template.ex));
  S.exercises.forEach(item => {
    if (!templateExerciseIds.has(item.id)) return;
    urls.add(typeof item.catalogueUrl === 'string' ? item.catalogueUrl : `manual:${item.id}`);
  });
  return urls;
}
function progressCard(exercise) {
  const data = S.progress && S.progress[exercise.url] || { weight: '', reps: '' };
  const image = exercise.image ? `<img loading="lazy" src="${esc(exercise.image)}" alt="">` : '';
  return `<article class="card progress-card" data-progress-url="${esc(exercise.url)}" data-progress-name="${esc(exercise.name.toLocaleLowerCase('fr'))}" data-progress-groups="${esc(exercise.groups.join(' '))}">
    ${image}<div><span class="progress-card-name">${esc(exercise.name)}</span><div class="progress-fields">
      <div class="progress-field"><label for="progress-weight-${encodeURIComponent(exercise.url)}">Poids</label><input id="progress-weight-${encodeURIComponent(exercise.url)}" type="number" min="0" step="0.5" inputmode="decimal" data-progress-key="${esc(exercise.url)}" data-progress-field="weight" value="${esc(data.weight ?? '')}" aria-label="Poids en kilogrammes pour ${esc(exercise.name)}"></div>
      <div class="progress-field"><label for="progress-reps-${encodeURIComponent(exercise.url)}">Répétitions</label><input id="progress-reps-${encodeURIComponent(exercise.url)}" type="number" min="0" step="1" inputmode="numeric" data-progress-key="${esc(exercise.url)}" data-progress-field="reps" value="${esc(data.reps ?? '')}" aria-label="Nombre de répétitions pour ${esc(exercise.name)}"></div>
    </div></div></article>`;
}
function progressControls(exercises) {
  const layout = S.progressLayout === 'list' ? 'list' : 'mosaic';
  return `<div class="progress-controls">
    <div class="progress-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"></circle><path d="m16 16 4.2 4.2"></path></svg><input type="search" data-progress-search placeholder="Rechercher un exercice…" value="${esc(progressQuery)}" aria-label="Rechercher un exercice"></div>
    <select data-ch="progressGroup" aria-label="Filtrer par groupe musculaire ou présence dans Plan"><option value="">Tous les groupes</option><option value="plan" ${progressGroup === 'plan' ? 'selected' : ''}>Dans Plan</option>${PROGRESS_GROUPS.map(([value, name]) => `<option value="${value}" ${progressGroup === value ? 'selected' : ''}>${name}</option>`).join('')}</select>
    <div class="progress-layout"><button class="btn sm ${layout === 'mosaic' ? 'acc' : ''}" data-act="progressLayout" data-layout="mosaic" aria-pressed="${layout === 'mosaic'}">Mosaïque</button><button class="btn sm ${layout === 'list' ? 'acc' : ''}" data-act="progressLayout" data-layout="list" aria-pressed="${layout === 'list'}">Liste</button></div>
    <span class="mut sm progress-count" data-progress-count>${exercises.length} exercice${exercises.length > 1 ? 's' : ''}</span>
  </div>`;
}
function vProg() {
  if (!progressCatalogue) {
    if (progressCatalogueError) return '<h1>Données</h1><div class="card">Le catalogue n’a pas pu être chargé. Vérifie ta connexion puis réessaie.<button class="btn" data-act="retryProgressCatalogue">Réessayer</button></div>';
    return '<h1>Données</h1><div class="card mut">Chargement du catalogue…</div>';
  }
  refreshProgressExercises();
  const query = progressQuery.trim().toLocaleLowerCase('fr');
  const planUrls = progressPlanExerciseUrls();
  const exercises = progressCatalogue.filter(item =>
    (progressGroup === 'plan' ? planUrls.has(item.url) : (!progressGroup || item.groups.includes(progressGroup)))
    && (!query || item.name.toLocaleLowerCase('fr').includes(query) || item.groups.join(' ').includes(query))
  );
  const layout = S.progressLayout === 'list' ? 'list' : 'mosaic';
  const warning = progressCatalogueWarning ? '<div class="banner">Le catalogue est partiel : certaines catégories n’ont pas pu être chargées.</div>' : '';
  return `<h1>Données</h1>${warning}${progressControls(exercises)}${exercises.length
    ? `<div class="progress-grid" id="progress-grid" data-layout="${layout}">${exercises.map(progressCard).join('')}</div>`
    : '<div class="card mut">Aucun exercice correspondant.</div>'}`;
}
