// --- Main render ---
function renderTimeline() {
  let segments = JSON.parse(localStorage.getItem('tripSegments')) || [];

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
    wrapper.appendChild(renderCard(seg));
    cal.appendChild(wrapper);
  }

  cal.addEventListener('dragover', handleDragOver);
  cal.addEventListener('drop', (e) => e.preventDefault());
}

// --- Build a card ---
function renderCard(seg) {
  let segments = JSON.parse(localStorage.getItem('tripSegments')) || [];

  const card = document.createElement('div');
  card.className = `segment timeline-card ${
    seg.type || 'stop'
  } ${cardBadgeClass(seg)}`;

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
    card.querySelector('.fill-forward-btn').onclick = () => fillForward(seg);
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
    card.querySelector('.del-btn').onclick = () => deleteSegment(seg, card);
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
    card.querySelector('.del-btn').onclick = () => deleteSegment(seg, card);
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

function handleEditorSubmit(editor, seg, card) {
  editor.addEventListener('submit', (submitEv) => {
    submitEv.preventDefault();

    const formData = Object.fromEntries(new FormData(editor).entries());
    console.log(formData);
    const prev = structuredClone(seg); // full copy

    // ✅ Ensure nested structure exists
    seg.start ??= { utc: '', lock: 'unlocked' };
    seg.end ??= { utc: '', lock: 'unlocked' };
    seg.duration ??= { val: null, lock: 'unlocked' };

    // Parse numeric duration
    const durVal = formData['duration']?.trim()
      ? Number(formData['duration'])
      : null;

    // Convert form times to UTC
    const newStartUTC = formData['start']
      ? localToUTC(formData['start'], seg.timeZone)
      : '';
    const newEndUTC = formData['end']
      ? localToUTC(formData['end'], seg.timeZone)
      : '';

    // Only set hard locks if user explicitly changed or field was previously unlocked
    if (newStartUTC && newStartUTC !== prev.start?.utc) {
      seg.start.utc = newStartUTC;
      if (seg.start.lock !== 'hard') seg.start.lock = 'unlocked';
    }
    if (newEndUTC && newEndUTC !== prev.end?.utc) {
      seg.end.utc = newEndUTC;
      if (seg.end.lock !== 'hard') seg.end.lock = 'unlocked';
    }
    if (durVal !== null && durVal !== Number(prev.duration?.val || 0)) {
      seg.duration.val = durVal;
      if (seg.duration.lock !== 'hard') seg.duration.lock = 'unlocked';
    }

    // Preserve any existing soft/unlocked states
    seg.start.lock ??= prev.start?.lock || 'unlocked';
    seg.end.lock ??= prev.end?.lock || 'unlocked';
    seg.duration.lock ??= prev.duration?.lock || 'unlocked';

    // Apply derived/soft lock logic
    updateLockConsistency(seg);

    seg.name = formData.name || '';
    seg.type = formData.type || 'stop';

    if (seg.type === 'drive' && seg.autoDrive) {
      seg.manualEdit = true;
      seg.autoDrive = false;
    }

    card.classList.remove('editing');
    editor.remove();
    if (
      seg.isQueued &&
      (seg.type === 'trip_start' || seg.type === 'trip_end')
    ) {
      seg.isQueued = false;
    }

    if (seg.openEditor) {
      seg.openEditor = false;
    }

    //save();
    //localStorage.setItem('tripSegments', JSON.stringify(segments));
    //console.log('save');

    renderTimeline();
  });
}

function handleDragOver(e) {
  e.preventDefault();
  const cal = e.currentTarget;
  const dragging = cal.querySelector('.timeline-card.dragging');
  if (!dragging) return;

  // find card immediately after the cursor
  const after = getDragAfterElement(cal, e.clientY);
  const rails = dragging.closest('.rail-pair');
  if (!rails) return;

  const draggingWrapper = rails; // move the whole pair, not just card

  if (after) {
    cal.insertBefore(draggingWrapper, after.closest('.rail-pair'));
  } else {
    cal.appendChild(draggingWrapper);
  }
}


/* ===============================
   Fill FORWARD (UTC) — Lock-Aware
   =============================== */
function fillForward(fromSegment) {
  const idx = segments.findIndex((ev) => ev.id === fromSegment.id);
  if (idx === -1) return;

  const fromStart = fromSegment.start ?.utc;
  const fromEnd = fromSegment.end ?.utc;
  let cursor = fromEnd || fromStart;
  if (!cursor) return;

  for (let i = idx + 1; i < segments.length; i++) {
    const seg = segments[i];

    // --- normalize nested objects ---
    seg.start ??= { utc: '', lock: 'unlocked' };
    seg.end ??= { utc: '', lock: 'unlocked' };
    seg.duration??= { val: null, lock: 'unlocked' };

    // --- Skip slack / overlap segments ---
    if (seg.type === 'slack' || seg.type === 'overlap') continue;

    // --- Stop if start is hard/soft locked ---
    if (['hard', 'soft'].includes(seg.start.lock)) break;

    // --- Trip end special handling ---
    if (seg.type === 'trip_end') {
      if (!['hard', 'soft'].includes(seg.start.lock)) {
        seg.start.utc = cursor;
        seg.start.lock = 'auto';
      }
      break;
    }

    // --- Propagate start ---
    if (!['hard', 'soft'].includes(seg.start.lock)) {
      seg.start.utc = cursor;
      seg.start.lock = 'auto';
    }

    // --- Propagate end ---
    const durHrs = Number(seg.duration.val) || 0;
    if (!['hard', 'soft'].includes(seg.end.lock)) {
      seg.end.utc = addMinutesUTC(seg.start.utc, durHrs * 60);
      seg.end.lock = 'auto';
    }

    cursor = seg.end.utc || seg.start.utc;
  }

  //save();
  localStorage.setItem('tripSegments', JSON.stringify(segments));
  console.log('save');
  renderTimeline();
}

/* ===============================
   Fill BACKWARD (UTC) — Lock-Aware
   =============================== */
function fillBackward(fromSegment) {
  const idx = segments.findIndex((ev) => ev.id === fromSegment.id);
  if (idx === -1) return;

  const fromStart = fromSegment.start ?.utc;
  const fromEnd = fromSegment.end ?.utc;
  let cursor = fromStart || fromEnd;
  if (!cursor) return;

  for (let i = idx - 1; i >= 0; i--) {
    const seg = segments[i];

    // --- normalize nested objects ---
    seg.start ??= { utc: '', lock: 'unlocked' };
    seg.end ??= { utc: '', lock: 'unlocked' };
    seg.duration ??= { val: null, lock: 'unlocked' };

    // --- Skip slack / overlap segments ---
    if (seg.type === 'slack' || seg.type === 'overlap') continue;

    // --- Stop if end is hard/soft locked ---
    if (['hard', 'soft'].includes(seg.end.lock)) break;

    // --- Trip start special handling ---
    if (seg.type === 'trip_start') {
      if (!['hard', 'soft'].includes(seg.end.lock)) {
        seg.end.utc = cursor;
        seg.end.lock = 'auto';
      }
      break;
    }

    // --- Propagate end ---
    if (!['hard', 'soft'].includes(seg.end.lock)) {
      seg.end.utc = cursor;
      seg.end.lock = 'auto';
    }

    // --- Propagate start ---
    const durHrs = Number(seg.duration.val) || 0;
    if (!['hard', 'soft'].includes(seg.start.lock)) {
      seg.start.utc = addMinutesUTC(seg.end.utc, -durHrs * 60);
      seg.start.lock = 'auto';
    }

    cursor = seg.start.utc || seg.end.utc;
  }

  save();
  renderTimeline();
}


function computeSlackAndOverlap(segments) {
    console.log('computeSlackAndOverlap');

    // Remove existing slack/overlap entries
    for (let i = segments.length - 1; i >= 0; i--) {
        if (segments[i].type === 'slack' || segments[i].type === 'overlap') {
            segments.splice(i, 1);
        }
    }

    // Build a working copy excluding derived types
    const baseSegments = segments.filter(
        (s) => s.type !== 'slack' && s.type !== 'overlap'
    );

    // Insert new derived events directly into the global array
    for (let i = 0; i < baseSegments.length - 1; i++) {
        const cur = baseSegments[i];
        const next = baseSegments[i + 1];
        const curEnd = cur.end?.utc;
        const nextStart = next.start ?.utc;
        if (!curEnd || !nextStart) continue;

        const startDate = new Date(curEnd);
        const endDate = new Date(nextStart);
        const diffMin = (endDate - startDate) / 60000;

        if (diffMin > 0) {
            const slack = {
                id: crypto.randomUUID(),
                type: 'slack',
                name: 'Slack',
                a: cur.id,
                b: next.id,
                start: { utc: curEnd },
                end: { utc: nextStart },
                duration: { val: diffMin / 60 },
                minutes: diffMin
            };
            const insertIndex = segments.findIndex((s) => s.id === next.id);
            segments.splice(insertIndex, 0, slack);
        } else if (diffMin < 0) {
            const overlapMin = -diffMin;
            const overlap = {
                id: crypto.randomUUID(),
                type: 'overlap',
                name: 'Overlap',
                a: cur.id,
                b: next.id,
                start: { utc: nextStart },
                end: { utc: curEnd },
                duration: { val: overlapMin / 60 },
                minutes: overlapMin
            };
            const insertIndex = segments.findIndex((s) => s.id === next.id);
            segments.splice(insertIndex, 0, overlap);
        }
    }
    console.log('Segments after recompute:', segments);
}

function editSegment(seg, card) {
  if (card.classList.contains('editing')) return;
  card.classList.add('editing');
  const editor = buildOnCardEditor(seg, card);
}

async function insertQueuedSegment(seg, card) {
  delete seg.isQueued;
  delete seg.openEditor;
  await insertStopInNearestRoute(seg, segments);
}

function deleteSegment(seg, card) {
  const id = seg.id;
  deleteSegmentById(id);
  renderTimeline();
}

function deleteSegmentById(id) {
  const idx = segments.findIndex((seg) => String(seg.id) === String(id));
  if (idx !== -1) {
    segments.splice(idx, 1);
    save();
  }
}



/* ===============================
   Trip Initialization (Async)
   =============================== */
async function initTrip() {
  console.log('Initializing trip...');
  let segments = JSON.parse(localStorage.getItem('tripSegments')) || [];
  queueTripOrigin(segments);
  queueTripDestination(segments);

  //save();
  localStorage.setItem('tripSegments', JSON.stringify(segments));
  console.log('save');
  renderTimeline();

  // Wait until both anchors are committed (unqueued)
  segments = JSON.parse(localStorage.getItem('tripSegments')) || [];
  await waitForTripAnchorsReady(segments);
  await validateAndRepair();

  // Identify trip anchors
  const origin = segments.find(s => s.type === 'trip_start');
  const destination = segments.find(s => s.type === 'trip_end');

  // Determine fill direction
  let filled = false;

  if (origin?.end?.utc && origin.end.lock === 'hard') {
    console.log('Origin hard-locked — filling forward...');
    fillForward(origin);
    filled = true;
  } else if (destination?.start?.utc && destination.start.lock === 'hard') {
    console.log('Destination hard-locked — filling backward...');
    fillBackward(destination);
    filled = true;
  } else {
    // No hard locks: try forward first, then backward
    if (origin?.end?.utc) {
      console.log('No hard lock — filling forward...');
      fillForward(origin);
      filled = true;
    } else if (destination?.start?.utc) {
      console.log('No hard lock — filling backward...');
      fillBackward(destination);
      filled = true;
    }
  }

  if (!filled) console.warn('No anchor times available — skipping fill.');

  //save();
  localStorage.setItem('tripSegments', JSON.stringify(segments));
  console.log('save');
  renderTimeline();

  // Compute slack and overlap events
  console.log('Computing slack/overlap...');
  segments = JSON.parse(localStorage.getItem('tripSegments')) || [];
  computeSlackAndOverlap(segments);

  //save();
  localStorage.setItem('tripSegments', JSON.stringify(segments));
  console.log('save');
  renderTimeline();

  console.log('Trip initialization complete.');
}


/* ===============================
   Helper: Wait for Anchors Ready
   =============================== */
function waitForTripAnchorsReady(segments) {
  return new Promise((resolve) => {
    const check = () => {
      const startReady = segments.some(
        (s) => s.type === 'trip_start' && !s.isQueued
      );
      const endReady = segments.some(
        (s) => s.type === 'trip_end' && !s.isQueued
      );
      if (startReady && endReady) {
        resolve();
      } else {
        requestAnimationFrame(check); // efficient lightweight loop
      }
    };
    check();
  });
}

/* ===============================
   Queue Trip Origin / Destination
   =============================== */
function queueTripOrigin(segments) {
  const seg = {
    id: newId(),
    name: '(untitled)',
    type: 'trip_start',
    isAnchorStart: true,
    start: { lock: 'undefined', utc: '' },
    end: { lock: 'hard', utc: '' },
    isQueued: true,
    openEditor: true
  };

  segments.unshift(seg);
  //save();
  //renderTimeline();
}

function queueTripDestination(segments) {
  const seg = {
    id: newId(),
    name: '(untitled)',
    type: 'trip_end',
    isAnchorEnd: true,
    start: { lock: 'hard', utc: '' },
    end: { lock: 'undefined', utc: '' },
    isQueued: true,
    openEditor: true
  };

  segments.push(seg);
  //save();
  //renderTimeline();
}

/* ===============================
   Queue Trip Stop
   =============================== */
function queueStop(segments) {
  const seg = {
    id: newId(),
    name: '(untitled)',
    type: 'stop',
    isQueued: true,
    openEditor: true
  };

  segments.unshift(seg);
  //save();
  localStorage.setItem('tripSegments', JSON.stringify(segments));
  console.log('save');
  renderTimeline();
}



/* ===============================
   Trip Validation & Repair Module
   =============================== */

async function validateAndRepair() {
  // edit for slack / overlap

  removeAdjacentDrives();

  segments = segments.filter((seg) => {
    if (seg.type !== 'drive') return true;
    const origin = segments.find((x) => x.id === seg.originId);
    const dest = segments.find((x) => x.id === seg.destinationId);
    if (!origin || !dest) {
      return false;
    }
    return true;
  });

  insertDriveSegments();

  await generateRoutes();
  //save();
  localStorage.setItem('tripSegments', JSON.stringify(segments));
  console.log('save');
  renderTimeline();
}

function removeAdjacentDrives() {
  // edit for slack / overlap

  let removed = 0;
  for (let i = 0; i < segments.length - 1; i++) {
    const a = segments[i];
    const b = segments[i + 1];
    if (a.type === 'drive' && b.type === 'drive') {
      segments.splice(i, 2); // remove both
      removed += 2;
      i--; // step back to recheck next pair
    }
  }

  if (removed > 0) {
    //save();
    localStorage.setItem('tripSegments', JSON.stringify(segments));
    console.log('save');
    renderTimeline();
  }
}

function insertDriveSegments() {
  //edit to ignore slack and overlaps
  sortByDateInPlace(segments);
  const out = [];
  for (let i = 0; i < segments.length; i++) {
    const cur = segments[i];
    out.push(cur);
    const next = segments[i + 1];
    if (!next) break;
    if (cur.type !== 'drive' && next.type !== 'drive') {
      out.push({
        id: newId(),
        name: `Drive from ${cur.name || 'current stop'} to ${
          next.name || 'next stop'
        }`,
        type: 'drive',
        autoDrive: true,
        manualEdit: false,
        originId: cur.id,
        destinationId: next.id
        //start: cur.end || '',
        //end: ''
      });
    }
  }
  segments = out;
  //save();
  localStorage.setItem('tripSegments', JSON.stringify(segments));
  console.log('save');
}

function sortByDateInPlace(list) {
  const dated = list.filter((seg) => parseDate(seg.start.utc));
  dated.sort((a, b) => parseDate(a.start.utc) - parseDate(b.start.utc));

  const merged = [];
  let di = 0;
  for (const seg of list) {
    if (!parseDate(seg.start.utc)) merged.push(seg);
    else merged.push(dated[di++]);
  }
  list.splice(0, list.length, ...merged);
}

function parseDate(v) {
  const d = new Date(v);
  return isNaN(d) ? null : d;
}

async function generateRoutes() {
  for (const seg of segments) {
    if (seg.type !== 'drive') continue;

    // Use explicit IDs first
    const origin = segments.find((ev) => ev.id === seg.originId);
    const destination = segments.find((ev) => ev.id === seg.destinationId);

    // Fallback: nearest non-drive neighbors
    const originAlt =
      origin ||
      [...segments.slice(0, segments.indexOf(seg))]
        .reverse()
        .find((ev) => ev.coordinates[1] && ev.coordinates[0]);
    const destAlt =
      destination ||
      segments
        .slice(segments.indexOf(seg) + 1)
        .find((ev) => ev.coordinates[1] && ev.coordinates[0]);
    const from = originAlt;
    const to = destAlt;

    if (!from || !to) {
      continue;
    }

    try {
      const route = await getRouteInfo(from, to);
      if (route) {
        seg.autoDrive = true;
        seg.routeGeometry = route.geometry;
        seg.distanceMi = route.distance_mi.toFixed(1);
        seg.durationMin = route.duration_min.toFixed(0);
        seg.durationHr = (route.duration_min / 60).toFixed(2);
        seg.duration = {val: (route.duration_min / 60).toFixed(2), lock: 'hard'};
        seg.originId = from.id;
        seg.destinationId = to.id;
      }
    } catch (err) {}
  }

  //save();
  localStorage.setItem('tripSegments', JSON.stringify(segments));
  console.log('save');
  renderTimeline();
}

async function insertStopInNearestRoute(stop, segments) {
  const drives = segments.filter(
    (ev) => ev.type === 'drive' && ev.routeGeometry
  );
  if (!drives.length) {
    return;
  }

  let bestDrive = null;
  let bestDist = Infinity;
  for (const d of drives) {
    const coords = d.routeGeometry?.coordinates;
    if (!coords?.length) {
      continue;
    }
    const mid = coords[Math.floor(coords.length / 2)];
    const dx = stop.coordinates[0] - mid[0];
    const dy = stop.coordinates[1] - mid[1];
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < bestDist) {
      bestDist = dist;
      bestDrive = d;
    }
  }
  if (!bestDrive) {
    return;
  }

  const origin = segments.find((seg) => seg.id === bestDrive.originId);
  const destination = segments.find(
    (seg) => seg.id === bestDrive.destinationId
  );

  if (!origin || !destination) {
    return;
  }

  if (!origin.coordinates || !destination.coordinates) {
    return;
  }

  const r1 = await getRouteInfo(origin, stop);

  const r2 = await getRouteInfo(stop, destination);

  if (!r1 || !r2) {
    return;
  }

  const newDrive1 = {
    id: newId(),
    type: 'drive',
    autoDrive: true,
    routeGeometry: r1.geometry,
    distanceMi: r1.distance_mi.toFixed(1),
    durationMin: r1.duration_min.toFixed(0),
    durationHr: (r1.duration_min / 60).toFixed(2),
    duration: {
      val: (r1.duration_min / 60).toFixed(2),
      lock: 'hard'
    },
    originId: origin.id,
    destinationId: stop.id
  };

  const newDrive2 = {
    id: newId(),
    type: 'drive',
    autoDrive: true,
    routeGeometry: r2.geometry,
    distanceMi: r2.distance_mi.toFixed(1),
    durationMin: r2.duration_min.toFixed(0),
    durationHr: (r2.duration_min / 60).toFixed(2),
    duration: {
      val: (r2.duration_min / 60).toFixed(2),
      lock: 'hard'
    },
    originId: stop.id,
    destinationId: destination.id
  };

  // remove temp and replace old drive
  const tempIndex = segments.findIndex((seg) => seg.id === stop.id);
  if (tempIndex !== -1) segments.splice(tempIndex, 1);

  const driveIndex = segments.findIndex((seg) => seg.id === bestDrive.id);
  if (driveIndex === -1) {
    return;
  }

  segments.splice(driveIndex, 1, newDrive1, stop, newDrive2);

  //save();
  localStorage.setItem('tripSegments', JSON.stringify(segments));
  console.log('save');
  renderTimeline();
}
















