function clearTimesAndDurations(opts = {}) {
  const { clearDurationsOnly = false, onlyUnlocked = false } = opts;

  let message = "Clear all start/end times and durations?";
  if (clearDurationsOnly) message = "Clear all durations except routed drive durations?";
  else if (onlyUnlocked) message = "Clear all non-locked times and durations?";
  if (!confirm(message)) return;

  segments.forEach(seg => {
    const isDriveRoute = seg.type === "drive" && seg.autoDrive && seg.duration;

    // --- If we are only clearing durations ---
    if (clearDurationsOnly) {
      if (!isDriveRoute) seg.duration = "";
      return; // skip other logic
    }

    // --- Otherwise handle full time clearing (with optional onlyUnlocked filter) ---

    // Start
    if (!onlyUnlocked || seg.startLock !== "hard") {
      delete seg.start;
      seg.startLock = "unlocked";
    }

    // End
    if (!onlyUnlocked || seg.endLock !== "hard") {
      delete seg.end;
      seg.endLock = "unlocked";
    }

    // Duration
    if (!onlyUnlocked || seg.durationLock !== "hard") {
      if (!isDriveRoute) seg.duration = "";
      seg.durationLock = "unlocked";
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
  const idx = segments.findIndex(ev => ev.id === fromSegment.id);
  if (idx === -1) return;

  let cursor = fromSegment.end || fromSegment.start;
  if (!cursor) return;

  for (let i = idx + 1; i < segments.length; i++) {
    const seg = segments[i];

    // --- Skip slack / overlap segments entirely ---
    if (seg.type === "slack" || seg.type === "overlap") continue;

    // --- Stop if we hit a hard or soft start lock ---
    if (seg.startLock === "hard" || seg.startLock === "soft") break;

    // --- Trip end special handling ---
    if (seg.type === "trip_end") {
      if (seg.startLock !== "hard" && seg.startLock !== "soft") {
        seg.start = cursor;
        seg.startLock = "auto";
      }
      break;
    }

    // --- Propagate start ---
    if (seg.startLock !== "hard" && seg.startLock !== "soft") {
      seg.start = cursor;
      seg.startLock = "auto";
    }

    // --- Propagate end ---
    const durHrs = Number(seg.duration) || 0;
    if (seg.endLock !== "hard" && seg.endLock !== "soft") {
      seg.end = addMinutesUTC(seg.start, durHrs * 60);
      seg.endLock = "auto";
    }

    cursor = seg.end || seg.start;
  }

  save();
  renderTimeline();
}

/* ===============================
   Fill BACKWARD (UTC) — Lock-Aware
   =============================== */
function fillBackward(fromSegment) {
  const idx = segments.findIndex(ev => ev.id === fromSegment.id);
  if (idx === -1) return;

  let cursor = fromSegment.start || fromSegment.end;
  if (!cursor) return;

  for (let i = idx - 1; i >= 0; i--) {
    const seg = segments[i];

    // --- Skip slack / overlap segments ---
    if (seg.type === "slack" || seg.type === "overlap") continue;

    // --- Stop if we hit a hard or soft end lock ---
    if (seg.endLock === "hard" || seg.endLock === "soft") break;

    // --- Trip start special handling ---
    if (seg.type === "trip_start") {
      if (seg.endLock !== "hard" && seg.endLock !== "soft") {
        seg.end = cursor;
        seg.endLock = "auto";
      }
      break;
    }

    // --- Propagate end ---
    if (seg.endLock !== "hard" && seg.endLock !== "soft") {
      seg.end = cursor;
      seg.endLock = "auto";
    }

    // --- Propagate start ---
    const durHrs = Number(seg.duration) || 0;
    if (seg.startLock !== "hard" && seg.startLock !== "soft") {
      seg.start = addMinutesUTC(seg.end, -durHrs * 60);
      seg.startLock = "auto";
    }

    cursor = seg.start || seg.end;
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