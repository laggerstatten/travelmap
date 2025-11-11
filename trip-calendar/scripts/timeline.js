/* ===============================
   Timeline Rendering & Interaction
   =============================== */


// --- Main render ---
function renderTimeline(segments) {
  const cal = document.getElementById('calendar');
  cal.className = 'timeline';
  cal.innerHTML = '';

  let lastDay = '';
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
      const day = seg.start?.utc ? dayStr(seg.start.utc) : '';
      if (day && day !== lastDay) {
        cal.appendChild(renderDayDivider(day));
        lastDay = day;
      }

    const wrapper = document.createElement('div');
    wrapper.className = 'rail-pair';
    wrapper.appendChild(renderRails());
    wrapper.appendChild(renderCard(seg, segments));
    cal.appendChild(wrapper);
  }

  cal.addEventListener('dragover', handleDragOver);
  cal.addEventListener('drop', (e) => e.preventDefault());
}

// --- Build decorative rails ---
function renderRails() {
  const rails = document.createElement('div');
  rails.className = 'rails';
  rails.innerHTML = `
    <div class="insolation-rail"></div>
    <div class="weather-rail"></div>`;
  return rails;
}

// --- Build a card ---
function renderCard(seg, segments) {
  const card = document.createElement('div');
  card.className = `segment timeline-card ${seg.type || 'stop'} ${cardBadgeClass(seg)}`;
  card.dataset.id = seg.id;
  // For drive cards, use the passed-in `segments` to resolve origin/dest.

  let title = seg.name || '(untitled)';
  let metaHTML = 'No date set';
  let driveInfoHTML = '';

  // ───────────────────────────────
  // Trip start
  // ───────────────────────────────
  if (seg.type === 'trip_start') {
    console.log('renderCard - trip_start');
    if (seg.end?.utc) metaHTML = fmtDate(seg.end.utc, seg.timeZone);

    card.innerHTML = `
      <div class="title">${title}</div>
      <div class="subtitle">
      ${seg.type}${seg.name ? ' • ' + seg.name : ''}
      ${seg.coordinates ? `<span class="coord-pill">📍</span>` : ''}
      </div>
      <div class="meta">${metaHTML}</div>
      <div class="card-footer">
        <button class="fill-forward-btn">⏩ Fill Forward</button>
        <button class="edit-btn">Edit</button>
      </div>`;
    card.querySelector('.edit-btn').onclick = () => editSegment(seg, card);
    card.querySelector('.fill-forward-btn').onclick = () => { fillForward(seg); renderTimeline(syncGlobal()); };
  }

    // ───────────────────────────────
  // Trip end
  // ───────────────────────────────
  else if (seg.type === 'trip_end') {
    console.log('renderCard - trip_end');
    if (seg.start?.utc) metaHTML = fmtDate(seg.start.utc, seg.timeZone);

    card.innerHTML = `
      <div class="title">${title}</div>
      <div class="subtitle">
      ${seg.type}${seg.name ? ' • ' + seg.name : ''}
      ${seg.coordinates ? `<span class="coord-pill">📍</span>` : ''}
    </div>
      <div class="meta">${metaHTML}</div>
      <div class="card-footer">
        <button class="fill-backward-btn">⏪ Fill Backward</button>
        <button class="edit-btn">Edit</button>
      </div>`;
    card.querySelector('.edit-btn').onclick = () => editSegment(seg, card);
    card.querySelector('.fill-backward-btn').onclick = () => { fillBackward(seg); renderTimeline(syncGlobal()); };
  }

  // ───────────────────────────────
  // Stop
  // ───────────────────────────────
  else if (seg.type === 'stop') {
    if (seg.start?.utc || seg.end?.utc) {
      const startStr = fmtDate(seg.start.utc, seg.timeZone);
      const endStr = fmtDate(seg.end.utc, seg.timeZone);
      metaHTML = `${startStr || ''}${endStr ? ' → ' + endStr : ''}`;
    }

    card.innerHTML = `
      <div class="title">${title}</div>
      <div class="subtitle">
      ${seg.type}${seg.name ? ' • ' + seg.name : ''}
      ${seg.coordinates ? `<span class="coord-pill">📍</span>` : ''}
    </div>
      <div class="meta">${metaHTML}</div>
      <div class="card-footer">
        <button class="fill-forward-btn">⏩ Fill Forward</button>
        <button class="fill-backward-btn">⏪ Fill Backward</button>
        ${
          seg.isQueued
            ? `<button class="insert-btn small">Insert into Route</button>`
            : ''
        }
        <button class="edit-btn">Edit</button>
        <button class="del-btn">Delete</button>
      </div>`;

    card.querySelector('.edit-btn').onclick = () => editSegment(seg, card);
    seg.isQueued
      ? (card.querySelector('.insert-btn').onclick = async () =>
          insertQueuedSegment(seg, card))
      : '';
    card.querySelector('.del-btn').onclick = () => { deleteSegment(seg, card); renderTimeline(syncGlobal()); };
    card.querySelector('.fill-forward-btn').onclick = () => { fillForward(seg); renderTimeline(syncGlobal()); };
    card.querySelector('.fill-backward-btn').onclick = () => { fillBackward(seg); renderTimeline(syncGlobal()); };
  }

  // ───────────────────────────────
  // Drive
  // ───────────────────────────────
  else if (seg.type === 'drive') {
    const origin = segments.find((ev) => ev.id === seg.originId);
    const dest = segments.find((ev) => ev.id === seg.destinationId);
    const originName = origin?.name || origin?.location_name || 'Unknown';
    const destName = dest?.name || dest?.location_name || 'Unknown';
    title = `Drive: ${originName} → ${destName}`;

    if (seg.start?.utc || seg.end?.utc) {
      const startStr = fmtDate(seg.start.utc, origin?.timeZone || seg.timeZone);
      const endStr = fmtDate(seg.end.utc, dest?.timeZone || seg.timeZone);
      metaHTML = `${startStr || ''}${endStr ? ' → ' + endStr : ''}`;
    }

    if (seg.distanceMi) {
      driveInfoHTML = `<div class="drive-info">🚗 ${seg.distanceMi} mi • ${seg.durationMin} min</div>`;
    }

    card.innerHTML = `
      <div class="title">${title}</div>
      <div class="subtitle">
      ${seg.type}${seg.name ? ' • ' + seg.name : ''}${driveInfoHTML}
    </div>
      <div class="meta">${metaHTML}</div>
      <div class="card-footer">
        <button class="fill-forward-btn">⏩ Fill Forward</button>
        <button class="fill-backward-btn">⏪ Fill Backward</button>
        <button class="edit-btn">Edit</button>
        <button class="del-btn">Delete</button>
      </div>`;

    card.querySelector('.edit-btn').onclick = () => editSegment(seg, card);
    card.querySelector('.del-btn').onclick = () => { deleteSegment(seg, card); renderTimeline(syncGlobal()); };
  }

  // ───────────────────────────────
  // Slack
  // ───────────────────────────────
  else if (seg.type === 'slack') {
    const startStr = fmtDate(seg.start.utc);
    const endStr = fmtDate(seg.end.utc);
    metaHTML = `${startStr} → ${endStr}`;
    const hours =
      seg.duration?.val?.toFixed(2) ?? (seg.minutes / 60).toFixed(2);

    card.innerHTML = `
      <div class="title">Slack (${hours}h)</div>
      <div class="subtitle">Gap between ${seg.a} → ${seg.b}</div>
      <div class="meta">${metaHTML}</div>`;
  }

    // ───────────────────────────────
  // Overlap
  // ───────────────────────────────
  else if (seg.type === 'overlap') {
    const startStr = fmtDate(seg.start.utc);
    const endStr = fmtDate(seg.end.utc);
    metaHTML = `${startStr} → ${endStr}`;
    const hours =
      seg.duration?.val?.toFixed(2) ?? (seg.minutes / 60).toFixed(2);

    card.innerHTML = `
      <div class="title">Overlap (${hours}h)</div>
      <div class="subtitle">Conflict between ${seg.a} ↔ ${seg.b}</div>
      <div class="meta">${metaHTML}</div>`;
  }

  attachCardDragHandlers(card);

  // Auto-open editor
  if (seg.openEditor) {
    console.log('openEditor');
    // Avoid duplicates if already editing
    if (!card.querySelector('.oncard-editor')) {
      buildOnCardEditor(seg, card);
    }
  }

  return card;
}

function cardBadgeClass(seg) {
  if (seg.type !== 'drive') return '';
  if (seg.autoDrive && !seg.manualEdit) return 'auto';
  if (seg.manualEdit) return 'edited';
  return 'manual';
}

// --- Build single day divider ---
function renderDayDivider(day) {
  const div = document.createElement('div');
  div.className = 'day-divider';
  div.textContent = day;
  return div;
}
















