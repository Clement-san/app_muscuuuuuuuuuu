'use strict';
function vPlan() {
  const pending = readPendingExercises();
  const pendingLayout = readPendingLayout();
  let h = '<h1>Plan</h1><div class="hd"><h2 style="margin-top:0">Exercices en attente</h2><div class="pending-modes">'
    + `<button class="btn sm ${pendingLayout === 'mosaic' ? 'acc' : ''}" data-act="pendingLayout" data-layout="mosaic" aria-pressed="${pendingLayout === 'mosaic'}">Mosaïque</button>`
    + `<button class="btn sm ${pendingLayout === 'list' ? 'acc' : ''}" data-act="pendingLayout" data-layout="list" aria-pressed="${pendingLayout === 'list'}">Liste</button></div></div>`;
  h += pending.length
    ? `<div class="pending-grid" data-layout="${pendingLayout}">${pending.map(item => `<div class="pending-item"><button type="button" class="pending-select ${selectedPendingUrl === item.url ? 'is-selected' : ''}" data-pending-select="${esc(item.url)}" draggable="true" aria-pressed="${selectedPendingUrl === item.url}" aria-label="Sélectionner ou glisser ${esc(item.name)} vers une séance type">${item.image ? `<img src="${esc(item.image)}" alt="">` : ''}<span class="pending-name">${esc(item.name)}</span></button><button class="ic pending-remove" data-act="removePending" data-id="${esc(item.url)}" aria-label="Retirer ${esc(item.name)} des exercices en attente">${icon('close')}</button></div>`).join('')}</div>`
    : '<div class="card mut sm">Aucun exercice en attente. Ajoute-en depuis le Catalogue.</div>';
  h += `<div class="plan-catalogue-heading"><div><h2>Séances types</h2><p class="mut sm">Ajoute des exercices depuis le catalogue ou depuis ta liste d’attente.</p></div><button class="btn sm" data-act="${planCatalogueOpen ? 'closePlanCatalogue' : 'openPlanCatalogue'}">${planCatalogueOpen ? 'Fermer le catalogue' : 'Choisir dans le catalogue'}</button></div>`;
  if (planCatalogueOpen) h += planCataloguePicker();
  h += S.templates.map(t => `<div class="card template-dropzone" data-template-drop="${t.id}"><div class="hd"><b>${esc(t.name)}</b>
    <span><button class="ic" data-act="renTpl" data-id="${t.id}" aria-label="Renommer la séance type">${icon('edit')}</button><button class="ic" data-act="delTpl" data-id="${t.id}" aria-label="Supprimer la séance type">${icon('trash')}</button></span></div>
    ${t.ex.map((id, k) => {
      const exercise = S.exercises.find(item => item.id === id);
      const exerciseImage = exercise && (exercise.image || pending.find(item => item.url === exercise.catalogueUrl)?.image);
      const progressKey = exercise && (typeof exercise.catalogueUrl === 'string' ? exercise.catalogueUrl : `manual:${exercise.id}`);
      const metrics = progressKey && S.progress && S.progress[progressKey] || {};
      const weight = metrics.weight === '' || metrics.weight == null ? '—' : `${esc(metrics.weight)} kg`;
      const reps = metrics.reps === '' || metrics.reps == null ? '—' : esc(metrics.reps);
      return `<div class="template-exercise-row"><span class="template-exercise">${exerciseImage ? `<img src="${esc(exerciseImage)}" alt="">` : ''}<span class="template-exercise-info"><span>${esc(exName(id))}</span><span class="template-exercise-metrics">Poids : ${weight} · Répétitions : ${reps}</span></span></span><span class="template-exercise-controls">
      <button class="ic" data-act="tplUp" data-id="${t.id}" data-k="${k}" aria-label="Monter l’exercice">${icon('up')}</button><button class="ic" data-act="tplDown" data-id="${t.id}" data-k="${k}" aria-label="Descendre l’exercice">${icon('down')}</button>
      <button class="ic" data-act="tplRm" data-id="${t.id}" data-k="${k}" aria-label="Retirer l’exercice">${icon('close')}</button></span></div>`;
    }).join('')}
    ${t.ex.length ? '' : '<div class="mut sm" style="margin-top:8px">Dépose ici un exercice en attente.</div>'}</div>`).join('');
  return h + '<button class="btn" data-act="addTpl">+ Nouvelle séance type</button>';
}
function planCataloguePicker() {
  if (!progressCatalogue) {
    if (progressCatalogueError) return '<div class="session-catalogue-picker"><p role="alert">Le catalogue n’a pas pu être chargé.</p><button class="btn sm" data-act="retryPlanCatalogue">Réessayer</button></div>';
    return '<div class="session-catalogue-picker mut sm" role="status">Chargement du catalogue…</div>';
  }
  const templateId = S.templates.some(template => template.id === planCatalogueTemplateId)
    ? planCatalogueTemplateId : (S.templates[0]?.id || '');
  const favorites = readFavoriteUrls();
  const exercises = progressCatalogue.filter(item =>
    (!planCatalogueFavoritesOnly || favorites.has(item.url))
    && (!planCatalogueGroup || item.groups.includes(planCatalogueGroup))
    && (!planCatalogueQuery.trim() || item.name.toLocaleLowerCase('fr').includes(planCatalogueQuery.trim().toLocaleLowerCase('fr'))
      || item.groups.join(' ').toLocaleLowerCase('fr').includes(planCatalogueQuery.trim().toLocaleLowerCase('fr')))
  );
  const shown = exercises.slice(0, 40);
  return `<div class="session-catalogue-picker plan-catalogue-picker">
    <div class="session-catalogue-controls">
      <input class="in session-catalogue-search" type="search" data-plan-catalogue-search placeholder="Rechercher un exercice…" value="${esc(planCatalogueQuery)}" aria-label="Rechercher un exercice du catalogue">
      <select data-ch="planCatalogueGroup" aria-label="Filtrer par groupe musculaire"><option value="">Tous les groupes</option>${PROGRESS_GROUPS.map(([value, name]) => `<option value="${value}" ${planCatalogueGroup === value ? 'selected' : ''}>${name}</option>`).join('')}</select>
      <select data-ch="planCatalogueTemplate" aria-label="Séance type de destination" ${S.templates.length ? '' : 'disabled'}>${S.templates.length
        ? S.templates.map(template => `<option value="${esc(template.id)}" ${template.id === templateId ? 'selected' : ''}>Ajouter à ${esc(template.name)}</option>`).join('')
        : '<option value="">Crée une séance type avant d’ajouter</option>'}</select>
      <button class="btn sm session-favorites-toggle" data-act="togglePlanFavorites" aria-pressed="${planCatalogueFavoritesOnly}" ${favorites.size ? '' : 'disabled'}>♥ Favoris${favorites.size ? ` · ${favorites.size}` : ''}</button>
      <span class="mut sm session-catalogue-count" data-plan-catalogue-count>${exercises.length > shown.length ? `40 premiers sur ${exercises.length} exercices` : `${exercises.length} exercice${exercises.length > 1 ? 's' : ''}`}</span>
    </div>
    <div class="session-catalogue-results" data-plan-catalogue-results>${shown.length
      ? shown.map(item => `<div class="plan-catalogue-result"><span>${item.image ? `<img src="${esc(item.image)}" alt="">` : ''}<b>${esc(item.name)}</b></span><button class="btn sm acc" data-act="addPlanCatalogueExercise" data-catalogue-url="${esc(item.url)}" ${templateId ? '' : 'disabled'}>Ajouter</button></div>`).join('')
      : '<p class="mut sm">Aucun exercice correspondant.</p>'}</div>
    ${progressCatalogueWarning ? '<p class="banner">Le catalogue est partiel : certaines catégories n’ont pas pu être chargées.</p>' : ''}
  </div>`;
}
function updatePlanCatalogueResults() {
  const container = $('[data-plan-catalogue-results]');
  const count = $('[data-plan-catalogue-count]');
  if (!container || !progressCatalogue) return;
  const query = planCatalogueQuery.trim().toLocaleLowerCase('fr');
  const favorites = readFavoriteUrls();
  const exercises = progressCatalogue.filter(item =>
    (!planCatalogueFavoritesOnly || favorites.has(item.url))
    && (!planCatalogueGroup || item.groups.includes(planCatalogueGroup))
    && (!query || item.name.toLocaleLowerCase('fr').includes(query) || item.groups.join(' ').toLocaleLowerCase('fr').includes(query))
  );
  const templateId = S.templates.some(template => template.id === planCatalogueTemplateId)
    ? planCatalogueTemplateId : (S.templates[0]?.id || '');
  const favoriteToggle = $('.plan-catalogue-picker .session-favorites-toggle');
  if (favoriteToggle) favoriteToggle.setAttribute('aria-pressed', String(planCatalogueFavoritesOnly));
  const shown = exercises.slice(0, 40);
  container.innerHTML = shown.length
    ? shown.map(item => `<div class="plan-catalogue-result"><span>${item.image ? `<img src="${esc(item.image)}" alt="">` : ''}<b>${esc(item.name)}</b></span><button class="btn sm acc" data-act="addPlanCatalogueExercise" data-catalogue-url="${esc(item.url)}" ${templateId ? '' : 'disabled'}>Ajouter</button></div>`).join('')
    : '<p class="mut sm">Aucun exercice correspondant.</p>';
  if (count) count.textContent = exercises.length > shown.length
    ? `40 premiers sur ${exercises.length} exercices`
    : `${exercises.length} exercice${exercises.length > 1 ? 's' : ''}`;
}
function readPendingExercises() {
  try {
    const stored = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
    if (!Array.isArray(stored)) throw new Error('format');
    return stored.filter(item => item && typeof item.url === 'string' && typeof item.name === 'string' && Array.isArray(item.groups))
      .map(item => ({ url: item.url, name: item.name, groups: item.groups.filter(group => typeof group === 'string'), image: typeof item.image === 'string' && /^https?:\/\//.test(item.image) ? item.image : '' }));
  } catch (error) {
    console.error('Impossible de lire les exercices en attente.', error);
    toast('Lecture des exercices en attente impossible');
    return [];
  }
}
function readPendingLayout() {
  try {
    return localStorage.getItem(PENDING_LAYOUT_KEY) === 'list' ? 'list' : 'mosaic';
  } catch (error) {
    console.error('Impossible de lire le mode des exercices en attente.', error);
    toast('Lecture du mode d’affichage impossible');
    return 'mosaic';
  }
}
function addPendingToTemplate(url, templateId) {
  const pending = readPendingExercises().find(item => item.url === url);
  const template = S.templates.find(item => item.id === templateId);
  if (!pending || !template) return;
  let exercise = S.exercises.find(item => item.catalogueUrl === pending.url);
  if (!exercise) {
    exercise = { id: uid(), name: pending.name, catalogueUrl: pending.url, image: pending.image };
    S.exercises.push(exercise);
  }
  const alreadyAdded = template.ex.includes(exercise.id);
  if (!alreadyAdded) {
    template.ex.push(exercise.id);
    save();
  }
  try {
    const remaining = readPendingExercises().filter(item => item.url !== pending.url);
    localStorage.setItem(PENDING_KEY, JSON.stringify(remaining));
  } catch (error) {
    console.error('Impossible de retirer l’exercice ajouté de la liste d’attente.', error);
    toast('Exercice ajouté, mais toujours présent dans la liste d’attente');
    selectedPendingUrl = null;
    render();
    return;
  }
  selectedPendingUrl = null;
  toast(alreadyAdded ? 'Exercice retiré de la liste d’attente' : `${pending.name} ajouté à ${template.name}`);
  render();
}
function vCatalogue() {
  return '<iframe class="catalogue-frame" src="catalogue-exercices-musculation.html" title="Catalogue des exercices de musculation"></iframe>';
}
function vReg() {
  const s = S.settings, ex = S.lastExport ? new Date(S.lastExport).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : 'jamais';
  const automaticBackups = readAutomaticBackups();
  const defaultSets = defaultSetCount();
  const toggle = (key, title, description) => `<label class="settings-toggle">
    <span class="settings-toggle-copy"><b>${title}</b><span>${description}</span></span>
    <input type="checkbox" data-ch="set" data-k="${key}" ${s[key] ? 'checked' : ''}>
    <span class="settings-switch" aria-hidden="true"></span>
  </label>`;
  return `<header class="settings-header">
    <span class="settings-eyebrow">PERSONNALISATION</span>
    <h1>Réglages</h1>
    <p>Un entraînement à ton rythme, jusque dans les détails.</p>
  </header>
  <section class="settings-section" aria-labelledby="settings-workout-title">
    <div class="settings-section-heading"><span class="settings-icon">${icon('grip')}</span><div><h2 id="settings-workout-title">Réglages de séance</h2><p>Prépare tes exercices comme tu les aimes.</p></div></div>
    <div class="settings-card">
      <label class="settings-duration">
        <span><b>Séries par défaut</b><small>Pour chaque nouvel exercice ajouté</small></span>
        <span class="settings-duration-input"><input class="in" type="number" min="1" max="12" step="1" inputmode="numeric" data-ch="set" data-k="sets" value="${defaultSets}" aria-label="Nombre de séries par défaut"><span>séries</span></span>
      </label>
    </div>
  </section>
  <section class="settings-section" aria-labelledby="settings-timers-title">
    <div class="settings-section-heading"><span class="settings-icon">${icon('timer')}</span><div><h2 id="settings-timers-title">Minuteurs</h2><p>Configure tes temps de récupération.</p></div></div>
    <div class="settings-card">
      <label class="settings-duration">
        <span><b>Repos entre les séries</b><small>Même durée pour tous les exercices</small></span>
        <span class="settings-duration-input"><input class="in" type="number" min="5" step="1" inputmode="numeric" data-ch="set" data-k="rest" value="${s.rest}" aria-label="Temps de repos par défaut en secondes"><span>sec</span></span>
      </label>
      <div class="settings-divider"></div>
      <label class="settings-duration">
        <span><b>Cycle EMOM</b><small>Durée de chaque intervalle</small></span>
        <span class="settings-duration-input"><input class="in" type="number" min="5" step="1" inputmode="numeric" data-ch="set" data-k="emom" value="${s.emom}" aria-label="Durée d’un cycle EMOM en secondes"><span>sec</span></span>
      </label>
      <p class="settings-hint">Tu peux aussi ajuster le compte à rebours EMOM de ±10 secondes pendant l’exercice.</p>
    </div>
  </section>
  <section class="settings-section" aria-labelledby="settings-alerts-title">
    <div class="settings-section-heading"><span class="settings-icon">${icon('check')}</span><div><h2 id="settings-alerts-title">Rappels &amp; sons</h2><p>Choisis comment suivre tes séries.</p></div></div>
    <div class="settings-card settings-options">
      ${toggle('auto', 'Lancer le repos automatiquement', 'Après validation de chaque série')}
      ${toggle('sound', 'Signal sonore', 'À la fin du compte à rebours')}
      ${toggle('vibrate', 'Vibration', 'Selon la compatibilité de ton appareil')}
      ${toggle('visualAlert', 'Alerte visuelle discrète', 'Afficher la fin du repos pendant quelques secondes')}
      <button class="btn settings-test" data-act="testSound">${icon('timer')} Tester le son</button>
    </div>
  </section>
  <section class="settings-section" aria-labelledby="settings-backup-title">
    <div class="settings-section-heading"><span class="settings-icon">${icon('edit')}</span><div><h2 id="settings-backup-title">Tes données</h2><p>Une copie de sauvegarde, à tout moment.</p></div></div>
    <div class="settings-card settings-backup">
      <div class="settings-backup-status"><span class="settings-status-dot"></span><span>Dernière exportation : <b>${esc(ex)}</b></span></div>
      <p class="settings-hint">Tes données restent sur cet appareil. Pense à les exporter régulièrement.</p>
      <div class="automatic-backups">
        <div class="automatic-backups-heading"><b>Sauvegardes automatiques</b><span>${automaticBackups.length}/3 · tout l’historique, les exercices et les réglages</span></div>
        ${automaticBackups.length ? automaticBackups.map(backup => `<div class="automatic-backup-row">
          <span><b>${esc(backup.sessionName || 'Séance')}</b><small>${esc(new Date(backup.createdAt).toLocaleString('fr-FR'))}</small></span>
          <button class="btn sm" data-act="restoreAutomaticBackup" data-id="${esc(backup.id)}">Restaurer</button>
        </div>`).join('') : '<p class="settings-hint">Une copie complète sera créée ici après ta prochaine séance terminée. Les trois plus récentes seront conservées sur cet appareil.</p>'}
      </div>
      <div class="auto-file-export">
        <div><b>Copie automatique vers Fichiers</b><span id="auto-export-status">Vérification du mode d’export…</span></div>
        <div class="auto-file-export-actions">
          <button class="btn sm" data-act="configureAutoExportDirectory" ${typeof window.showDirectoryPicker === 'function' ? '' : 'hidden'}>Choisir un dossier</button>
          <button class="btn sm" data-act="clearAutoExportDirectory" hidden>Retirer le dossier</button>
        </div>
      </div>
      <label class="settings-reminder"><span><b>Rappel de sauvegarde</b><small>Afficher un rappel sur l’écran Séance</small></span>
        <select data-ch="backupReminder" aria-label="Fréquence du rappel de sauvegarde">
          <option value="weekly" ${s.backupReminder === 'weekly' ? 'selected' : ''}>Chaque semaine</option>
          <option value="monthly" ${s.backupReminder === 'monthly' ? 'selected' : ''}>Chaque mois</option>
          <option value="off" ${s.backupReminder === 'off' ? 'selected' : ''}>Désactivé</option>
        </select>
      </label>
      <div class="settings-backup-actions">
        <button class="btn acc" data-act="export">Exporter mes données</button>
        <button class="btn" data-act="import">Importer une sauvegarde</button>
      </div>
      <input type="file" id="file" accept="application/json,.json" hidden>
    </div>
  </section>
  <section class="settings-danger">
    <div><b>Effacer toutes les données</b><span>Cette action est irréversible.</span></div>
    <button class="btn danger" data-act="reset">Effacer</button>
  </section>
  <p class="settings-footer">Muscu v1 <span>·</span> 100 % local, aucune collecte</p>`;
}
const views = { seance: vSeance, hist: vHist, plan: vPlan, catalogue: vCatalogue, prog: vProg, reg: vReg };

function render() {
  const y = window.scrollY;
  $('#main').innerHTML = views[tab]();
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  window.scrollTo(0, y);
  tick();
  if (tab === 'reg') refreshAutoExportStatus();
  if ((tab === 'prog' || tab === 'hist') && !progressCatalogue && !progressCatalogueLoading && !progressCatalogueError) loadProgressCatalogue();
}
