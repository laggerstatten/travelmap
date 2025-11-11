/* ===============================
   Queue Trip Stop
   =============================== */
function queueStop() {
  let segments = loadSegments();
  const seg = {
    id: newId(),
    name: '(untitled)',
    type: 'stop',
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

  //TEST
  segs = removeSlackAndOverlap(segs);
  segs = await validateAndRepair(segs);
  segs = annotateEmitters(segs);
  segs = determineEmitterDirections(segs, { priority: 'forward' }); // or 'backward'
  segs = propagateTimes(segs);
  segs = computeSlackAndOverlap(segs);
  //TEST

  saveSegments(segs);
  renderTimeline(segs);
}


async function insertStopInNearestRoute(stop, list) {
  let segments = [...list];
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
  return segments;

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
  console.log(segments);
  const { onlyUnlocked = false } = opts;

  let message = onlyUnlocked ?
    'Clear all non-locked times and durations?' :
    'Clear all start/end times and durations?';

  if (!confirm(message)) return;

  segments.forEach((seg) => {
    // Ensure nested structure exists
    seg.start ??= { utc: '', lock: 'unlocked' };
    seg.end ??= { utc: '', lock: 'unlocked' };
    seg.duration ??= { val: null, lock: 'unlocked' };

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
