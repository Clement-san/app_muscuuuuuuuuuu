'use strict';
/* ============ Événements (délégation) ============ */
document.addEventListener('click', ev => {
  unlockAudio();
  const tb = ev.target.closest('[data-tab]');
  if (tb) { syncInputs(); save(); tab = tb.dataset.tab; render(); window.scrollTo(0, 0); return; }
  const progressExercise = ev.target.closest('[data-progress-exercise]');
  if (progressExercise) {
    const url = progressExercise.dataset.progressExercise;
    expandedProgressExercise = expandedProgressExercise === url ? null : url;
    render();
    return;
  }
  const b = ev.target.closest('[data-act]');
  if (b) { act(b.dataset.act, b.dataset); return; }
  const pending = ev.target.closest('[data-pending-select]');
  if (pending) {
    selectedPendingUrl = selectedPendingUrl === pending.dataset.pendingSelect ? null : pending.dataset.pendingSelect;
    if (selectedPendingUrl) toast('Exercice sélectionné : touche une séance type');
    render();
    return;
  }
  const template = ev.target.closest('[data-template-drop]');
  if (template && selectedPendingUrl) addPendingToTemplate(selectedPendingUrl, template.dataset.templateDrop);
});
document.addEventListener('keydown', ev => {
  const input = ev.target;
  if (!input.matches?.('input[data-f]') || ev.key !== 'Enter' || !S.current) return;
  ev.preventDefault();
  const itemIndex = +input.dataset.ei, setIndex = +input.dataset.si;
  if (input.dataset.f === 'w') {
    $(`input[data-f="r"][data-ei="${itemIndex}"][data-si="${setIndex}"]`)?.focus();
    return;
  }
  const item = S.current.items[itemIndex], set = item && item.sets[setIndex];
  if (!set) return;
  const wasDone = set.done;
  act('done', { ei: String(itemIndex), si: String(setIndex) });
  if (!wasDone && set.done) {
    $(`input[data-f="w"][data-ei="${itemIndex}"][data-si="${setIndex + 1}"]`)?.focus();
  }
});
document.addEventListener('dragstart', ev => {
  const pending = ev.target.closest('[data-pending-select]');
  if (!pending || !ev.dataTransfer) return;
  ev.dataTransfer.setData('text/plain', pending.dataset.pendingSelect);
  ev.dataTransfer.effectAllowed = 'copy';
  selectedPendingUrl = pending.dataset.pendingSelect;
});
document.addEventListener('dragover', ev => {
  const template = ev.target.closest('[data-template-drop]');
  if (!template || !ev.dataTransfer) return;
  ev.preventDefault();
  ev.dataTransfer.dropEffect = 'copy';
  template.classList.add('is-drop-target');
});
document.addEventListener('dragleave', ev => {
  const template = ev.target.closest('[data-template-drop]');
  if (template && !template.contains(ev.relatedTarget)) template.classList.remove('is-drop-target');
});
document.addEventListener('drop', ev => {
  const template = ev.target.closest('[data-template-drop]');
  if (!template) return;
  ev.preventDefault();
  template.classList.remove('is-drop-target');
  const url = ev.dataTransfer && ev.dataTransfer.getData('text/plain');
  if (url) addPendingToTemplate(url, template.dataset.templateDrop);
});
let sessionReorder = null;
const searchTimers = new WeakMap();
function debounceSearch(input, update) {
  // Évite de reconstruire les résultats à chaque caractère.
  clearTimeout(searchTimers.get(input));
  searchTimers.set(input, setTimeout(() => {
    searchTimers.delete(input);
    update();
  }, 150));
}
function clearSessionReorder() {
  document.querySelectorAll('.is-reordering,.is-reorder-target').forEach(card => card.classList.remove('is-reordering', 'is-reorder-target'));
  document.body.classList.remove('reordering');
  sessionReorder = null;
}
document.addEventListener('pointerdown', ev => {
  const handle = ev.target.closest('[data-reorder-handle]');
  const card = handle && handle.closest('[data-session-index]');
  if (!card || !S.current || !ev.isPrimary) return;
  ev.preventDefault();
  syncInputs();
  sessionReorder = { pointerId: ev.pointerId, from: +card.dataset.sessionIndex, to: +card.dataset.sessionIndex, startX: ev.clientX, startY: ev.clientY, started: false, card };
});
document.addEventListener('pointermove', ev => {
  if (!sessionReorder || ev.pointerId !== sessionReorder.pointerId) return;
  if (!sessionReorder.started && Math.hypot(ev.clientX - sessionReorder.startX, ev.clientY - sessionReorder.startY) < 6) return;
  ev.preventDefault();
  if (!sessionReorder.started) {
    sessionReorder.started = true;
    sessionReorder.card.classList.add('is-reordering');
    document.body.classList.add('reordering');
  }
  const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-session-index]');
  document.querySelectorAll('.is-reorder-target').forEach(card => card.classList.remove('is-reorder-target'));
  if (target) {
    target.classList.add('is-reorder-target');
    sessionReorder.to = +target.dataset.sessionIndex;
  }
});
document.addEventListener('pointerup', ev => {
  if (!sessionReorder || ev.pointerId !== sessionReorder.pointerId) return;
  const { from, to, started } = sessionReorder;
  clearSessionReorder();
  if (!started || !S.current || from === to || !S.current.items[from] || !S.current.items[to]) return;
  const [item] = S.current.items.splice(from, 1);
  S.current.items.splice(to, 0, item);
  save();
  render();
});
document.addEventListener('pointercancel', ev => {
  if (sessionReorder && ev.pointerId === sessionReorder.pointerId) clearSessionReorder();
});
document.addEventListener('change', ev => {
  const t = ev.target;
  if (t.dataset.f && S.current) { // saisie kg / reps d'une série
    const s = S.current.items[+t.dataset.ei].sets[+t.dataset.si]; s[t.dataset.f] = num(t.value); save(); return;
  }
  if (t.id === 'file') { if (t.files[0]) importData(t.files[0]); t.value = ''; return; }
  if (t.dataset.sessionMeta && t.dataset.sessionId) {
    const session = S.sessions.find(item => item.id === t.dataset.sessionId);
    if (!session) return;
    if (t.dataset.sessionMeta === 'date') {
      const date = new Date(t.value);
      if (!t.value || !Number.isFinite(date.getTime())) { toast('Date invalide : modification ignorée'); return; }
      session.date = date.toISOString();
    } else if (t.dataset.sessionMeta === 'dur') {
      const duration = Number(t.value);
      if (!Number.isInteger(duration) || duration < 1 || duration > 1440) { toast('La durée doit être comprise entre 1 et 1440 minutes'); return; }
      session.dur = duration;
    }
    save();
    return;
  }
  switch (t.dataset.ch) {
    case 'progEx': progEx = t.value; render(); break;
    case 'progressGroup': progressGroup = t.value; render(); break;
    case 'sessionCatalogueGroup': sessionCatalogueGroup = t.value; render(); break;
    case 'planCatalogueGroup': planCatalogueGroup = t.value; updatePlanCatalogueResults(); break;
    case 'planCatalogueTemplate': planCatalogueTemplateId = t.value; updatePlanCatalogueResults(); break;
    case 'backupReminder':
      if (['weekly', 'monthly', 'off'].includes(t.value)) S.settings.backupReminder = t.value;
      save(); render(); break;
    case 'set': {
      const k = t.dataset.k;
      if (k === 'rest') S.settings.rest = Math.max(5, num(t.value) || 90);
      else if (k === 'emom') S.settings.emom = Math.max(5, num(t.value) || 60);
      else if (k === 'sets') {
        const count = num(t.value);
        S.settings.sets = count === '' ? 4 : Math.max(1, Math.min(12, Math.round(count)));
      }
      else S.settings[k] = t.checked;
      save(); render(); break;
    }
  }
});
function filterProgressCards() {
  const query = progressQuery.trim().toLocaleLowerCase('fr');
  const planUrls = progressGroup === 'plan' ? progressPlanExerciseUrls() : null;
  let visible = 0;
  document.querySelectorAll('#progress-grid [data-progress-url]').forEach(card => {
    const matches = (!query || card.dataset.progressName.includes(query) || card.dataset.progressGroups.includes(query))
      && (progressGroup === 'plan' ? planUrls.has(card.dataset.progressUrl) : (!progressGroup || card.dataset.progressGroups.split(' ').includes(progressGroup)));
    card.hidden = !matches;
    if (matches) visible++;
  });
  document.querySelectorAll('#progress-grid .history-mosaic-row').forEach(row => {
    const cards = [...row.querySelectorAll('[data-progress-url]')];
    row.hidden = cards.every(card => card.hidden);
    const details = row.querySelector('[data-progress-details]');
    if (details) details.hidden = cards.find(card => card.dataset.progressUrl === details.dataset.progressDetails)?.hidden ?? true;
  });
  document.querySelectorAll('#progress-grid > [data-progress-details]').forEach(details => {
    const card = [...document.querySelectorAll('#progress-grid [data-progress-url]')]
      .find(item => item.dataset.progressUrl === details.dataset.progressDetails);
    details.hidden = card?.hidden ?? true;
  });
  const count = $('[data-progress-count]');
  if (count) count.textContent = `${visible} exercice${visible > 1 ? 's' : ''}`;
}
document.addEventListener('input', ev => {
  const t = ev.target;
  if (t.dataset.planCatalogueSearch !== undefined) {
    planCatalogueQuery = t.value;
    debounceSearch(t, updatePlanCatalogueResults);
    return;
  }
  if (t.dataset.f && S.current) {
    const item = S.current.items[+t.dataset.ei];
    const set = item && item.sets[+t.dataset.si];
    if (set) { set[t.dataset.f] = num(t.value); save(); }
    return;
  }
  if (t.dataset.sessionMeta === 'name' && t.dataset.sessionId) {
    const session = S.sessions.find(item => item.id === t.dataset.sessionId);
    if (session) { session.name = t.value.slice(0, 80); save(); }
    return;
  }
  if (t.dataset.sessionField && t.dataset.sessionId) {
    const session = S.sessions.find(item => item.id === t.dataset.sessionId);
    const item = session?.items[+t.dataset.itemIndex];
    if (t.dataset.sessionField === 'name') {
      if (item) { item.n = t.value.slice(0, 100); save(); }
      return;
    }
    const set = item?.sets[+t.dataset.setIndex];
    if (set && ['w', 'r'].includes(t.dataset.sessionField)) { set[t.dataset.sessionField] = num(t.value); save(); }
    return;
  }
  if (t.dataset.sessionCatalogueSearch !== undefined) {
    sessionCatalogueQuery = t.value;
    debounceSearch(t, updateSessionCatalogueResults);
    return;
  }
  if (t.dataset.progressSearch !== undefined) {
    progressQuery = t.value;
    debounceSearch(t, filterProgressCards);
    return;
  }
  if (t.dataset.progressField && t.dataset.progressKey) {
    if (!S.progress || typeof S.progress !== 'object') S.progress = {};
    if (!S.progress[t.dataset.progressKey]) S.progress[t.dataset.progressKey] = { weight: '', reps: '' };
    S.progress[t.dataset.progressKey][t.dataset.progressField] = t.value;
    save();
  }
});
function updateSessionCatalogueResults() {
  const container = $('[data-session-catalogue-results]');
  const count = $('[data-session-catalogue-count]');
  if (!container || !progressCatalogue || !S.current) return;
  const query = sessionCatalogueQuery.trim().toLocaleLowerCase('fr');
  const favorites = readFavoriteUrls();
  const exercises = progressCatalogue.filter(item => {
    const alreadyAdded = S.exercises.some(exercise => exercise.catalogueUrl === item.url && S.current.items.some(sessionItem => sessionItem.ex === exercise.id));
    return !alreadyAdded
      && (!sessionCatalogueFavoritesOnly || favorites.has(item.url))
      && (!sessionCatalogueGroup || item.groups.includes(sessionCatalogueGroup))
      && (!query || item.name.toLocaleLowerCase('fr').includes(query) || item.groups.join(' ').includes(query));
  });
  const shown = exercises.slice(0, 40);
  container.innerHTML = shown.length
    ? shown.map(item => `<button class="session-catalogue-item" data-act="addCatalogueExercise" data-catalogue-url="${esc(item.url)}">${item.image ? `<img src="${esc(item.image)}" alt="">` : ''}<span>${esc(item.name)}</span></button>`).join('')
    : '<p class="mut sm">Aucun exercice correspondant.</p>';
  if (count) count.textContent = exercises.length > shown.length
    ? `40 premiers sur ${exercises.length} exercices`
    : `${exercises.length} exercice${exercises.length > 1 ? 's' : ''}`;
}
window.addEventListener('storage', ev => {
  if (!['muscu.catalogue.custom-exercises.v1', 'muscu.catalogue.pending.v1', 'muscu.catalogue.favorites.v1'].includes(ev.key) || !progressCatalogue) return;
  refreshProgressExercises();
  if (tab === 'prog' || tab === 'hist' || (tab === 'seance' && sessionCatalogueOpen) || (tab === 'plan' && planCatalogueOpen)) render();
});

render();
if (sessionWasResumed) toast('Séance en cours retrouvée');
window.addEventListener('beforeunload', () => { syncInputs(); save(); flushSave(); });
window.addEventListener('pagehide', () => { syncInputs(); flushSave(); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { syncInputs(); flushSave(); }
});
document.addEventListener('gesturestart', event => event.preventDefault(), { passive: false });
document.addEventListener('gesturechange', event => event.preventDefault(), { passive: false });
// Demande à iOS/Android de ne pas purger le stockage local en cas de manque de place
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { }
// Service worker : met l'application en cache pour un usage 100 % hors ligne
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });
