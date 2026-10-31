'use strict';
/* ============ Minuteur ============ */
function unlockAudio() { // le contexte audio doit être créé après un geste utilisateur (règle iOS)
  try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch (e) { }
}
function beep(n) {
  if (!AC) return;
  const t0 = AC.currentTime;
  for (let i = 0; i < n; i++) {
    const o = AC.createOscillator(), g = AC.createGain(), t = t0 + i * .25;
    o.frequency.value = 880; o.connect(g); g.connect(AC.destination);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.3, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + .18);
    o.start(t); o.stop(t + .2);
  }
}
function startRest(sec, label) {
  // Le minuteur repose sur un horodatage de fin : il reste exact même si iOS suspend la page
  T = { end: Date.now() + sec * 1000, total: sec, label, fired: false };
  tick();
}
function emomTimerFor(item) {
  if (!item.emomTimer || !Number.isFinite(item.emomTimer.remaining)) {
    item.emomTimer = { remaining: S.settings.emom, end: null };
  } else if (!Number.isFinite(item.emomTimer.end)) {
    item.emomTimer.end = null;
  }
  return item.emomTimer;
}
function validateNextEmomSet(item) {
  const set = item.sets.find(candidate => !candidate.done);
  if (!set) return false;
  if (set.w === '') set.w = 0;
  set.emom = true;
  set.done = true;
  return true;
}
function finishEmomExercise(item) {
  const timer = emomTimerFor(item);
  timer.end = null;
  timer.remaining = Math.max(5, num(S.settings.emom) || 60);
  if (S.settings.auto) startRest(S.settings.rest, exName(item.ex, item.n));
}
function tick() {
  const tb = $('#timer');
  if (T) {
    const rem = Math.ceil((T.end - Date.now()) / 1000);
    if (rem <= 0) {
      if (!T.fired) { T.fired = true; if (S.settings.sound) beep(3); if (S.settings.vibrate && navigator.vibrate) navigator.vibrate([200, 100, 200]); }
      if (!S.settings.visualAlert || Date.now() > T.end + 10000) T = null;
    }
    if (T) {
      const done = rem <= 0;
      tb.hidden = false; tb.className = done ? 'done' : '';
      const timeText = done ? 'Repos terminé' : mmss(rem);
      const labelText = T.label || '';
      const time = $('#tt'), label = $('#tl');
      if (time.textContent !== timeText) time.textContent = timeText;
      if (label.textContent !== labelText) label.textContent = labelText;
      const progress = Math.max(0, Math.min(1, rem / T.total));
      $('#bar').style.transform = `scaleX(${progress})`;
    } else tb.hidden = true;
  } else tb.hidden = true;
  const el = $('#elapsed');
  if (el && S.current) { const m = Math.floor((Date.now() - S.current.start) / 60000); el.textContent = '· ' + m + ' min'; }
  let emomChanged = false;
  if (S.current) {
    S.current.items.forEach((item, index) => {
      if (item.timerMode !== 'emom') return;
      const timer = emomTimerFor(item);
      const output = $(`[data-emom-time="${index}"]`);
      const now = Date.now();
      if (timer.end) {
        const duration = Math.max(5, num(S.settings.emom) || 60);
        while (timer.end <= now) {
          if (S.settings.sound) beep(1);
          if (S.settings.vibrate && navigator.vibrate) navigator.vibrate([100]);
          if (S.settings.visualAlert) toast('Cycle EMOM terminé');
          const validated = validateNextEmomSet(item);
          if (!validated) {
            timer.end = null;
            timer.remaining = duration;
            emomChanged = true;
            break;
          }
          if (item.sets.every(set => set.done)) {
            finishEmomExercise(item);
            emomChanged = true;
            break;
          }
          timer.end += duration * 1000;
          emomChanged = true;
        }
        if (timer.end) timer.remaining = Math.max(0, Math.ceil((timer.end - now) / 1000));
      }
      const timeText = mmss(timer.remaining);
      if (output && output.textContent !== timeText) output.textContent = timeText;
    });
  }
  if (emomChanged) {
    save();
    if (tab === 'seance') render();
  }
}
setInterval(tick, 250);
document.addEventListener('visibilitychange', tick);
