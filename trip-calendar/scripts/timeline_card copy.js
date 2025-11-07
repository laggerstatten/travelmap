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

  // --- Title logic ---
  let title = seg.name || '(untitled)';

  // --- Time display logic ---
  let metaHTML = 'No date set';
  let driveInfoHTML = 'No date set';

  if (seg.type === 'trip_start') {
    if (seg.end) {
      const endStr = fmtDate(seg.end.utc, seg.timeZone);
      metaHTML = `${endStr || ''}`;
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

  if (seg.type === 'trip_end') {
    if (seg.start) {
      const startStr = fmtDate(seg.start.utc, seg.timeZone);
      metaHTML = `${startStr || ''}`;
    }

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

  if (seg.type === 'stop') {
    if (seg.start || seg.end) {
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

    attachCardEditHandlers(card);
    attachCardDeleteHandlers(card);
    card.querySelector('.fill-forward-btn').onclick = () => fillForward(seg);
    card.querySelector('.fill-backward-btn').onclick = () => fillBackward(seg);
  }

  if (seg.type === 'drive') {
    let origin, dest;
    origin = segments.find((ev) => ev.id === seg.originId);
    dest = segments.find((ev) => ev.id === seg.destinationId);
    const originName = origin?.name || origin?.location_name || 'Unknown';
    const destName = dest?.name || dest?.location_name || 'Unknown';
    title = `Drive: ${originName} → ${destName}`;

    if (seg.start || seg.end) {
      const startStr =
        seg.start && origin
          ? fmtDate(seg.start.utc, origin.timeZone)
          : fmtDate(seg.start.utc, seg.timeZone);
      const endStr =
        seg.end && dest
          ? fmtDate(seg.end.utc, dest.timeZone)
          : fmtDate(seg.end.utc, seg.timeZone);
      metaHTML = `${startStr || ''}${endStr ? ' → ' + endStr : ''}`;
    }

    if (seg.distanceMi) {
      driveInfoHTML = `<div class="drive-info">🚗 ${seg.distanceMi} mi • ${seg.durationMin} min</div>`;
    }

    card.innerHTML = `
    <div class="title">${title}</div>
    <div class="subtitle">
      ${seg.type}${seg.name ? ' • ' + seg.name : ''}
      ${driveInfoHTML}
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

  if (seg.type === 'slack') {
  }

  if (seg.type === 'overlap') {
  }

  attachCardDragHandlers(card);
  attachInsertButton(card, seg);

  // safely bind the fill buttons

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
