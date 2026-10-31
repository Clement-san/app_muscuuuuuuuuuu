'use strict';
/* ============ Données ============
   Tout est stocké dans localStorage, sur cet appareil uniquement. Aucun appel réseau. */
const KEY = 'muscu.v1';
const AUTO_BACKUPS_KEY = 'muscu.backups.v1';
const FILE_EXPORT_DB = 'muscu.file-export.v1';
const FILE_EXPORT_STORE = 'handles';
const FILE_EXPORT_DIRECTORY_KEY = 'backup-directory';
const BACKUP_LOCAL_KEYS = [
  'muscu.catalogue.pending.v1',
  'muscu.catalogue.pending-layout.v1',
  'muscu.catalogue.favorites.v1',
  'muscu.catalogue.custom-exercises.v1'
];
const PENDING_KEY = 'muscu.catalogue.pending.v1';
const PENDING_LAYOUT_KEY = 'muscu.catalogue.pending-layout.v1';
const DEF = {
  v: 1,
  settings: { rest: 90, emom: 60, sets: 4, auto: true, sound: true, vibrate: true, visualAlert: true, backupReminder: 'weekly' },
  exercises: [],   // {id, name, rest|null}
  templates: [],   // {id, name, ex:[exerciseId]}
  sessions: [],    // {id, date, dur, name, items:[{ex, n, sets:[{r,w}]}]}
  progress: {},    // mesures manuelles indexées par URL d’exercice du catalogue
  progressLayout: 'mosaic',
  current: null,   // séance en cours (persistée pour survivre à un rechargement)
  lastExport: 0
};
const mk = () => JSON.parse(JSON.stringify(DEF)); // copie profonde des valeurs par défaut

let S = load();
let tab = 'seance', progEx = null, openSess = null, editingSessionId = null, sessionWasResumed = Boolean(S.current), expandedProgressExercise = null, selectedPendingUrl = null, sessionCatalogueOpen = false, sessionCatalogueQuery = '', sessionCatalogueGroup = '', sessionCatalogueFavoritesOnly = false, planCatalogueOpen = false, planCatalogueQuery = '', planCatalogueGroup = '', planCatalogueFavoritesOnly = false, planCatalogueTemplateId = '', progressCatalogue = null, progressCatalogueError = false, progressCatalogueWarning = false, progressCatalogueLoading = false, progressQuery = '', progressGroup = '', T = null, AC = null, warned = false;
let saveTimer = null;

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const o = JSON.parse(raw), b = mk();
      const state = Object.assign(b, o, { settings: Object.assign(b.settings, o.settings) });
      state.exercises.forEach(exercise => delete exercise.rest);
      return state;
    }
  } catch (e) { /* données illisibles : on repart de zéro */ }
  return mk();
}
function save() {
  // Regroupe les mutations rapprochées pour éviter plusieurs écritures synchrones.
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    persistState();
  }, 400);
  return true;
}
function persistState() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); return true; }
  catch (error) {
    console.error('Impossible de sauvegarder les données de l’application.', error);
    if (!warned) { warned = true; toast('Stockage indisponible : données non sauvegardées'); }
    return false;
  }
}
function flushSave() {
  if (saveTimer === null) return true;
  clearTimeout(saveTimer);
  saveTimer = null;
  return persistState();
}
function readAutomaticBackups() {
  try {
    const stored = JSON.parse(localStorage.getItem(AUTO_BACKUPS_KEY) || '[]');
    if (!Array.isArray(stored)) throw new Error('format');
    return stored.filter(backup => isValidBackup(backup));
  } catch (error) {
    console.error('Impossible de lire les sauvegardes automatiques.', error);
    toast('Lecture des sauvegardes automatiques impossible');
    return [];
  }
}
function isValidBackup(backup) {
  return Boolean(backup && typeof backup.id === 'string' && Number.isFinite(backup.createdAt)
    && backup.state && backup.state.v === 1 && Array.isArray(backup.state.sessions)
    && Array.isArray(backup.state.exercises) && Array.isArray(backup.state.templates)
    && backup.state.settings && typeof backup.state.settings === 'object'
    && backup.state.sessions.every(session => session && typeof session.date === 'string'
      && Array.isArray(session.items) && session.items.every(item => item && Array.isArray(item.sets)))
    && backup.deviceData && typeof backup.deviceData === 'object'
    && BACKUP_LOCAL_KEYS.every(key => !Object.prototype.hasOwnProperty.call(backup.deviceData, key)
      || backup.deviceData[key] === null || typeof backup.deviceData[key] === 'string'));
}
function openFileExportDb() {
  if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB indisponible'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(FILE_EXPORT_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(FILE_EXPORT_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Ouverture du stockage des fichiers impossible'));
  });
}
async function getAutoExportDirectory() {
  const db = await openFileExportDb();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(FILE_EXPORT_STORE, 'readonly').objectStore(FILE_EXPORT_STORE).get(FILE_EXPORT_DIRECTORY_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error('Lecture du dossier de sauvegarde impossible'));
    });
  } finally { db.close(); }
}
async function storeAutoExportDirectory(handle) {
  const db = await openFileExportDb();
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(FILE_EXPORT_STORE, 'readwrite');
      transaction.objectStore(FILE_EXPORT_STORE).put(handle, FILE_EXPORT_DIRECTORY_KEY);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error('Enregistrement du dossier de sauvegarde impossible'));
      transaction.onabort = () => reject(transaction.error || new Error('Enregistrement du dossier de sauvegarde interrompu'));
    });
  } finally { db.close(); }
}
async function clearAutoExportDirectory() {
  const db = await openFileExportDb();
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(FILE_EXPORT_STORE, 'readwrite');
      transaction.objectStore(FILE_EXPORT_STORE).delete(FILE_EXPORT_DIRECTORY_KEY);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error('Suppression du dossier de sauvegarde impossible'));
    });
  } finally { db.close(); }
}
function backupDeviceData() {
  return Object.fromEntries(BACKUP_LOCAL_KEYS.map(key => [key, localStorage.getItem(key)]));
}
async function configureAutoExportDirectory() {
  if (typeof window.showDirectoryPicker !== 'function') {
    toast('Ce navigateur ne permet pas de choisir un dossier. Le partage vers Fichiers sera proposé après chaque séance.');
    return;
  }
  try {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    const permission = await handle.requestPermission({ mode: 'readwrite' });
    if (permission !== 'granted') {
      toast('Accès au dossier refusé : export automatique non configuré');
      return;
    }
    await storeAutoExportDirectory(handle);
    toast('Dossier d’export automatique configuré');
    render();
  } catch (error) {
    if (error.name === 'AbortError') return;
    console.error('Impossible de configurer le dossier d’export automatique.', error);
    toast('Configuration du dossier impossible');
  }
}
async function exportCompletedWorkout(workoutName) {
  const date = new Date();
  const data = JSON.stringify({ ...JSON.parse(JSON.stringify(S)), deviceData: backupDeviceData(), exportedAt: date.toISOString() }, null, 2);
  const safeName = String(workoutName || 'séance').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'seance';
  const filename = `muscu-${date.toISOString().replace(/[:.]/g, '-')}-${safeName}.json`;
  const file = new File([data], filename, { type: 'application/json' });
  if (typeof window.showDirectoryPicker !== 'function' && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      S.lastExport = Date.now();
      save();
      toast('Sauvegarde complète prête à enregistrer dans Fichiers');
      return;
    } catch (error) {
      if (error.name === 'AbortError') {
        toast('Export annulé ; la sauvegarde reste disponible sur cet appareil');
        return;
      }
      console.error('Partage de la sauvegarde automatique impossible.', error);
    }
  }
  let directoryError = null;
  try {
    const directory = await getAutoExportDirectory();
    if (directory) {
      let permission = await directory.queryPermission({ mode: 'readwrite' });
      if (permission !== 'granted') permission = await directory.requestPermission({ mode: 'readwrite' });
      if (permission === 'granted') {
        const handle = await directory.getFileHandle(filename, { create: true });
        const writable = await handle.createWritable();
        await writable.write(file);
        await writable.close();
        S.lastExport = Date.now();
        save();
        toast(`Sauvegarde exportée dans Fichiers : ${filename}`);
        return;
      }
      directoryError = new Error('Permission d’écriture dans le dossier révoquée');
    }
  } catch (error) {
    directoryError = error;
    console.error('Écriture de la sauvegarde dans le dossier configuré impossible.', error);
  }
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      S.lastExport = Date.now();
      save();
      toast('Sauvegarde complète prête à enregistrer dans Fichiers');
      return;
    } catch (error) {
      if (error.name === 'AbortError') {
        toast('Export annulé ; la sauvegarde reste disponible sur cet appareil');
        return;
      }
      console.error('Partage de la sauvegarde automatique impossible.', error);
    }
  }
  const link = document.createElement('a');
  link.href = URL.createObjectURL(file);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 4000);
  S.lastExport = Date.now();
  save();
  if (directoryError) toast('Dossier inaccessible : téléchargement de secours lancé');
  else toast('Sauvegarde téléchargée');
}
async function refreshAutoExportStatus() {
  const status = $('#auto-export-status');
  const clearButton = $('[data-act="clearAutoExportDirectory"]');
  if (!status) return;
  if (typeof window.showDirectoryPicker !== 'function') {
    status.textContent = navigator.canShare
      ? 'Sur iPhone/iPad, la feuille de partage sera proposée après chaque séance pour enregistrer dans Fichiers.'
      : 'Ce navigateur téléchargera un fichier après chaque séance. Sur iPhone, choisis Partager puis Enregistrer dans Fichiers.';
    return;
  }
  try {
    const directory = await getAutoExportDirectory();
    if (!directory) {
      status.textContent = 'Aucun dossier choisi : le navigateur téléchargera une copie après chaque séance.';
      if (clearButton) clearButton.hidden = true;
      return;
    }
    const permission = await directory.queryPermission({ mode: 'readwrite' });
    status.textContent = permission === 'granted'
      ? `Export automatique activé dans « ${directory.name} ».`
      : `Dossier « ${directory.name} » mémorisé ; l’accès devra peut-être être autorisé à la prochaine séance.`;
    if (clearButton) clearButton.hidden = false;
  } catch (error) {
    console.error('Impossible de vérifier le dossier d’export automatique.', error);
    status.textContent = 'État du dossier impossible à vérifier. Les sauvegardes locales restent actives.';
  }
}
function createAutomaticBackup(sessionName) {
  try {
    const deviceData = backupDeviceData();
    const backup = {
      id: uid(),
      createdAt: Date.now(),
      sessionName,
      state: JSON.parse(JSON.stringify(S)),
      deviceData
    };
    const backups = [backup, ...readAutomaticBackups()]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 3);
    localStorage.setItem(AUTO_BACKUPS_KEY, JSON.stringify(backups));
    return true;
  } catch (error) {
    console.error('Impossible de créer la sauvegarde automatique de la séance.', error);
    toast('Sauvegarde automatique impossible : espace local insuffisant ou stockage indisponible');
    return false;
  }
}
function restoreAutomaticBackup(backup) {
  if (!isValidBackup(backup)) {
    console.error('La sauvegarde automatique est incomplète ou corrompue.');
    toast('Sauvegarde invalide : restauration annulée');
    return false;
  }
  flushSave();
  const keys = [KEY, ...BACKUP_LOCAL_KEYS];
  let previous;
  try {
    previous = Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)]));
    localStorage.setItem(KEY, JSON.stringify(backup.state));
    BACKUP_LOCAL_KEYS.forEach(key => {
      const value = backup.deviceData && Object.prototype.hasOwnProperty.call(backup.deviceData, key) ? backup.deviceData[key] : null;
      if (value === null) localStorage.removeItem(key);
      else if (typeof value === 'string') localStorage.setItem(key, value);
    });
    return true;
  } catch (error) {
    console.error('Impossible de restaurer la sauvegarde automatique.', error);
    (previous ? keys : []).forEach(key => {
      try {
        const value = previous[key];
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      } catch (rollbackError) {
        console.error(`Impossible de rétablir les données précédentes pour ${key}.`, rollbackError);
      }
    });
    toast('Restauration impossible : les données précédentes ont été conservées');
    return false;
  }
}

/* ============ Utilitaires ============ */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
// Accepte la virgule décimale du clavier français ; renvoie '' si vide/invalide
const num = v => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) || n < 0 ? '' : n; };
const defaultSetCount = () => {
  const count = num(S.settings.sets);
  return count === '' ? 4 : Math.max(1, Math.min(12, Math.round(count)));
};
const fmt = n => String(Math.round(n * 10) / 10).replace('.', ',');
const mmss = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
const dFr = iso => new Date(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
// 1RM estimé (formule d'Epley) ; pour 1 répétition, la charge elle-même
const e1 = (w, r) => r <= 0 ? 0 : (r === 1 ? w : w * (1 + r / 30));
let tmr; function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(tmr); tmr = setTimeout(() => t.classList.remove('on'), 2200); }

// Nom d'un exercice : bibliothèque actuelle, sinon nom archivé dans l'historique
function exName(id, fb) {
  const e = S.exercises.find(x => x.id === id);
  if (e) return e.name;
  if (fb) return fb;
  for (const s of S.sessions) for (const i of s.items) if (i.ex === id) return i.n;
  return 'Exercice supprimé';
}
// Séries de la dernière séance contenant cet exercice
function lastSets(id) {
  const ss = S.sessions.filter(s => s.items.some(i => i.ex === id)).sort((a, b) => b.date.localeCompare(a.date));
  return ss.length ? ss[0].items.find(i => i.ex === id).sets : null;
}
// Résumé compact : "3×8 @ 60 kg · 1×6 @ 62,5 kg"
function summ(sets) {
  const out = [];
  for (const s of sets) {
    const l = out[out.length - 1];
    if (l && l.r === s.r && l.w === s.w) l.n++; else out.push({ r: s.r, w: s.w, n: 1 });
  }
  return out.map(g => `${g.n}×${g.r} @ ${fmt(g.w)} kg`).join(' · ');
}
// Historique d'un exercice, du plus ancien au plus récent
function exHistory(id) {
  return S.sessions.filter(s => s.items.some(i => i.ex === id)).sort((a, b) => a.date.localeCompare(b.date)).map(s => {
    const sets = s.items.filter(i => i.ex === id).flatMap(i => i.sets);
    return { s, sets, best: Math.max(...sets.map(x => e1(x.w, x.r))), max: Math.max(...sets.map(x => x.w)), vol: sets.reduce((a, x) => a + x.w * x.r, 0) };
  });
}
const newItem = id => {
  const exercise = S.exercises.find(item => item.id === id);
  const progressKey = exercise && (typeof exercise.catalogueUrl === 'string' ? exercise.catalogueUrl : `manual:${exercise.id}`);
  const progress = progressKey && S.progress && S.progress[progressKey] || {};
  const weight = progress.weight == null ? '' : progress.weight;
  const reps = progress.reps == null ? '' : progress.reps;
  const sets = Array.from({ length: defaultSetCount() }, () => ({ w: weight, r: reps, done: false }));
  return { ex: id, n: exName(id), image: exercise && exercise.image || '', sets };
};
