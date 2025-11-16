function updateSegmentTiming(seg, formData) {
  const prev = structuredClone(seg);

  seg.start ??= { utc: '', lock: 'unlocked' };
  seg.end ??= { utc: '', lock: 'unlocked' };
  seg.duration ??= { val: null, lock: 'unlocked' };

  const durVal = formData['duration']?.trim() 
  ? Number(formData['duration']) 
  : null;

  const newStartUTC = formData['start'] 
  ? localToUTC(formData['start'], seg.timeZone) 
  : '';
  const newEndUTC = formData['end']   
  ? localToUTC(formData['end'], seg.timeZone)   
  : '';

  // Apply user edits (don’t recompute yet)
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

  seg.start.lock ??= prev.start?.lock || 'unlocked';
  seg.end.lock ??= prev.end?.lock || 'unlocked';
  seg.duration.lock ??= prev.duration?.lock || 'unlocked';

  updateLockConsistency(seg);

  const changed = {
    start: seg.start.utc !== prev.start?.utc,
    end: seg.end.utc !== prev.end?.utc,
    duration: seg.duration.val !== prev.duration?.val
  };

  recalculateSegmentTimes(seg, changed);
  return { changed, prev };
}

function recalculateSegmentTimes(seg, changed = { start:false, end:false, duration:false }) {
  const startLocked = seg.start?.lock === 'hard';
  const endLocked   = seg.end?.lock === 'hard';
  const durLocked   = seg.duration?.lock === 'hard';

  const hasStart = !!seg.start?.utc;
  const hasEnd   = !!seg.end?.utc;
  const hasDur   = seg.duration?.val != null && !isNaN(Number(seg.duration.val));

  const startDT = toDate(seg.start?.utc);
  const endDT   = toDate(seg.end?.utc);
  const durMs   = hasDur ? Number(seg.duration.val) * 3600000 : null;

  // --- 1) Two locked => compute the third
  if (startLocked && endLocked) {
    if (hasStart && hasEnd) seg.duration.val = (endDT - startDT) / 3600000;
    return seg;
  }
  if (startLocked && durLocked) {
    if (hasStart && hasDur) seg.end.utc = iso(startDT.getTime() + durMs);
    return seg;
  }
  if (endLocked && durLocked) {
    if (hasEnd && hasDur) seg.start.utc = iso(endDT.getTime() - durMs);
    return seg;
  }

  // --- 2) Exactly one locked => edited field drives the third
  if (startLocked && !endLocked && !durLocked) {
    if (changed.duration && hasStart && hasDur) seg.end.utc = iso(startDT.getTime() + durMs);
    else if (changed.end && hasStart && hasEnd) seg.duration.val = (endDT - startDT) / 3600000;
    return seg;
  }
  if (endLocked && !startLocked && !durLocked) {
    if (changed.duration && hasEnd && hasDur) seg.start.utc = iso(endDT.getTime() - durMs);
    else if (changed.start && hasStart && hasEnd) seg.duration.val = (endDT - startDT) / 3600000;
    return seg;
  }
  if (durLocked && !startLocked && !endLocked) {
    if (changed.start && hasStart && hasDur) seg.end.utc = iso(startDT.getTime() + durMs);
    else if (changed.end && hasEnd && hasDur) seg.start.utc = iso(endDT.getTime() - durMs);
    return seg;
  }

  // --- 3) None locked: prefer the edited field(s)
  // If only one thing changed, compute the dependent third if possible.
  const oneChanged =
    (changed.start?1:0) + (changed.end?1:0) + (changed.duration?1:0) === 1;

  if (oneChanged) {
    if (changed.start && hasStart && hasDur) {
      seg.end.utc = iso(startDT.getTime() + durMs);
      return seg;
    }
    if (changed.end && hasEnd && hasDur) {
      seg.start.utc = iso(endDT.getTime() - durMs);
      return seg;
    }
    if (changed.duration) {
      if (hasStart) seg.end.utc = iso(startDT.getTime() + durMs);
      else if (hasEnd) seg.start.utc = iso(endDT.getTime() - durMs);
      return seg;
    }
  }

  // --- 4) Fallback: if start & end present, keep duration consistent
  if (hasStart && hasEnd) seg.duration.val = (endDT - startDT) / 3600000;

  return seg;
}

function updateLockConsistency(seg) {
  const locks = {
    start: seg.start.lock,
    end: seg.end.lock,
    duration: seg.duration.lock
  };

  const hardCount = Object.values(locks).filter((l) => l === 'hard').length;

  // Clear derived states first
  if (locks.start !== 'hard') seg.start.lock = 'unlocked';
  if (locks.end !== 'hard') seg.end.lock = 'unlocked';
  if (locks.duration !== 'hard') seg.duration.lock = 'unlocked';

  // ────────────────────────────────
  // 1️⃣ Exactly two hard locks → derive the third as soft
  // ────────────────────────────────
  if (hardCount === 2) {
    const hardStart = locks.start === 'hard';
    const hardEnd = locks.end === 'hard';
    const hardDur = locks.duration === 'hard';

    if (hardStart && hardEnd && !hardDur) {
      seg.duration.val = durationFromStartEnd(seg.start.utc, seg.end.utc);
      seg.duration.lock = 'soft';
    } else if (hardStart && hardDur && !hardEnd) {
      seg.end.utc = endFromDuration(seg.start.utc, seg.duration.val);
      seg.end.lock = 'soft';
    } else if (hardEnd && hardDur && !hardStart) {
      seg.start.utc = startFromDuration(seg.end.utc, seg.duration.val);
      seg.start.lock = 'soft';
    }
  }

  // ────────────────────────────────
  // 2️⃣ One or zero hard locks → everything else stays unlocked
  // ────────────────────────────────
  // (no auto-promotion to hard — user must click to lock)
}






