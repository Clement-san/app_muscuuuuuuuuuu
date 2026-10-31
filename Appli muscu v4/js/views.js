'use strict';
/* ============ Vues ============ */
function backupBanner() {
  if (S.settings.backupReminder === 'off') return '';
  const reminder = S.settings.backupReminder === 'weekly' ? 7 : 30;
  const overdue = !S.lastExport || Date.now() - S.lastExport >= reminder * 864e5;
  return S.sessions.length > 0 && overdue
    ? `<div class="banner">Pense à sauvegarder tes données${S.settings.backupReminder === 'weekly' ? ' cette semaine' : ''} dans Réglages.</div>` : '';
}
function icon(name) {
  const paths = {
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    grip: '<path d="M5 6h14M5 12h14M5 18h14"/>',
    timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6M12 5V2"/>',
    edit: '<path d="m15 5 4 4M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16l-1 4Z"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M5 7l1 14h12l1-14M9 7V4h6v3"/>',
    up: '<path d="m6 14 6-6 6 6"/>',
    down: '<path d="m6 10 6 6 6-6"/>',
    play: '<path d="m8 5 11 7-11 7z"/>',
    pause: '<path d="M8 5h3v14H8zM15 5h3v14h-3z"/>',
    reset: '<path d="M3 12a9 9 0 1 0 2.64-6.36L3 8"/><path d="M3 3v5h5"/>'
  };
  return `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;
}
function vHome() {
  let h = '<div class="brandline"><img class="brandmark" src="logo.png" alt="Logo Muscu"><span class="brandname">MUSCU</span><span class="branddivider"></span><span class="eyebrow">JOURNAL D’ENTRAÎNEMENT</span></div>'
    + '<div class="page-intro"><h1>Séance</h1><p>Un entraînement à la fois. Chaque effort compte.</p></div>' + backupBanner();
  if (!S.exercises.length && !S.templates.length)
    h += '<div class="card">Crée d’abord tes exercices et tes séances types dans l’onglet <b>Plan</b>, ou lance une séance libre.</div>';
  h += S.templates.map(t => `<div class="card"><div class="hd"><b>${esc(t.name)}</b>
    <button class="btn acc sm" data-act="start" data-id="${t.id}">Démarrer</button></div>
    <div class="mut sm">${t.ex.map(id => esc(exName(id))).join(' · ') || 'Aucun exercice'}</div></div>`).join('');
  return h + '<button class="btn" data-act="start" data-id="">Séance libre</button>';
}
function cardEx(it, ei) {
  const last = lastSets(it.ex);
  const exercise = S.exercises.find(item => item.id === it.ex);
  const image = it.image || (exercise && exercise.image);
  const emom = it.timerMode === 'emom';
  const timer = it.emomTimer && Number.isFinite(it.emomTimer.remaining)
    ? it.emomTimer : { remaining: S.settings.emom, end: null };
  const running = Number.isFinite(timer.end);
  const remaining = running ? Math.max(0, Math.ceil((timer.end - Date.now()) / 1000)) : timer.remaining;
  return `<div class="card" data-session-index="${ei}"><div class="hd"><span class="session-exercise-title" data-reorder-handle aria-label="Maintenir puis glisser pour déplacer ${esc(exName(it.ex, it.n))}" title="Maintenir puis glisser pour déplacer">${image ? `<img class="session-exercise-image" src="${esc(image)}" alt="">` : ''}<b>${esc(exName(it.ex, it.n))}</b></span><span class="exercise-actions"><button class="ic" data-act="rmEx" data-ei="${ei}" aria-label="Retirer l’exercice">${icon('close')}</button><div class="timer-menu"><details><summary aria-label="Choisir le type de chrono" title="Type de chrono">⋯</summary>
    <div class="timer-menu-options"><button data-act="setTimerMode" data-ei="${ei}" data-mode="standard" aria-pressed="${!emom}">Chrono standard${!emom ? ' · Actif' : ''}</button>
    <button data-act="setTimerMode" data-ei="${ei}" data-mode="emom" aria-pressed="${emom}">Chrono EMOM${emom ? ' · Actif' : ''}</button></div></details></div></span></div>
  ${emom ? `<div class="emom-clock"><div class="emom-adjustments"><button class="btn sm adjust" data-act="adjustEmomTimer" data-ei="${ei}" data-seconds="-10" aria-label="Reculer le compte à rebours de 10 secondes">−10 s</button>
    <button class="btn sm adjust" data-act="adjustEmomTimer" data-ei="${ei}" data-seconds="10" aria-label="Avancer le compte à rebours de 10 secondes">+10 s</button></div>
    <time data-emom-time="${ei}" aria-label="Temps restant avant la prochaine série">${mmss(remaining)}</time>
    <button class="btn sm acc emom-icon-button" data-act="toggleEmomTimer" data-ei="${ei}" aria-label="${running ? 'Mettre en pause' : 'Démarrer'} le chrono EMOM" title="${running ? 'Pause' : 'Lecture'}">${icon(running ? 'pause' : 'play')}</button>
    <button class="btn sm emom-icon-button" data-act="resetEmomTimer" data-ei="${ei}" aria-label="Réinitialiser le compte à rebours EMOM" title="Réinitialiser">${icon('reset')}</button></div>` : ''}
  <div class="mut sm">${last ? 'Dernière fois : ' + esc(summ(last)) : 'Première fois'}</div>
  <div class="sets"><div class="sh">#</div><div class="sh">kg</div><div class="sh">Reps</div><div></div>
  ${it.sets.map((s, si) => `<div class="sn">${si + 1}</div>
    <input class="in" inputmode="decimal" data-f="w" data-ei="${ei}" data-si="${si}" value="${s.w === '' ? '' : s.w}" placeholder="0">
    <input class="in" inputmode="numeric" data-f="r" data-ei="${ei}" data-si="${si}" value="${s.r === '' ? '' : s.r}" placeholder="0">
    <button class="ck ${s.done ? 'on' : ''}" data-act="done" data-ei="${ei}" data-si="${si}" aria-label="${s.done ? 'Annuler la validation' : 'Valider la série'}">${icon('check')}</button>`).join('')}</div>
  <div class="row"><button class="btn sm" data-act="addSet" data-ei="${ei}" title="Ajoute une série">+ Série</button>
  <button class="btn sm" data-act="rmSet" data-ei="${ei}">− Série</button></div></div>`;
}
function vSeance() {
  const c = S.current;
  if (!c) return vHome();
  return `<h1>${esc(c.name)} <span class="mut sm" id="elapsed"></span></h1>`
    + (sessionWasResumed ? '<div class="banner session-autosave" role="status">Séance récupérée automatiquement. Tes changements sont sauvegardés sur cet appareil.</div>' : '<div class="session-autosave-note">Sauvegarde automatique activée sur cet appareil.</div>')
    + c.items.map(cardEx).join('')
    + `<div class="card"><button class="btn" data-act="openSessionCatalogue">Choisir un exercice dans le catalogue</button>
       ${sessionCatalogueOpen ? sessionCataloguePicker() : ''}
       <button class="btn" data-act="rest">${icon('timer')} Lancer un repos</button></div>
     <div class="row"><button class="btn acc" data-act="finish">Terminer la séance</button>
     <button class="btn danger" data-act="discard">Abandonner</button></div>`;
}
function sessionCataloguePicker() {
  if (!progressCatalogue) {
    if (progressCatalogueError) return '<div class="session-catalogue-picker"><p role="alert">Le catalogue n’a pas pu être chargé.</p><button class="btn sm" data-act="retrySessionCatalogue">Réessayer</button></div>';
    return '<div class="session-catalogue-picker mut sm" role="status">Chargement du catalogue…</div>';
  }
  const exercises = progressCatalogue.filter(item => {
    const alreadyAdded = S.exercises.some(exercise => exercise.catalogueUrl === item.url && S.current.items.some(sessionItem => sessionItem.ex === exercise.id));
    const query = sessionCatalogueQuery.trim().toLocaleLowerCase('fr');
    return !alreadyAdded
      && (!sessionCatalogueFavoritesOnly || readFavoriteUrls().has(item.url))
      && (!sessionCatalogueGroup || item.groups.includes(sessionCatalogueGroup))
      && (!query || item.name.toLocaleLowerCase('fr').includes(query) || item.groups.join(' ').includes(query));
  });
  const favorites = readFavoriteUrls();
  const shown = exercises.slice(0, 40);
  return `<div class="session-catalogue-picker">
    <div class="session-catalogue-controls">
      <input class="in session-catalogue-search" type="search" data-session-catalogue-search placeholder="Rechercher un exercice…" value="${esc(sessionCatalogueQuery)}" aria-label="Rechercher un exercice du catalogue">
      <select data-ch="sessionCatalogueGroup" aria-label="Filtrer par groupe musculaire"><option value="">Tous les groupes</option>${PROGRESS_GROUPS.map(([value, name]) => `<option value="${value}" ${sessionCatalogueGroup === value ? 'selected' : ''}>${name}</option>`).join('')}</select>
      <button class="btn sm session-favorites-toggle" data-act="toggleSessionFavorites" aria-pressed="${sessionCatalogueFavoritesOnly}" ${favorites.size ? '' : 'disabled'}>♥ Favoris${favorites.size ? ` · ${favorites.size}` : ''}</button>
      <span class="mut sm session-catalogue-count" data-session-catalogue-count>${exercises.length > shown.length ? `40 premiers sur ${exercises.length} exercices` : `${exercises.length} exercice${exercises.length > 1 ? 's' : ''}`}</span>
    </div>
    <div class="session-catalogue-results" data-session-catalogue-results>${shown.length
      ? shown.map(item => `<button class="session-catalogue-item" data-act="addCatalogueExercise" data-catalogue-url="${esc(item.url)}">${item.image ? `<img src="${esc(item.image)}" alt="">` : ''}<span>${esc(item.name)}</span></button>`).join('')
      : '<p class="mut sm">Aucun exercice correspondant.</p>'}</div>
    ${progressCatalogueWarning ? '<p class="banner">Le catalogue est partiel : certaines catégories n’ont pas pu être chargées.</p>' : ''}
    <button class="btn sm" data-act="closeSessionCatalogue">Fermer le catalogue</button>
  </div>`;
}
function sessionHistorySection() {
  const sessions = S.sessions.slice().sort((a, b) => (new Date(b.date).getTime() || 0) - (new Date(a.date).getTime() || 0));
  if (!sessions.length) return '<section class="session-history"><h2>Séances récentes</h2><p class="mut sm">Tes séances terminées apparaîtront ici.</p></section>';
  return `<section class="session-history"><h2>Séances récentes</h2>${sessions.map(session => {
    const editing = editingSessionId === session.id;
    const setCount = session.items.reduce((count, item) => count + item.sets.length, 0);
    return `<article class="card history-session-card">
      <div class="history-session-heading"><div>${editing
        ? `<input class="in history-session-name-input" type="text" maxlength="80" data-session-meta="name" data-session-id="${esc(session.id)}" value="${esc(session.name)}" aria-label="Nom de la séance">`
        : `<b>${esc(session.name)}</b><span>${Number.isFinite(new Date(session.date).getTime()) ? esc(dFr(session.date)) : 'Date invalide'} · ${session.dur} min · ${setCount} séries</span>`}</div>
        <div class="history-session-actions"><button class="btn sm" data-act="${editing ? 'saveSessionEdit' : 'editSession'}" data-id="${esc(session.id)}">${editing ? 'Enregistrer' : 'Modifier'}</button><button class="ic" data-act="delSess" data-id="${esc(session.id)}" aria-label="Supprimer cette séance">×</button></div>
      </div>
      ${editing ? `<div class="history-session-meta">
        <label>Date et heure<input class="in" type="datetime-local" data-session-meta="date" data-session-id="${esc(session.id)}" value="${esc(localDateTimeValue(session.date))}"></label>
        <label>Durée (min)<input class="in" type="number" min="1" max="1440" step="1" data-session-meta="dur" data-session-id="${esc(session.id)}" value="${Math.max(1, Math.round(session.dur || 1))}"></label>
      </div>
      <div class="history-session-add-exercise"><select data-session-add-exercise="${esc(session.id)}" aria-label="Exercice à ajouter à la séance"><option value="">Ajouter un exercice…</option>${S.exercises.map(exercise => `<option value="${esc(exercise.id)}">${esc(exercise.name)}</option>`).join('')}</select><button class="btn sm" data-act="addExerciseToHistory" data-id="${esc(session.id)}">Ajouter</button></div>
      ${session.items.map((item, itemIndex) => `<div class="history-session-exercise"><div class="history-session-exercise-heading"><input class="in" type="text" maxlength="100" data-session-field="name" data-session-id="${esc(session.id)}" data-item-index="${itemIndex}" value="${esc(item.n || exName(item.ex))}" aria-label="Nom de l’exercice"><button class="ic" data-act="removeExerciseFromHistory" data-id="${esc(session.id)}" data-item-index="${itemIndex}" aria-label="Retirer cet exercice de la séance">×</button></div><div class="history-session-sets">${item.sets.map((set, setIndex) => `<label>Série ${setIndex + 1}<span><input class="in" type="number" min="0" step="0.5" inputmode="decimal" data-session-field="w" data-session-id="${esc(session.id)}" data-item-index="${itemIndex}" data-set-index="${setIndex}" value="${set.w ?? ''}" aria-label="Poids série ${setIndex + 1} pour ${esc(item.n || exName(item.ex))}">kg</span><span><input class="in" type="number" min="0" step="1" inputmode="numeric" data-session-field="r" data-session-id="${esc(session.id)}" data-item-index="${itemIndex}" data-set-index="${setIndex}" value="${set.r ?? ''}" aria-label="Répétitions série ${setIndex + 1} pour ${esc(item.n || exName(item.ex))}">reps</span>${item.sets.length > 1 ? `<button class="ic" data-act="removeSetFromHistory" data-id="${esc(session.id)}" data-item-index="${itemIndex}" data-set-index="${setIndex}" aria-label="Supprimer la série ${setIndex + 1}">−</button>` : ''}</label>`).join('')}<button class="btn sm history-add-set" data-act="addSetToHistory" data-id="${esc(session.id)}" data-item-index="${itemIndex}">+ Série</button></div></div>`).join('')}` : `<div class="history-session-summary">${session.items.map(item => `<div><b>${esc(item.n || exName(item.ex))}</b><span>${esc(summ(item.sets))}</span></div>`).join('')}</div>`}
    </article>`;
  }).join('')}</section>`;
}
function localDateTimeValue(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    : '';
}
function startOfWeek(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  return start;
}
function weeklyTrainingSummary() {
  const now = new Date();
  const thisWeek = startOfWeek(now);
  const weekSessions = S.sessions.filter(session => {
    const date = new Date(session.date);
    return Number.isFinite(date.getTime()) && date >= thisWeek && date <= now;
  });
  const totals = weekSessions.reduce((result, session) => {
    result.duration += Number(session.dur) || 0;
    session.items.forEach(item => item.sets.forEach(set => {
      result.sets++;
      result.volume += (Number(set.w) || 0) * (Number(set.r) || 0);
    }));
    return result;
  }, { duration: 0, sets: 0, volume: 0 });
  const weeks = Array.from({ length: 4 }, (_, index) => {
    const start = new Date(thisWeek);
    start.setDate(start.getDate() - (3 - index) * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const count = S.sessions.filter(session => {
      const date = new Date(session.date);
      return Number.isFinite(date.getTime()) && date >= start && date < end && date <= now;
    }).length;
    return { start, count };
  });
  const max = Math.max(1, ...weeks.map(week => week.count));
  const bars = weeks.map(week => `<div class="weekly-bar"><span>${week.count}</span><div><i style="height:${Math.max(4, week.count / max * 100)}%"></i></div><small>${esc(week.start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }))}</small></div>`).join('');
  return `<section class="weekly-summary" aria-labelledby="weekly-summary-title"><div class="weekly-summary-heading"><h2 id="weekly-summary-title">Bilan d’entraînement</h2><span>Semaine du ${esc(thisWeek.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }))}</span></div>
    <div class="weekly-stats"><div><b>${weekSessions.length}</b><span>séance${weekSessions.length === 1 ? '' : 's'}</span></div><div><b>${totals.sets}</b><span>séries</span></div><div><b>${totals.duration}</b><span>minutes</span></div><div><b>${fmt(totals.volume)}</b><span>kg cumulés</span></div></div>
    <div class="weekly-chart" aria-label="Nombre de séances par semaine">${bars}</div>
  </section>`;
}
function vHist() {
  if (!progressCatalogue) {
    if (progressCatalogueError) return `<h1>Progrès</h1>${weeklyTrainingSummary()}${sessionHistorySection()}<div class="card">Le catalogue n’a pas pu être chargé. Vérifie ta connexion puis réessaie.<button class="btn" data-act="retryProgressCatalogue">Réessayer</button></div>`;
    return `<h1>Progrès</h1>${weeklyTrainingSummary()}${sessionHistorySection()}<div class="card mut">Chargement du catalogue…</div>`;
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
  const content = layout === 'mosaic'
    ? Array.from({ length: Math.ceil(exercises.length / 3) }, (_, rowIndex) => {
      const row = exercises.slice(rowIndex * 3, rowIndex * 3 + 3);
      const expanded = row.find(item => item.url === expandedProgressExercise);
      return `<div class="history-mosaic-row">${row.map(historyExerciseCard).join('')}${expanded ? historyExerciseDetails(expanded, true) : ''}</div>`;
    }).join('')
    : exercises.map(item => historyExerciseCard(item) + (item.url === expandedProgressExercise ? historyExerciseDetails(item, false) : '')).join('');
  return `<h1>Progrès</h1>${weeklyTrainingSummary()}${sessionHistorySection()}${warning}${progressControls(exercises)}${exercises.length
    ? `<div class="progress-grid" id="progress-grid" data-layout="${layout}">${content}</div>`
    : '<div class="card mut">Aucun exercice correspondant.</div>'}`;
}
function chart(vals) {
  const W = 320, Hh = 140, p = 26, mn = Math.min(...vals), mx = Math.max(...vals), rg = mx - mn || 1;
  const x = i => vals.length === 1 ? W / 2 : p + i * (W - 2 * p) / (vals.length - 1);
  const y = v => Hh - p - ((v - mn) / rg) * (Hh - 2 * p);
  return `<svg class="chart" viewBox="0 0 ${W} ${Hh}"><polyline fill="none" stroke="var(--acc)" stroke-width="2.5" stroke-linejoin="round"
    points="${vals.map((v, i) => x(i) + ',' + y(v)).join(' ')}"/>
    ${vals.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="3.5" fill="var(--acc)"/>`).join('')}
    <text x="4" y="12">${fmt(mx)} kg</text><text x="4" y="${Hh - 6}">${fmt(mn)} kg</text></svg>`;
}
function sessionBestSet(exercise, session) {
  const ids = new Set(S.exercises.filter(item =>
    item.catalogueUrl === exercise.url || (!item.catalogueUrl && `manual:${item.id}` === exercise.url)
  ).map(item => item.id));
  const matches = session.items.filter(item => ids.has(item.ex) || exName(item.ex, item.n) === exercise.name);
  const sets = matches.flatMap(item => Array.isArray(item.sets) ? item.sets : [])
    .filter(set => Number.isFinite(+set.w) && +set.w >= 0 && Number.isFinite(+set.r) && +set.r > 0);
  return sets.reduce((best, set) => !best || +set.w > +best.w || (+set.w === +best.w && +set.r > +best.r) ? set : best, null);
}
function historyMetricChart(points, field, title, unit) {
  if (!points.length) return '<div class="history-empty">Aucune séance terminée enregistrée pour cet exercice.</div>';
  const values = points.map(point => point[field]);
  const min = Math.min(...values), max = Math.max(...values);
  const padding = max === min ? Math.max(max * .1, 1) : (max - min) * .12;
  const low = Math.max(0, min - padding), high = max + padding;
  const left = 38, right = 330, top = 18, bottom = 145, width = right - left, height = bottom - top;
  const times = points.map(point => new Date(point.date).getTime());
  const firstTime = times[0], span = times[times.length - 1] - firstTime;
  const x = index => span ? left + (times[index] - firstTime) / span * width : left + width / 2;
  const y = value => bottom - (value - low) / (high - low || 1) * height;
  const polyline = points.map((point, index) => `${x(index)},${y(point[field])}`).join(' ');
  const labelIndexes = new Set([0, points.length - 1]);
  if (points.length > 2) {
    const steps = Math.min(4, points.length - 1);
    for (let i = 1; i < steps; i++) labelIndexes.add(Math.round(i * (points.length - 1) / steps));
  }
  const labels = [...labelIndexes].sort((a, b) => a - b).map(index =>
    `<text x="${x(index)}" y="170" text-anchor="middle">${esc(new Date(points[index].date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }))}</text>`
  ).join('');
  const dots = points.map((point, index) => `<circle class="chart-point" cx="${x(index)}" cy="${y(point[field])}" r="4"><title>${esc(new Date(point.date).toLocaleDateString('fr-FR'))} : ${fmt(point[field])} ${unit}</title></circle>`).join('');
  return `<h3>${title}</h3><svg class="history-chart" viewBox="0 0 340 184" role="img" aria-label="${title} par date de séance">
    <line class="chart-axis" x1="${left}" y1="${top}" x2="${left}" y2="${bottom}"/><line class="chart-axis" x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}"/>
    <text x="${left - 5}" y="${top + 3}" text-anchor="end">${fmt(max)}</text><text x="${left - 5}" y="${bottom}" text-anchor="end">${fmt(min)}</text>
    <polyline class="chart-line" points="${polyline}"/>${dots}${labels}
  </svg>`;
}
function historyExerciseCard(exercise) {
  const open = expandedProgressExercise === exercise.url;
  const image = exercise.image ? `<img loading="lazy" src="${esc(exercise.image)}" alt="">` : '';
  return `<article class="card history-exercise-card" data-progress-url="${esc(exercise.url)}" data-progress-name="${esc(exercise.name.toLocaleLowerCase('fr'))}" data-progress-groups="${esc(exercise.groups.join(' '))}">
    <button class="history-exercise-toggle ${image ? 'has-image' : ''}" type="button" data-progress-exercise="${esc(exercise.url)}" aria-expanded="${open}">
      ${image}<span class="history-exercise-name">${esc(exercise.name)}${icon(open ? 'up' : 'down')}</span>
    </button></article>`;
}
function historyExerciseDetails(exercise, mosaic) {
  const points = S.sessions.slice().sort((a, b) => a.date.localeCompare(b.date)).flatMap(session => {
    const best = sessionBestSet(exercise, session);
    return best ? [{ date: session.date, weight: +best.w, reps: +best.r }] : [];
  });
  const details = points.length
    ? `${historyMetricChart(points, 'weight', 'Poids', 'kg')}${historyMetricChart(points, 'reps', 'Répétitions', 'répétitions')}`
    : '<div class="history-empty">Aucune séance terminée enregistrée pour cet exercice.</div>';
  return `<div class="${mosaic ? 'history-mosaic-details' : 'history-details'}" data-progress-details="${esc(exercise.url)}">${details}</div>`;
}
