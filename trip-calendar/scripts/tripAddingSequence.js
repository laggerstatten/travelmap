/* ===============================
   Queue Trip Stop
   =============================== */

/**
 * CREATE segment with stop type
 *
 * @param {*} segments
 */
function queueStop(segments) {
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

}

async function insertQueuedSegment(seg, card) {
  let segs = loadSegments();
  delete seg.isQueued;
  delete seg.openEditor;

  segs = removeSlackAndOverlap(segs);
  console.log(snap(segs));
  segs = await insertStopInNearestRoute(seg, segs);
  console.log(snap(segs));

  segs = await runPipeline(segs); // test 

  saveSegments(segs);
  renderTimeline(segs);
  renderMap(segs);
}

async function insertStopInNearestRoute(stop, list) {
  let segments = list;

  let timeWindow = getSegmentsInTimeWindow(stop, segments);
  if (!Array.isArray(timeWindow) || !timeWindow.length) {
    console.log('No time window found — falling back to all segments');
    timeWindow = [...segments];

    if (stop.start) delete stop.start.utc;
    if (stop.end)   delete stop.end.utc;
  }

  const drives = timeWindow.filter(
    (ev) => ev.type === 'drive' && ev.routeGeometry
  );

  if (!drives.length) {
    console.warn("No drives found — appending stop.");
    segments.push(stop);
    return segments;
  }

  // ------------------------------------------------
  // 1. Find the best drive segment by ID (not index)
  // ------------------------------------------------
  let bestDrive = null;
  let bestDist  = Infinity;

  for (const d of drives) {
    const coords = d.routeGeometry?.coordinates;
    if (!coords?.length) continue;

    const mid = coords[Math.floor(coords.length / 2)];
    const dx  = stop.coordinates[0] - mid[0];
    const dy  = stop.coordinates[1] - mid[1];
    const dist = Math.sqrt(dx*dx + dy*dy);

    if (dist < bestDist) {
      bestDist  = dist;
      bestDrive = d;
    }
  }

  if (!bestDrive) return segments;

  // ------------------------------------------------
  // 2. Delegate to the helper that works by IDs
  // ------------------------------------------------
  return await insertStopInRouteById(segments, stop.id, bestDrive.id, stop);
}

async function insertStopInRouteById(segments, stopId, driveId, stopObj) {
  let driveIdx = segments.findIndex(s => s.id === driveId);
  if (driveIdx === -1) return segments;

  const drive = segments[driveIdx];

  const origin = segments.find(s => s.id === drive.originId);
  const destination = segments.find(s => s.id === drive.destinationId);

  if (!origin || !destination) return segments;
  if (!origin.coordinates || !destination.coordinates) return segments;

  // --------------------------------------------
  // Get route info (origin → stop, stop → dest)
  // --------------------------------------------
  const r1 = await getRouteInfo(origin, stopObj);
  const r2 = await getRouteInfo(stopObj, destination);
  if (!r1 || !r2) return segments;

  // --------------------------------------------
  // Build two new drive segments
  // --------------------------------------------
  const newDrive1 = {
    id: newId(),
    type: 'drive',
    autoDrive: true,
    name: `Drive from ${origin.name} to ${stopObj.name}`,
    routeGeometry: r1.geometry,
    distanceMi: r1.distance_mi.toFixed(1),
    durationMin: r1.duration_min.toFixed(0),
    durationHr: (r1.duration_min / 60).toFixed(2),
    duration: { val: (r1.duration_min / 60).toFixed(2), lock: 'hard' },
    originId: origin.id,
    destinationId: stopObj.id,
    originTz: origin.timeZone,
    destinationTz: stopObj.timeZone,
  };

  const newDrive2 = {
    id: newId(),
    type: 'drive',
    autoDrive: true,
    name: `Drive from ${stopObj.name} to ${destination.name}`,
    routeGeometry: r2.geometry,
    distanceMi: r2.distance_mi.toFixed(1),
    durationMin: r2.duration_min.toFixed(0),
    durationHr: (r2.duration_min / 60).toFixed(2),
    duration: { val: (r2.duration_min / 60).toFixed(2), lock: 'hard' },
    originId: stopObj.id,
    destinationId: destination.id,
    originTz: stopObj.timeZone,
    destinationTz: destination.timeZone,
  };

  // --------------------------------------------
  // Remove a temporary instance of the stop (if it exists)
  // --------------------------------------------
  const tempStopIdx = segments.findIndex(s => s.id === stopId);
  if (tempStopIdx !== -1) segments.splice(tempStopIdx, 1);

  // --------------------------------------------
  // Replace the original drive with:
  //   [ newDrive1, stopObj, newDrive2 ]
  // --------------------------------------------
  driveIdx = segments.findIndex(s => s.id === driveId);
  if (driveIdx === -1) return segments;
  segments.splice(driveIdx, 1, newDrive1, stopObj, newDrive2);

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





