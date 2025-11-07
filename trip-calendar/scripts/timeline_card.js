/* ===============================
   Timeline Rendering & Interaction
   =============================== */

// --- Build a card ---
function renderCard(seg) {
  const card = document.createElement('div');
  card.className = `segment timeline-card ${
    seg.type || 'stop'
  } ${cardBadgeClass(seg)}`;
  card.dataset.id = seg.id;

  let title = seg.name || '(untitled)';
  let metaHTML = 'No date set';
  let driveInfoHTML = '';

  // ───────────────────────────────
  // Trip start
  // ───────────────────────────────
  if (seg.type === 'trip_start') {
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
        ${
          seg.isQueued
            ? `<button class="insert-btn small">Insert into Route</button>`
            : ''
        }
        <button class="edit-btn">Edit</button>
      </div>`;
    attachCardEditHandlers(card);
    card.querySelector('.fill-forward-btn').onclick = () => fillForward(seg);
  }

  // ───────────────────────────────
  // Trip end
  // ───────────────────────────────
  else if (seg.type === 'trip_end') {
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
        ${
          seg.isQueued
            ? `<button class="insert-btn small">Insert into Route</button>`
            : ''
        }
        <button class="edit-btn">Edit</button>
      </div>`;
    attachCardEditHandlers(card);
    card.querySelector('.fill-backward-btn').onclick = () => fillBackward(seg);
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
      ${
      seg.coordinates ? `<span class="coord-pill">📍</span>` : ''
    }
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

    attachCardEditHandlers(card);
    attachCardDeleteHandlers(card);
    card.querySelector('.fill-forward-btn').onclick = () => fillForward(seg);
    card.querySelector('.fill-backward-btn').onclick = () => fillBackward(seg);
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
      ${seg.type}${      seg.name ? ' • ' + seg.name : ''
    }${driveInfoHTML}
    </div>
      <div class="meta">${metaHTML}</div>
      <div class="card-footer">
        <button class="fill-forward-btn">⏩ Fill Forward</button>
        <button class="fill-backward-btn">⏪ Fill Backward</button>
        <button class="edit-btn">Edit</button>
        <button class="del-btn">Delete</button>
      </div>`;

    attachCardEditHandlers(card);
    attachCardDeleteHandlers(card);
    card.querySelector('.fill-forward-btn').onclick = () => fillForward(seg);
    card.querySelector('.fill-backward-btn').onclick = () => fillBackward(seg);
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
  attachInsertButton(card, seg);
  return card;
}

/* ===============================
   Data Operations
   =============================== */

function deleteSegmentById(id) {
  const idx = segments.findIndex((seg) => String(seg.id) === String(id));
  if (idx !== -1) {
    segments.splice(idx, 1);
    save();
  }
}

/* ===============================
   Styling helpers
   =============================== */

function cardBadgeClass(seg) {
  if (seg.type !== 'drive') return '';
  if (seg.autoDrive && !seg.manualEdit) return 'auto';
  if (seg.manualEdit) return 'edited';
  return 'manual';
}

function attachInsertButton(card, seg) {
  const insertBtn = card.querySelector('.insert-btn');
  if (!insertBtn) return;

  insertBtn.addEventListener('click', async () => {
    if (!seg.coordinates) {
      alert('Please select a location before inserting this stop.');
      return;
    }

    // Confirm action
    if (!confirm(`Insert "${seg.name || 'this stop'}" into route?`)) return;

    try {
      delete seg.isQueued;
      await insertStopInNearestRoute(seg, segments);
      save();
      renderTimeline();
    } catch (err) {
      console.error('Error inserting stop:', err);
      alert('Failed to insert stop into route.');
    }
  });
}
