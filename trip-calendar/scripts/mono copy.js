function clearTimesAndDurations(opts = {}) {
  const { onlyUnlocked = false } = opts;

  let message = onlyUnlocked ?
    'Clear all non-locked times and durations?' :
    'Clear all start/end times and durations?';

  if (!confirm(message)) return;

  segments.forEach((seg) => {
    // Ensure nested structure exists
    seg.start ? ? = { utc: '', lock: 'unlocked' };
    seg.end ? ? = { utc: '', lock: 'unlocked' };
    seg.duration ? ? = { val: null, lock: 'unlocked' };

    const clearIf = (lock) => !onlyUnlocked || lock !== 'hard';

    if (clearIf(seg.start.lock)) {
      seg.start.utc = '';
      seg.start.lock = 'unlocked';
    }

    if (clearIf(seg.end.lock)) {
      seg.end.utc = '';
      seg.end.lock = 'unlocked';
    }

    if (clearIf(seg.duration.lock)) {
      seg.duration.val = null;
      seg.duration.lock = 'unlocked';
    }

    if (seg.type === 'drive') {
      seg.duration.val = seg.durationHr;
      seg.duration.lock = 'auto';
    }

    // Clear transient manual flags
    delete seg.manualEdit;
  });

  save();
  renderTimeline();
}

async function insertQueuedStops(segments) {
  const queued = segments.filter((s) => s.isQueued);
  if (!queued.length) {
    alert('No queued stops to insert.');
    return;
  }

  // Example: show a selection dialog, or auto-insert sequentially
  for (const stop of queued) {
    if (!stop.coordinates) continue; // skip incomplete
    delete stop.isQueued;
    await insertStopInNearestRoute(stop, segments);
  }

  save();
  renderTimeline();
}


/* ===============================
   Nudge Tools
   =============================== */

function shiftTime(dt, minutes) {
  if (!dt) return dt;
  const t = new Date(dt);
  t.setMinutes(t.getMinutes() + minutes);

  // format for <input type="datetime-local"> (local time, no timezone)
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = t.getFullYear();
  const mm = pad(t.getMonth() + 1);
  const dd = pad(t.getDate());
  const hh = pad(t.getHours());
  const min = pad(t.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function nudgeEvent(event, minutes, cascade = false) {
  const idx = events.findIndex((ev) => ev.id === event.id);
  if (idx === -1) return;

  const delta = minutes;

  // shift current event
  if (!event.manualStart && event.start)
    event.start = shiftTime(event.start, delta);
  if (!event.manualEnd && event.end) event.end = shiftTime(event.end, delta);

  // cascade to later events until hitting a manual one
  if (cascade) {
    for (let i = idx + 1; i < events.length; i++) {
      const e = events[i];
      if (e.manualStart || e.manualEnd) break;

      if (e.start) e.start = shiftTime(e.start, delta);
      if (e.end) e.end = shiftTime(e.end, delta);
    }
  }

  save();
  renderTimeline();
  console.log(`🕓 Nudged ${event.name} by ${minutes} min (cascade=${cascade})`);
}

function clearAutoDrives() {
  segments = segments.filter(
    (seg) => !(seg.type === 'drive' && seg.autoDrive && !seg.manualEdit)
  );
  save();
}


/* ===============================
   Timing Fill Helpers
   =============================== */

/**
 * Forward-fill times from start → end.
 * Propagates start/end times based on durations
 * until a null is found.
 */
function forwardFillTimes(segments) {
  for (let i = 0; i < segments.length - 1; i++) {
    const cur = segments[i];
    const next = segments[i + 1];
    const dur = Number(cur.duration) || 0;

    // Fill missing end (unless manually set)
    if (!cur.end && cur.start && !cur.manualEnd) {
      cur.end = window.TripCal.endFromDuration(cur.start, dur);
    }

    // Forward-fill next start (stop only if next has manualStart)
    if (cur.end && next && !next.start) {
      next.start = cur.end;
    }
    if (next && next.manualStart) break;
  }
  return segments;
}

/**
 * Back-fill times from end → start.
 * Works backwards until a missing value is hit.
 */

function backFillTimes(segments) {
  for (let i = segments.length - 1; i > 0; i--) {
    const cur = segments[i];
    const prev = segments[i - 1];
    const dur = Number(cur.duration) || 0;

    // Fill missing start (unless manually set)
    if (!cur.start && cur.end && !cur.manualStart) {
      const d = new Date(cur.end);
      d.setHours(d.getHours() - dur);
      cur.start = d.toISOString().slice(0, 16);
    }

    // Back-fill previous end (stop only if prev.manualEnd)
    if (cur.start && prev && !prev.end) {
      prev.end = cur.start;
    }
    if (prev && prev.manualEnd) break;
  }
  return segments;
}



/* ===============================
   Styling helpers
   =============================== */

/* ===============================
   UTC minute math helper
   =============================== */
function addMinutesUTC(utcString, minutes) {
  const date = new Date(utcString);
  const newDate = new Date(date.getTime() + minutes * 60000);
  return newDate.toISOString(); // always returns UTC ISO
}




/* ===============================
   Timeline Rendering & Interaction
   =============================== */


function getDragAfterElement(container, y) {
  // include entire rail-pair for position math
  const pairs = [...container.querySelectorAll('.rail-pair:not(.dragging)')];
  return pairs.reduce(
    (closest, el) => {
      const box = el.getBoundingClientRect();
      const offset = y - (box.top + box.height / 2);
      return offset < 0 && offset > closest.offset ? { offset, element: el.querySelector('.timeline-card') } :
        closest;
    }, { offset: Number.NEGATIVE_INFINITY, element: null }
  ).element;
}



/* ---------- Dates ---------- */

function sortByDate() {
  sortByDateInPlace(events);
  save();
}

/* ---------- Utility: compute end from duration (hours, local) ---------- */
function endFromDuration(startLocal, hoursStr) {
  const hrs = parseFloat(hoursStr);
  if (!startLocal || !isFinite(hrs)) return '';
  const start = new Date(startLocal);
  const end = new Date(start.getTime() + hrs * 3600000);
  // return value in local time for input[type=datetime-local]
  const tzOffset = end.getTimezoneOffset() * 60000;
  const localISO = new Date(end - tzOffset).toISOString().slice(0, 16);
  return localISO;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];



function hasCoords(e) {
  return e && typeof e.lat === 'number' && typeof e.lon === 'number';
}

function addMinutes(baseIso, mins) {
  // assume baseIso in "YYYY-MM-DDTHH:mm" local form
  const [datePart, timePart] = baseIso.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);

  const d = new Date(year, month - 1, day, hour, minute); // local Date
  d.setMinutes(d.getMinutes() + mins);

  // re-emit as local YYYY-MM-DDTHH:mm (no timezone conversion)
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}