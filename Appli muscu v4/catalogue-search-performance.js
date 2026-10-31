'use strict';

const searchTimers = new WeakMap();
const replayedSearchEvents = new WeakSet();

document.addEventListener('input', event => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.id !== 'q' || replayedSearchEvents.has(input)) return;

  // Laisse la saisie immédiate, mais ne relance le filtrage qu'après une courte pause.
  event.stopImmediatePropagation();
  clearTimeout(searchTimers.get(input));
  searchTimers.set(input, setTimeout(() => {
    searchTimers.delete(input);
    replayedSearchEvents.add(input);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    replayedSearchEvents.delete(input);
  }, 150));
}, true);
