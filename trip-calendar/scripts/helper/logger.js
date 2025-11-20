// logger.js
const LOG_HISTORY_KEY = 'action_log';

function logAction(type, payload = {}) {
  const entry = {
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    type,
    payload
  };

  // Print to console for dev
  console.log('%cACTION', 'color:#0af;font-weight:bold', entry);

  // Persist (optional)
  const hist = JSON.parse(localStorage.getItem(LOG_HISTORY_KEY) || '[]');
  hist.push(entry);
  localStorage.setItem(LOG_HISTORY_KEY, JSON.stringify(hist));
}

function clearLog() {
  localStorage.removeItem(LOG_HISTORY_KEY);
}

function getLog() {
  return JSON.parse(localStorage.getItem(LOG_HISTORY_KEY) || '[]');
}
