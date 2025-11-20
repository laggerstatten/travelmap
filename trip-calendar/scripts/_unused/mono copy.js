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

/* ===============================
   Fill FORWARD (UTC) — Lock-Aware
   =============================== */
function fillForward(fromSegment) {
  const idx = segments.findIndex((ev) => ev.id === fromSegment.id);
  if (idx === -1) return;

  const fromStart = fromSegment.start?.utc;
  const fromEnd = fromSegment.end?.utc;
  let cursor = fromEnd || fromStart;
  if (!cursor) return;

  for (let i = idx + 1; i < segments.length; i++) {
    const seg = segments[i];

    // --- normalize nested objects ---
    seg.start ??= { utc: '', lock: 'unlocked' };
    seg.end ??= { utc: '', lock: 'unlocked' };
    seg.duration ??= { val: null, lock: 'unlocked' };

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

  const fromStart = fromSegment.start?.utc;
  const fromEnd = fromSegment.end?.utc;
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
