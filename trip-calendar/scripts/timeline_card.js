/* ===============================
   Timeline Rendering & Interaction
   =============================== */

   
// --- Build a card ---
function renderCard(seg) {
  const card = document.createElement('div');
  card.className = `segment timeline-card ${seg.type || 'stop'
    } ${cardBadgeClass(seg)}`;
  card.dataset.id = seg.id;

  // --- Title logic ---
  let title = seg.name || '(untitled)';
  let origin, dest;
  if (seg.type === 'drive') {
    origin = segments.find((ev) => ev.id === seg.originId);
    dest = segments.find((ev) => ev.id === seg.destinationId);
    const originName = origin?.name || origin?.location_name || 'Unknown';
    const destName = dest?.name || dest?.location_name || 'Unknown';
    title = `Drive: ${originName} → ${destName}`;
  }

  // --- Time display logic ---
  let metaHTML = 'No date set';
  if (seg.start || seg.end) {
    if (seg.type === 'drive') {
      const startStr =
        seg.start && origin
          ? fmtDate(seg.start, origin.timeZone)
          : fmtDate(seg.start, seg.timeZone);
      const endStr =
        seg.end && dest
          ? fmtDate(seg.end, dest.timeZone)
          : fmtDate(seg.end, seg.timeZone);
      metaHTML = `${startStr || ''}${endStr ? ' → ' + endStr : ''}`;
    } else {
      metaHTML = `${fmtDate(seg.start, seg.timeZone)}${seg.end ? ' → ' + fmtDate(seg.end, seg.timeZone) : ''
        }`;
    }
  }

  card.innerHTML = `
    <div class="title">${title}</div>
    <div class="subtitle">
      ${seg.type || 'stop'}
      ${seg.name ? ' • ' + seg.name : ''}
      ${seg.lat && seg.lon ? `<span class="coord-pill">📍</span>` : ''}
      ${driveInfoHTML(seg)}
    </div>
    <div class="meta">${metaHTML}</div>
    <div class="card-footer">     
      <button class="fill-forward-btn">⏩ Fill Forward</button>
      <button class="fill-backward-btn">⏪ Fill Backward</button>
      <button class="edit-btn">Edit</button>
      <button class="del-btn">Delete</button>
    </div>`;

  attachCardHandlers(card);

  // safely bind the fill buttons
  card.querySelector('.fill-forward-btn').onclick = () => fillForward(seg);
  card.querySelector('.fill-backward-btn').onclick = () => fillBackward(seg);

  return card;
}

// --- Generate drive info snippet ---
function driveInfoHTML(seg) {
  if (seg.nextDistanceMi)
    return `<div class="drive-info">🚗 ${seg.nextDistanceMi} mi • ${seg.nextDurationMin} min</div>`;
  if (seg.type === 'drive' && seg.distanceMi)
    return `<div class="drive-info">🚗 ${seg.distanceMi} mi • ${seg.durationMin} min</div>`;
  return '';
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
