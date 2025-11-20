function clearAutoDrives(list) {
  let segments = [...list];
  segments = segments.filter(
    (seg) => !(seg.type === 'drive' && seg.autoDrive && !seg.manualEdit)
  );
  return segments;
}

/* ===============================
   Trip Validation & Repair Module
   =============================== */

async function validateAndRepair(list) {
  // --- split into placed timeline vs queued ---
  const placed = list.filter((seg) => !seg.isQueued); // check for errors
  const queued = list.filter((seg) => seg.isQueued);
  // Work only on placed segments
  let segments = [...placed];

  segments = removeAdjacentDrives(segments);

  segments = segments.filter((seg) => {
    if (seg.type !== 'drive') return true;
    const origin = segments.find((x) => x.id === seg.originId);
    const dest = segments.find((x) => x.id === seg.destinationId);
    return origin && dest;
  });
  // do we need to sort by date here
  segments = insertDriveSegments(segments);
  segments = await generateRoutes(segments);

  const finalList = [...queued, ...segments];

  return finalList;
}

/**
 * Walks the list and removes adjacent drives.
 * Mutates `list` in place and restarts from the beginning
 * whenever a pair is removed.
 */
function removeAdjacentDrives(list) {
  let i = 0;

  while (i < list.length - 1) {
    const segA = list[i];
    const segB = list[i + 1];

    if (!segA || !segB) break;

    const result = removeAdjacentDrivesById(list, segA.id, segB.id);

    if (result.length === 0) {
      // A pair was removed; the list has changed.
      // Start scanning again from the beginning.
      i = 0;
      continue;
    }

    // nothing removed; move forward
    i++;
  }

  return list;
}

/**
 * UPDATE segments by checking for non-drives adjacent to each other and inserting drives
 * CREATE segment with drive type
 *
 * @param {*} list
 * @return {*}
 */
function insertDriveSegments(list) {
  let i = 0;

  while (i < list.length - 1) {
    const segA = list[i];
    const segB = list[i + 1];

    if (!segA || !segB) break;

    const inserted = insertDriveBetweenById(list, segA.id, segB.id);

    if (inserted) {
      // list mutated → drive inserted → restart scan
      i = 0;
      continue;
    }

    // no insertion → continue forward
    i++;
  }

  return list;
}

/**
 * UPDATE segments by writing routing data for drive type segments
 * UPDATE segment
 *
 * @param {*} list
 * @return {*}
 */
async function generateRoutes(list) {
  //const segments = sortByDateInPlace([...list]);
  // commenting this out to see if anything breaks
  // may need to be part of validate and repair function
  const segments = [...list];

  for (const seg of segments) {
    if (seg.type !== 'drive') continue;

    // Use explicit IDs first
    const origin = segments.find((ev) => ev.id === seg.originId);
    const destination = segments.find((ev) => ev.id === seg.destinationId);

    const from = origin;
    const to = destination;

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
        seg.duration = {
          val: (route.duration_min / 60).toFixed(2),
          lock: 'hard'
        };
        seg.originId = from.id;
        seg.destinationId = to.id;
        seg.originTz = from.timeZone;
        seg.destinationTz = to.timeZone;
      }
    } catch (err) {}
  }

  return segments;
}

async function insertStopInNearestRoute(stop, list) {
  let segments = list;

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
    console.warn('No drives found — appending stop.');
    segments.push(stop);
    return segments;
  }

  // ------------------------------------------------
  // 1. Find the best drive segment by ID (not index)
  // ------------------------------------------------
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

  if (!bestDrive) return segments;

  // ------------------------------------------------
  // 2. Delegate to the helper that works by IDs
  // ------------------------------------------------
  return await insertStopInRouteById(segments, stop.id, bestDrive.id, stop);
}

/**
 * Given two segment IDs, re-locate them in `segments`,
 * check if they are still adjacent drives, and if so
 * remove them in place.
 *
 * Returns:
 *   []        → both removed
 *   [segA, segB] → kept (no mutation), using their current positions
 */
function removeAdjacentDrivesById(segments, idA, idB) {
  const idxA = segments.findIndex((s) => s.id === idA);
  const idxB = segments.findIndex((s) => s.id === idB);

  if (idxA === -1 || idxB === -1) {
    // one or both got removed/changed earlier
    return [];
  }

  // normalize order
  const firstIdx = Math.min(idxA, idxB);
  const secondIdx = Math.max(idxA, idxB);

  const first = segments[firstIdx];
  const second = segments[secondIdx];

  const areAdjacent = secondIdx === firstIdx + 1;
  const bothDrives = first?.type === 'drive' && second?.type === 'drive';

  if (areAdjacent && bothDrives) {
    // mutate list in place: remove both
    segments.splice(firstIdx, 2);
    return segments; // return the mutated list
  }

  // No removal needed -> return original list
  return segments;
}

function insertDriveBetweenById(segments, idA, idB) {
  const idxA = segments.findIndex((s) => s.id === idA);
  const idxB = segments.findIndex((s) => s.id === idB);

  if (idxA === -1 || idxB === -1) {
    // They were already modified/removed earlier
    return false;
  }

  // normalize order
  const firstIdx = Math.min(idxA, idxB);
  const secondIdx = Math.max(idxA, idxB);

  const first = segments[firstIdx];
  const second = segments[secondIdx];

  const areAdjacent = secondIdx === firstIdx + 1;
  if (!areAdjacent) return false;

  // The rule: insert a drive only if both are non-drive
  const shouldInsert = first?.type !== 'drive' && second?.type !== 'drive';

  if (!shouldInsert) return false;

  // Create new drive segment
  const driveSeg = {
    id: newId(),
    name: `Drive from ${first.name || 'current stop'} to ${
      second.name || 'next stop'
    }`,
    type: 'drive',
    autoDrive: true,
    manualEdit: false,
    originId: first.id,
    destinationId: second.id
  };

  // Mutate list IN PLACE
  // Insert between firstIdx and secondIdx
  segments.splice(firstIdx + 1, 0, driveSeg);

  return true;
}

async function insertStopInRouteById(segments, stopId, driveId, stopObj) {
  let driveIdx = segments.findIndex((s) => s.id === driveId);
  if (driveIdx === -1) return segments;

  const drive = segments[driveIdx];

  const origin = segments.find((s) => s.id === drive.originId);
  const destination = segments.find((s) => s.id === drive.destinationId);

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
    destinationTz: stopObj.timeZone
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
    destinationTz: destination.timeZone
  };

  // --------------------------------------------
  // Remove a temporary instance of the stop (if it exists)
  // --------------------------------------------
  const tempStopIdx = segments.findIndex((s) => s.id === stopId);
  if (tempStopIdx !== -1) segments.splice(tempStopIdx, 1);

  // --------------------------------------------
  // Replace the original drive with:
  //   [ newDrive1, stopObj, newDrive2 ]
  // --------------------------------------------
  driveIdx = segments.findIndex((s) => s.id === driveId);
  if (driveIdx === -1) return segments;
  segments.splice(driveIdx, 1, newDrive1, stopObj, newDrive2);

  return segments;
}

async function healRouteIfNeeded(list, prevId, nextId) {
  const left = prevId ? list.find((s) => s.id === prevId) : null;
  const right = nextId ? list.find((s) => s.id === nextId) : null;

  // Only heal if both neighbors are drives
  if (left?.type === 'drive' && right?.type === 'drive') {
    return await healRouteBetweenDrives(left.id, right.id, list);
  }

  return list;
}

async function healRouteBetweenDrives(leftDriveId, rightDriveId, list) {
  const leftIdx = list.findIndex((s) => s.id === leftDriveId);
  const rightIdx = list.findIndex((s) => s.id === rightDriveId);

  if (leftIdx === -1 || rightIdx === -1) return list;

  const left = list[leftIdx];
  const right = list[rightIdx];

  if (left.type !== 'drive' || right.type !== 'drive') return list;

  const origin = list.find((s) => s.id === left.originId);
  const destination = list.find((s) => s.id === right.destinationId);

  if (!origin || !destination) return list;

  const r = await getRouteInfo(origin, destination);
  if (!r) return list;

  const newDrive = {
    id: newId(),
    type: 'drive',
    autoDrive: true,
    name: `Drive from ${origin.name} to ${destination.name}`,
    routeGeometry: r.geometry,
    distanceMi: r.distance_mi.toFixed(1),
    durationMin: r.duration_min.toFixed(0),
    durationHr: (r.duration_min / 60).toFixed(2),
    duration: { val: (r.duration_min / 60).toFixed(2), lock: 'hard' },
    originId: origin.id,
    destinationId: destination.id,
    originTz: origin.timeZone,
    destinationTz: destination.timeZone
  };

  // ------------------------
  // Remove the two drives
  // ------------------------
  // Important: remove RIGHT FIRST so its index doesn't shift under LEFT
  list.splice(rightIdx, 1);
  list.splice(leftIdx, 1);

  // ------------------------
  // Insert the merged drive at leftIdx
  // ------------------------
  list.splice(leftIdx, 0, newDrive);

  return list;
}
