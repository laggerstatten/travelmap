function getOverlapResolutionOptions(seg, role) {
  const options = [];
  const overlap = seg.overlapEmitters ?.find(e => e.role === role);
  if (!overlap) return options;

  const overlapMin = overlap.overlapMinutes;
  const roundedMin = Math.ceil(overlapMin / 15) * 15;
  const roundedHr = roundedMin / 60;

  const durMin = segDurationMinutes(seg);
  const canShrink = durMin > 0 && overlapMin < durMin * 0.75;

  const add = (action, label, feasibility = 'ok', reason = '') =>
    options.push({ action, label, feasibility, reason, role, roundedMin, roundedHr });

  switch (seg.type) {
    case 'trip_start':
    case 'trip_end':
      {
        const move = role === 'left' ? 'moveEarlier' : 'moveLater';
        const locked = role === 'left' ? (seg.start ?.lock === 'hard') : (seg.end ?.lock === 'hard');
        if (locked) add(move, `🔒 Unlock & ${move} (~${roundedHr}h)`, 'unlock', 'Boundary locked');
        else add(move, `${role === 'left' ? '⬅' : '➡'} Move (~${roundedHr}h)`);
        break;
      }
    case 'stop':
      {
        if (role === 'left') {
          const locked = seg.end ?.lock === 'hard';
          if (locked) add('moveEarlier', '🔒 Unlock & Nudge Earlier', 'unlock', 'End locked');
          else add('moveEarlier', `⬅ Nudge Earlier (~${roundedHr}h)`);
          if (canShrink) {
            const dLocked = seg.duration ?.lock === 'hard';
            if (dLocked) add('shrink', '🔒 Unlock & Shorten', 'unlock', 'Duration locked');
            else add('shrink', `↔ Shorten (~${roundedHr}h)`);
          }
        } else {
          const locked = seg.start ?.lock === 'hard';
          if (locked) add('moveLater', '🔒 Unlock & Nudge Later', 'unlock', 'Start locked');
          else add('moveLater', `➡ Nudge Later (~${roundedHr}h)`);
          if (canShrink) {
            const dLocked = seg.duration ?.lock === 'hard';
            if (dLocked) add('shrink', '🔒 Unlock & Shorten', 'unlock', 'Duration locked');
            else add('shrink', `↔ Shorten (~${roundedHr}h)`);
          }
        }
        break;
      }

  }

  return options;
}

function getUnlockAndQueueOptions(seg) {
  const opts = [];

  // Only show if any lock is hard
  const anyLocked =
    seg.start ?.lock === 'hard' ||
      seg.end ?.lock === 'hard' ||
        seg.duration ?.lock === 'hard';

  if (anyLocked) {
    opts.push({
      action: 'unlockAndClear',
      label: '🔓 Unlock & Clear Times',
      feasibility: 'ok',
      reason: 'Removes start/end so card becomes draggable'
    });
  }

  // Only show if not already queued
  if (!seg.isQueued) {
    opts.push({
      action: 'unlockAndQueue',
      label: '⬆ Send to Top of Timeline (Requeue)',
      feasibility: 'ok',
      reason: 'Unlock and move to planning queue'
    });
  }

  return opts;
}

async function resolveOverlapAction(seg, opt) {
  console.log(`Resolving ${opt.action} (${opt.role}) for`, seg.name);

  // minutes/hours are precomputed on opt
  const roundedMin = opt.roundedMin ?? 0;
  const roundedHr = opt.roundedHr ?? 0;

  // Unlock if needed
  if (opt.feasibility === 'unlock') {
    if (opt.action === 'moveEarlier' || opt.action === 'moveLater') {
      seg.start.lock = 'unlocked';
      seg.end.lock = 'unlocked';
    } else if (opt.action === 'shrink') {
      seg.duration.lock = 'unlocked';
      // also unlock the boundary we’ll recompute below
      if (opt.role === 'left') seg.end.lock = 'unlocked';
      else seg.start.lock = 'unlocked';
    }
  }

  const formData = {};

  if (opt.action === 'moveEarlier') {
    formData.start = utcToLocalInput(addMinutes(seg.start.utc, -roundedMin), seg.timeZone);
    formData.end = utcToLocalInput(addMinutes(seg.end.utc, -roundedMin), seg.timeZone);
  }

  if (opt.action === 'moveLater') {
    formData.start = utcToLocalInput(addMinutes(seg.start.utc, roundedMin), seg.timeZone);
    formData.end = utcToLocalInput(addMinutes(seg.end.utc, roundedMin), seg.timeZone);
  }

  if (opt.action === 'shrink') {
    // Current duration (minutes) with your helper
    const curDurMin = segDurationMinutes(seg);
    const newDurMin = Math.max(0, curDurMin - roundedMin);
    const newDurHr = newDurMin / 60;

    // Role determines which boundary stays anchored:
    // left side shrink ⇒ keep START fixed, move END earlier
    // right side shrink ⇒ keep END fixed, move START later
    if (opt.role === 'left') {
      formData.start = utcToLocalInput(seg.start.utc, seg.timeZone);
      formData.end = utcToLocalInput(endFromDuration(seg.start.utc, newDurHr), seg.timeZone);
      formData.duration = newDurHr.toFixed(2);
    } else {
      formData.end = utcToLocalInput(seg.end.utc, seg.timeZone);
      formData.start = utcToLocalInput(startFromDuration(seg.end.utc, newDurHr), seg.timeZone);
      formData.duration = newDurHr.toFixed(2);
    }
  }

  if (opt.action === 'unlockAndClear') {
    unlockAndClear(seg);
  }

  if (opt.action === 'unlockAndQueue') {
    unlockAndQueue(seg);
    pushToQueueTop(list, seg);
  }

  // Apply via your central logic
  if (Object.keys(formData).length > 0) {
    updateSegmentTiming(seg, formData);
  }

  // Persist + recompute
  let list = loadSegments();
  const idx = list.findIndex(s => s.id === seg.id);
  if (idx !== -1) list[idx] = seg;



  /**
    list = removeSlackAndOverlap(list);
    list = await validateAndRepair(list);
    list = annotateEmitters(list);
    list = determineEmitterDirections(list, { priority: PLANNING_DIRECTION });
    list = propagateTimes(list);
    list = computeSlackAndOverlap(list);
  */

  list = await runPipeline(list); // test -- should be timing or above

  saveSegments(list);
  renderTimeline(list);
  renderMap(list);
}