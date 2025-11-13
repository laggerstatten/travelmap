/* ===============================
   Queue Trip Stop
   =============================== */
function queueStop() {
  let segments = loadSegments();
  const seg = {
    id: newId(),
    name: '(untitled)',
    type: 'stop',
    start: { utc: '', lock: 'unlocked' },
    end: { utc: '', lock: 'unlocked' },
    duration: { val: null, lock: 'unlocked' },
    isQueued: true,
    openEditor: true
  };

  segments.unshift(seg);

  saveSegments(segments);
  renderTimeline(segments);
}

async function insertQueuedSegment(seg, card) {
  let segs = loadSegments();
  delete seg.isQueued;
  delete seg.openEditor;
  segs = await insertStopInNearestRoute(seg, segs);

  segs = removeSlackAndOverlap(segs);
  segs = await validateAndRepair(segs);
  segs = annotateEmitters(segs);
  segs = determineEmitterDirections(segs, { priority: PLANNING_DIRECTION });
  segs = propagateTimes(segs);
  segs = computeSlackAndOverlap(segs);

  saveSegments(segs);
  renderTimeline(segs);
}

async function insertStopInNearestRoute(stop, list) {
  let segments = [...list];
  let timeWindow = getSegmentsInTimeWindow(stop, segments);

  if (!Array.isArray(timeWindow) || !timeWindow.length) {
    console.log('No time window found — falling back to all segments');
    timeWindow = [...segments];

    if (stop.start) delete stop.start.utc;
    if (stop.end) delete stop.end.utc;

  }

  const drives = timeWindow.filter(
    (ev) => ev.type === 'drive' && ev.routeGeometry
  );
  if (!drives.length) {
    console.warn("No drives found — appending stop.");
    segments.push(stop);
    return segments;
  }

  let bestDrive = null;
  let bestDist = Infinity;
  for (const d of drives) {
    const coords = d.routeGeometry?.coordinates;
    if (!coords?.length) continue;
    const mid = coords[Math.floor(coords.length / 2)];
    const dx = stop.coordinates[0] - mid[0];
    const dy = stop.coordinates[1] - mid[1];
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < bestDist) {
      bestDist = dist;
      bestDrive = d;
    }
  }
  if (!bestDrive) return;

  const origin = segments.find((seg) => seg.id === bestDrive.originId);
  const destination = segments.find(
    (seg) => seg.id === bestDrive.destinationId
  );

  if (!origin || !destination) {
    return;
  }

  if (!origin.coordinates || !destination.coordinates) return;

  const r1 = await getRouteInfo(origin, stop);
  const r2 = await getRouteInfo(stop, destination);
  if (!r1 || !r2) return;

  const newDrive1 = {
    id: newId(),
    type: 'drive',
    autoDrive: true,
    name: `Drive from ${origin.name} to ${stop.name}`,
    routeGeometry: r1.geometry,
    distanceMi: r1.distance_mi.toFixed(1),
    durationMin: r1.duration_min.toFixed(0),
    durationHr: (r1.duration_min / 60).toFixed(2),
    duration: { val: (r1.duration_min / 60).toFixed(2), lock: 'hard' },
    originId: origin.id,
    destinationId: stop.id,
    originTz: origin.timeZone,
    destinationTz: stop.timeZone,
  };

  const newDrive2 = {
    id: newId(),
    type: 'drive',
    autoDrive: true,
    name: `Drive from ${stop.name} to ${destination.name}`,
    routeGeometry: r2.geometry,
    distanceMi: r2.distance_mi.toFixed(1),
    durationMin: r2.duration_min.toFixed(0),
    durationHr: (r2.duration_min / 60).toFixed(2),
    duration: { val: (r2.duration_min / 60).toFixed(2), lock: 'hard' },
    originId: stop.id,
    destinationId: destination.id,
    originTz: stop.timeZone,
    destinationTz: destination.timeZone,   
  };

  const tempIndex = segments.findIndex((seg) => seg.id === stop.id);
  if (tempIndex !== -1) segments.splice(tempIndex, 1);

  const driveIndex = segments.findIndex((seg) => seg.id === bestDrive.id);
  if (driveIndex === -1) {
    return;
  }

  segments.splice(driveIndex, 1, newDrive1, stop, newDrive2);
  return segments;
}

function getSegmentsInTimeWindow(stop, segments) {
  if (!stop?.start?.utc && !stop?.end?.utc) return [...segments];

  const tRef = new Date(stop.start?.utc || stop.end?.utc).getTime();
  let latestBeforeIdx = -1;
  let earliestAfterIdx = segments.length;

  // latest segment whose *end OR start* is before stop
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    if (s.isQueued) continue;
    const tSeg =
      segments[i].end?.utc
        ? new Date(s.end.utc).getTime()
        : s.start?.utc
        ? new Date(s.start.utc).getTime()
        : null;
    if (tSeg && tSeg <= tRef) latestBeforeIdx = i;
  }

  // earliest segment whose *start OR end* is after stop
  for (let i = segments.length - 1; i >= 0; i--) {
    const s = segments[i];
    if (s.isQueued) continue;
    const tSeg =
      s.start?.utc
        ? new Date(s.start.utc).getTime()
        : s.end?.utc
        ? new Date(s.end.utc).getTime()
        : null;
    if (tSeg && tSeg >= tRef) earliestAfterIdx = i;
  }

  // If stop is outside the trip window, return empty list
  if (latestBeforeIdx === -1 || earliestAfterIdx === segments.length) {
    console.log('Stop outside trip window — no valid time window.');
    return [];
  }

  return segments.slice(latestBeforeIdx, earliestAfterIdx + 1);
}

function removeSlackAndOverlap(list) {
  console.log('removeSlackAndOverlap');
  let segments = [...list];

  // Build a working copy excluding derived types
  const baseSegments = segments.filter(
    (s) => s.type !== 'slack' && s.type !== 'overlap'
  );

  console.log('Segments after recompute:', baseSegments);
  return baseSegments;
}

function clearTimesAndDurations(list, opts = {}) {
  console.log('clearTimesAndDurations');
  let segments = [...list];
  const { onlyUnlocked = true } = opts;

  const message = onlyUnlocked
    ? 'Clear all non-locked times and durations?'
    : 'Clear all start/end times and durations?';

  if (!confirm(message)) return;

  const shouldClear = (lock) => {
    if (!onlyUnlocked) return true;
    return !(lock === 'hard' || lock === 'soft');
  };

  segments.forEach((seg) => {
    seg.start ??= { utc: '', lock: 'unlocked' };
    seg.end ??= { utc: '', lock: 'unlocked' };
    seg.duration ??= { val: null, lock: 'unlocked' };

    if (shouldClear(seg.start.lock)) {
      seg.start.utc = '';
      seg.start.lock = 'unlocked';
    }

    if (shouldClear(seg.end.lock)) {
      seg.end.utc = '';
      seg.end.lock = 'unlocked';
    }

    if (shouldClear(seg.duration.lock)) {
      seg.duration.val = null;
      seg.duration.lock = 'unlocked';
    }

    if (seg.type === 'drive') {
      seg.duration.val = seg.durationHr ?? seg.duration?.val ?? null;
      seg.duration.lock = 'auto';
    }

    delete seg.manualEdit;
  });

  console.log(segments);
  return segments;
}

function clearAutoDrives(list) {
  let segments = [...list];
  segments = segments.filter(
    (seg) => !(seg.type === 'drive' && seg.autoDrive && !seg.manualEdit)
  );
  return segments;
}
