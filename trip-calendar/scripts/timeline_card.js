/* ===============================
   Timeline Rendering & Interaction
   =============================== */


// --- Build a card ---
function renderCard(e) {
  const card = document.createElement('div');
  card.className = `event timeline-card ${e.type || 'stop'} ${cardBadgeClass(e)}`;
  card.dataset.id = e.id;

  // title logic
  let title = e.name || '(untitled)';
  if (e.type === 'drive') {
    const origin = events.find(ev => ev.id === e.originId);
    const dest = events.find(ev => ev.id === e.destinationId);
    const originName = origin?.name || origin?.location_name || 'Unknown';
    const destName = dest?.name || dest?.location_name || 'Unknown';
    title = `Drive: ${originName} → ${destName}`;
  }

  card.innerHTML = `
    <div class="title">${title}</div>
    <div class="subtitle">
      ${e.type || 'stop'}
      ${e.location_name ? ' • ' + e.location_name : ''}
      ${e.lat && e.lon ? `<span class="coord-pill">📍</span>` : ''}
      ${driveInfoHTML(e)}
    </div>
    <div class="meta">
      ${e.start || e.end
        ? `${fmtDate(e.start)}${e.end ? ' → ' + fmtDate(e.end) : ''}`
        : 'No date set'}
    </div>
    <div class="card-footer">
      <button class="fill-forward-btn">⏩ Fill Forward</button>
      <button class="fill-backward-btn">⏪ Fill Backward</button>
      <button class="edit-btn">Edit</button>
      <button class="del-btn">Delete</button>
    </div>`;

  attachCardHandlers(card);

  // safely bind the fill buttons
  card.querySelector('.fill-forward-btn').onclick = () => fillForward(e);
  card.querySelector('.fill-backward-btn').onclick = () => fillBackward(e);

  return card;
}

// --- Generate drive info snippet ---
function driveInfoHTML(e) {
    if (e.nextDistanceMi)
        return `<div class="drive-info">🚗 ${e.nextDistanceMi} mi • ${e.nextDurationMin} min</div>`;
    if (e.type === 'drive' && e.distanceMi)
        return `<div class="drive-info">🚗 ${e.distanceMi} mi • ${e.durationMin} min</div>`;
    return '';
}


/* ===============================
   Data Operations
   =============================== */

function deleteEventById(id) {
    const idx = events.findIndex(e => String(e.id) === String(id));
    if (idx !== -1) {
        events.splice(idx, 1);
        save();
    }
}


/* ===============================
   Styling helpers
   =============================== */

function cardBadgeClass(e) {
    if (e.type !== 'drive') return '';
    if (e.autoDrive && !e.manualEdit) return 'auto';
    if (e.manualEdit) return 'edited';
    return 'manual';
}