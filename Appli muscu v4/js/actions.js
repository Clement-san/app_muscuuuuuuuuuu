'use strict';
/* ============ Actions ============ */
// Recopie les champs saisis dans l'état avant toute action (évite de perdre une saisie non validée)
function syncInputs() {
  if (!S.current) return;
  document.querySelectorAll('input[data-f]').forEach(i => {
    const it = S.current.items[+i.dataset.ei]; if (!it) return;
    const s = it.sets[+i.dataset.si]; if (s) s[i.dataset.f] = num(i.value);
  });
}
function addToCurrent(id) { S.current.items.push(newItem(id)); }
function newExercise(name) {
  name = (name || '').trim(); if (!name) return null;
  const e = { id: uid(), name }; S.exercises.push(e); return e;
}
const move = (a, k, d) => { const j = k + d; if (j < 0 || j >= a.length) return; [a[k], a[j]] = [a[j], a[k]]; };

function act(a, d) {
  const ex = id => S.exercises.find(e => e.id === id), tp = id => S.templates.find(t => t.id === id);
  let completedWorkout = null;
  syncInputs();
  switch (a) {
    case 'progressLayout': {
      if (d.layout !== 'mosaic' && d.layout !== 'list') return;
      S.progressLayout = d.layout;
      break;
    }
    case 'retryProgressCatalogue': loadProgressCatalogue(); break;
    case 'openSessionCatalogue': {
      sessionCatalogueOpen = true;
      if (!progressCatalogue && !progressCatalogueLoading) loadProgressCatalogue();
      break;
    }
    case 'toggleSessionFavorites':
      sessionCatalogueFavoritesOnly = !sessionCatalogueFavoritesOnly;
      break;
    case 'retrySessionCatalogue':
      loadProgressCatalogue();
      break;
    case 'openPlanCatalogue':
      planCatalogueOpen = true;
      planCatalogueTemplateId = S.templates[0]?.id || '';
      if (!progressCatalogue && !progressCatalogueLoading) loadProgressCatalogue();
      break;
    case 'closePlanCatalogue':
      planCatalogueOpen = false;
      break;
    case 'retryPlanCatalogue':
      loadProgressCatalogue();
      break;
    case 'togglePlanFavorites':
      planCatalogueFavoritesOnly = !planCatalogueFavoritesOnly;
      updatePlanCatalogueResults();
      return;
    case 'addPlanCatalogueExercise': {
      const selected = progressCatalogue && progressCatalogue.find(item => item.url === d.catalogueUrl);
      const template = tp(planCatalogueTemplateId) || S.templates[0];
      if (!selected || !template) return;
      planCatalogueTemplateId = template.id;
      let exercise = S.exercises.find(item => item.catalogueUrl === selected.url);
      if (!exercise) {
        exercise = { id: uid(), name: selected.name, catalogueUrl: selected.url, image: selected.image };
        S.exercises.push(exercise);
      }
      if (template.ex.includes(exercise.id)) {
        toast(`${selected.name} est déjà dans ${template.name}`);
        return;
      }
      template.ex.push(exercise.id);
      save();
      try {
        const remaining = readPendingExercises().filter(item => item.url !== selected.url);
        localStorage.setItem(PENDING_KEY, JSON.stringify(remaining));
      } catch (error) {
        console.error('Impossible de retirer l’exercice ajouté de la liste d’attente.', error);
        toast('Exercice ajouté, mais toujours présent dans la liste d’attente');
      }
      render();
      toast(`${selected.name} ajouté à ${template.name}`);
      return;
    }
    case 'closeSessionCatalogue':
      sessionCatalogueOpen = false;
      break;
    case 'addCatalogueExercise': {
      const selected = progressCatalogue && progressCatalogue.find(item => item.url === d.catalogueUrl);
      if (!selected || !S.current) return;
      let exercise = S.exercises.find(item => item.catalogueUrl === selected.url);
      if (!exercise) {
        exercise = { id: uid(), name: selected.name, catalogueUrl: selected.url, image: selected.image };
        S.exercises.push(exercise);
      }
      if (!S.current.items.some(item => item.ex === exercise.id)) addToCurrent(exercise.id);
      sessionCatalogueOpen = false;
      sessionCatalogueQuery = '';
      sessionCatalogueGroup = '';
      break;
    }
    case 'pendingLayout': {
      if (d.layout !== 'mosaic' && d.layout !== 'list') return;
      try { localStorage.setItem(PENDING_LAYOUT_KEY, d.layout); }
      catch (error) { console.error('Impossible d’enregistrer le mode des exercices en attente.', error); toast('Mode d’affichage non sauvegardé'); }
      break;
    }
    case 'removePending': {
      try {
        const pending = readPendingExercises().filter(item => item.url !== d.id);
        localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
      } catch (error) { console.error('Impossible de retirer l’exercice en attente.', error); toast('Exercice non retiré'); }
      break;
    }
    case 'start': {
      const t = tp(d.id);
      sessionWasResumed = false;
      S.current = { id: uid(), start: Date.now(), name: t ? t.name : 'Séance libre',
        items: (t ? t.ex : []).filter(id => ex(id)).map(newItem) };
      break;
    }
    case 'setTimerMode': {
      const it = S.current.items[+d.ei];
      if (!it || (d.mode !== 'standard' && d.mode !== 'emom')) return;
      if (d.mode === 'standard' && it.emomTimer && Number.isFinite(it.emomTimer.end)) {
        it.emomTimer.remaining = Math.max(1, Math.ceil((it.emomTimer.end - Date.now()) / 1000));
        it.emomTimer.end = null;
      }
      it.timerMode = d.mode;
      break;
    }
    case 'toggleEmomTimer': {
      const it = S.current.items[+d.ei];
      if (!it) return;
      it.timerMode = 'emom';
      const timer = emomTimerFor(it);
      if (Number.isFinite(timer.end)) {
        timer.remaining = Math.max(1, Math.ceil((timer.end - Date.now()) / 1000));
        timer.end = null;
      } else timer.end = Date.now() + Math.max(1, timer.remaining) * 1000;
      break;
    }
    case 'adjustEmomTimer': {
      const it = S.current.items[+d.ei];
      if (!it) return;
      const timer = emomTimerFor(it), change = Number(d.seconds);
      if (change !== 10 && change !== -10) return;
      if (Number.isFinite(timer.end)) timer.end = Math.max(Date.now() + 1000, timer.end + change * 1000);
      else timer.remaining = Math.max(1, timer.remaining + change);
      break;
    }
    case 'resetEmomTimer': {
      const it = S.current.items[+d.ei];
      if (!it) return;
      it.emomTimer = { remaining: Math.max(5, num(S.settings.emom) || 60), end: null };
      break;
    }
    case 'addSet': { const it = S.current.items[+d.ei], l = it.sets[it.sets.length - 1]; it.sets.push({ w: l ? l.w : '', r: l ? l.r : '', done: false }); break; }
    case 'rmSet': { const it = S.current.items[+d.ei]; if (it.sets.length > 1) it.sets.pop(); break; }
    case 'rmEx': if (confirm('Retirer cet exercice de la séance ?')) S.current.items.splice(+d.ei, 1); break;
    case 'done': {
      const it = S.current.items[+d.ei], s = it.sets[+d.si];
      if (!s.done) {
        if (!(s.r > 0)) { toast('Renseigne le nombre de reps'); return; }
        if (s.w === '') s.w = 0; // poids du corps
        s.done = true; unlockAudio();
        if (it.timerMode === 'emom' && it.sets.every(set => set.done)) finishEmomExercise(it);
        else if (S.settings.auto && it.timerMode !== 'emom') startRest(S.settings.rest, exName(it.ex, it.n));
      } else { s.done = false; delete s.emom; }
      break;
    }
    case 'rest': unlockAudio(); startRest(S.settings.rest, 'Repos'); break;
    case 'tm': if (T) { T.end += +d.d * 1000; T.total = Math.max(T.total, Math.ceil((T.end - Date.now()) / 1000)); T.fired = false; } break;
    case 'tstop': T = null; break;
    case 'finish': {
      const items = S.current.items.map(i => ({ ex: i.ex, n: exName(i.ex, i.n), sets: i.sets.filter(s => s.done && (s.r > 0 || s.emom)).map(s => ({ r: s.r || 0, w: s.w || 0 })) })).filter(i => i.sets.length);
      if (!items.length) { if (confirm('Aucune série validée. Abandonner la séance ?')) S.current = null; break; }
      completedWorkout = { id: S.current.id, date: new Date(S.current.start).toISOString(), dur: Math.max(1, Math.round((Date.now() - S.current.start) / 60000)), name: S.current.name, items };
      S.sessions.push(completedWorkout);
      S.current = null; T = null; sessionWasResumed = false; tab = 'hist'; toast('Séance enregistrée');
      break;
    }
    case 'discard': if (confirm('Abandonner la séance en cours ? Rien ne sera enregistré.')) { S.current = null; T = null; sessionWasResumed = false; } break;
    case 'toggle': openSess = openSess === d.id ? null : d.id; break;
    case 'editSession': editingSessionId = d.id; break;
    case 'saveSessionEdit': editingSessionId = null; toast('Séance modifiée'); break;
    case 'addExerciseToHistory': {
      const session = S.sessions.find(item => item.id === d.id);
      const selector = [...document.querySelectorAll('[data-session-add-exercise]')]
        .find(item => item.dataset.sessionAddExercise === d.id);
      const exercise = selector && ex(selector.value);
      if (!session || !exercise) { toast('Choisis un exercice à ajouter'); return; }
      if (session.items.some(item => item.ex === exercise.id)) { toast('Cet exercice est déjà dans la séance'); return; }
      session.items.push({ ex: exercise.id, n: exercise.name, sets: [{ w: '', r: '' }] });
      break;
    }
    case 'removeExerciseFromHistory': {
      const session = S.sessions.find(item => item.id === d.id);
      const index = Number(d.itemIndex);
      if (session && Number.isInteger(index) && index >= 0 && index < session.items.length
        && confirm('Retirer cet exercice et ses séries de la séance ?')) session.items.splice(index, 1);
      break;
    }
    case 'addSetToHistory': {
      const session = S.sessions.find(item => item.id === d.id), item = session && session.items[+d.itemIndex];
      if (!item) return;
      const last = item.sets[item.sets.length - 1];
      item.sets.push({ w: last?.w ?? '', r: last?.r ?? '' });
      break;
    }
    case 'removeSetFromHistory': {
      const session = S.sessions.find(item => item.id === d.id), item = session && session.items[+d.itemIndex];
      const index = Number(d.setIndex);
      if (item && Number.isInteger(index) && index >= 0 && index < item.sets.length && item.sets.length > 1) item.sets.splice(index, 1);
      break;
    }
    case 'delSess': if (confirm('Supprimer définitivement cette séance ?')) {
      S.sessions = S.sessions.filter(s => s.id !== d.id);
      if (editingSessionId === d.id) editingSessionId = null;
    } break;
    case 'restoreAutomaticBackup': {
      const backup = readAutomaticBackups().find(item => item.id === d.id);
      if (!backup) { toast('Cette sauvegarde est introuvable'); return; }
      const created = new Date(backup.createdAt).toLocaleString('fr-FR');
      if (!confirm(`Restaurer la sauvegarde du ${created} (${backup.sessionName || 'séance'}) ?\n\nToutes les données actuelles de l’application seront remplacées.`)) return;
      if (!restoreAutomaticBackup(backup)) return;
      S = Object.assign(mk(), backup.state, { settings: Object.assign(mk().settings, backup.state.settings) });
      S.exercises.forEach(exercise => delete exercise.rest);
      T = null;
      editingSessionId = null;
      sessionWasResumed = Boolean(S.current);
      sessionCatalogueOpen = false;
      planCatalogueOpen = false;
      expandedProgressExercise = null;
      tab = 'seance';
      toast('Sauvegarde restaurée');
      break;
    }
    case 'configureAutoExportDirectory':
      configureAutoExportDirectory();
      return;
    case 'clearAutoExportDirectory':
      clearAutoExportDirectory().then(() => { toast('Dossier d’export retiré'); render(); })
        .catch(error => {
          console.error('Impossible de retirer le dossier d’export automatique.', error);
          toast('Impossible de retirer le dossier d’export');
        });
      return;
    case 'trestart': startRest(T ? T.total : S.settings.rest, T ? T.label : 'Repos'); break;
    case 'addExLib': newExercise(prompt('Nom de l’exercice')); break;
    case 'renEx': { const e = ex(d.id), n = (prompt('Nouveau nom', e.name) || '').trim(); if (n) e.name = n; break; }
    case 'delEx': if (confirm('Supprimer cet exercice ? L’historique est conservé.')) {
      S.exercises = S.exercises.filter(e => e.id !== d.id); S.templates.forEach(t => t.ex = t.ex.filter(i => i !== d.id));
    } break;
    case 'addTpl': { const n = (prompt('Nom de la séance (ex. Push, Haut du corps)') || '').trim(); if (n) S.templates.push({ id: uid(), name: n, ex: [] }); break; }
    case 'renTpl': { const t = tp(d.id), n = (prompt('Nouveau nom', t.name) || '').trim(); if (n) t.name = n; break; }
    case 'delTpl': if (confirm('Supprimer cette séance type ?')) S.templates = S.templates.filter(t => t.id !== d.id); break;
    case 'tplUp': move(tp(d.id).ex, +d.k, -1); break;
    case 'tplDown': move(tp(d.id).ex, +d.k, 1); break;
    case 'tplRm': tp(d.id).ex.splice(+d.k, 1); break;
    case 'testSound': unlockAudio(); beep(3); return;
    case 'export': exportData(); return;
    case 'import': $('#file').click(); return;
    case 'reset':
      if (confirm('Effacer TOUTES les données ? Action irréversible.') && confirm('Dernière confirmation : tout supprimer ?')) {
        try { localStorage.removeItem(KEY); } catch (e) { } S = mk(); T = null; editingSessionId = null; sessionWasResumed = false; toast('Données effacées');
      } break;
  }
  save();
  if (completedWorkout) {
    const backedUp = createAutomaticBackup(completedWorkout.name);
    if (backedUp) toast('Séance enregistrée et sauvegarde automatique créée');
    else toast('Séance enregistrée, mais la sauvegarde automatique a échoué');
    exportCompletedWorkout(completedWorkout.name).catch(error => {
    console.error('Export automatique du fichier de sauvegarde impossible.', error);
    toast('Export vers Fichiers impossible ; la copie locale est conservée');
    });
  }
  render();
}

async function exportData() {
  const name = `muscu-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([JSON.stringify({ ...S, deviceData: backupDeviceData(), exportedAt: new Date().toISOString() }, null, 1)], name, { type: 'application/json' });
  try { // feuille de partage iOS (Enregistrer dans Fichiers, AirDrop…)
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: name });
      S.lastExport = Date.now(); save(); render(); return;
    }
  } catch (e) { if (e.name === 'AbortError') return; console.error('Partage manuel de la sauvegarde impossible.', e); }
  const a = document.createElement('a'); // repli : téléchargement classique
  a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  S.lastExport = Date.now(); save(); render();
}
function importData(f) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const o = JSON.parse(r.result);
      if (!o || o.v !== 1 || !Array.isArray(o.sessions) || !Array.isArray(o.exercises) || !Array.isArray(o.templates)) throw new Error('format');
      const importedState = { ...o };
      delete importedState.deviceData;
      delete importedState.exportedAt;
      const countSets = sessions => sessions.reduce((count, session) => count + (Array.isArray(session.items)
        ? session.items.reduce((itemsCount, item) => itemsCount + (Array.isArray(item?.sets) ? item.sets.length : 0), 0)
        : 0), 0);
      const currentSets = countSets(S.sessions);
      const importedSets = countSets(o.sessions);
      if (!confirm(`Remplacer toutes les données de cet appareil ?\n\nActuellement : ${S.sessions.length} séances, ${S.exercises.length} exercices et ${currentSets} séries.\nDans l’export : ${o.sessions.length} séances, ${o.exercises.length} exercices et ${importedSets} séries.\n\nCette opération est irréversible.`)) return;
      const b = mk(), nextState = Object.assign(b, importedState, { settings: Object.assign(b.settings, o.settings) });
      const backup = { id: uid(), createdAt: Date.now(), state: nextState, deviceData: o.deviceData || backupDeviceData() };
      if (!restoreAutomaticBackup(backup)) return;
      S = nextState;
      S.exercises.forEach(exercise => delete exercise.rest);
      T = null;
      editingSessionId = null;
      sessionWasResumed = Boolean(S.current);
      save(); render(); toast('Import réussi');
    } catch (e) { console.error('Import de sauvegarde impossible.', e); toast('Fichier invalide ou restauration impossible'); }
  };
  r.readAsText(f);
}
