function clearTimesAndDurations(opts = {}) {
  const { onlyUnlocked = false } = opts;

  let message = 'Clear all start/end times and durations?';
  if (onlyUnlocked) message = 'Clear all non-locked times and durations?';
  if (!confirm(message)) return;

  segments.forEach((seg) => {
    const isDriveRoute =
      seg.type === 'drive' && seg.autoDrive && seg.duration.val;

    if (onlyUnlocked) {
      if (seg.start.lock !== 'hard') {
        seg.start.utc = '';
        seg.start.lock = 'unlocked';
      }

      if (seg.end.lock !== 'hard') {
        seg.end.utc = '';
        seg.end.lock = 'unlocked';
      }

      if (seg.duration.lock !== 'hard') {
        seg.duration.val = '';
        seg.duration.lock = 'unlocked';
      }
    } else if (!onlyUnlocked) {
      seg.start.utc = '';
      seg.start.lock = 'unlocked';
      seg.end.utc = '';
      seg.end.lock = 'unlocked';
      seg.duration.val = '';
      seg.duration.lock = 'unlocked';
    }

    // Clear transient manual flags
    delete seg.manualEdit;
  });

  save();
  renderTimeline();
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

  save();
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

/* ===============================
   UTC minute math helper
   =============================== */
function addMinutesUTC(utcString, minutes) {
  const date = new Date(utcString);
  const newDate = new Date(date.getTime() + minutes * 60000);
  return newDate.toISOString(); // always returns UTC ISO
}
