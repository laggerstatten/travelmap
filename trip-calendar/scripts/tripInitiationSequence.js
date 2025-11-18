/* ===============================
   Trip Initialization (Async)
   =============================== */
async function initTrip() {
  console.log('Initializing trip...');

  let segs = loadSegments();

  // queue anchors in-memory, then persist once
  queueTripOrigin(segs);
  queueTripDestination(segs);
  saveSegments(segs);
  renderTimeline(segs);
  console.log('Waiting for trip anchors...');
  await waitForTripAnchorsReady();

  segs = loadSegments();

  segs = await runPipeline(segs); // test 
  console.log(segs);
  saveSegments(segs);
  renderTimeline(segs);
  renderMap(segs);

  console.log('Trip initialization complete.');
}

/* ===============================
   Queue Trip Origin / Destination
   =============================== */
/**
 * CREATE a new segment with the trip_start type and hard end lock
 *
 * @param {*} segments
 */
function queueTripOrigin(segments) {
  const seg = {
    id: newId(),
    name: '(untitled)',
    type: 'trip_start',
    isAnchorStart: true,
    start: { lock: 'undefined', utc: '' },
    end: { lock: 'hard', utc: '' },
    isQueued: true,
    openEditor: true
  };

  segments.unshift(seg);
}

/**
 * CREATE a new segment with the trip_end type and hard start lock
 *
 * @param {*} segments
 */
function queueTripDestination(segments) {
  const seg = {
    id: newId(),
    name: '(untitled)',
    type: 'trip_end',
    isAnchorEnd: true,
    start: { lock: 'hard', utc: '' },
    end: { lock: 'undefined', utc: '' },
    isQueued: true,
    openEditor: true
  };

  segments.push(seg);
}

/* ===============================
   Helper: Wait for Anchors Ready
   =============================== */
function waitForTripAnchorsReady() {
  return new Promise((resolve) => {
    const check = () => {
      const segs = loadSegments();
      const startReady = segs.some((s) => s.type === 'trip_start' && !s.isQueued);
      const endReady = segs.some((s) => s.type === 'trip_end' && !s.isQueued);
      if (startReady && endReady) resolve();
      else requestAnimationFrame(check);
    };
    check();
  });
}

/* ===============================
   Trip Validation & Repair Module
   =============================== */

async function validateAndRepair(list) {
  // --- split into placed timeline vs queued ---
  const placed = list.filter(seg => !seg.isQueued); // check for errors
  const queued = list.filter(seg => seg.isQueued);
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
  const bothDrives =
    first?.type === "drive" && second?.type === "drive";

  if (areAdjacent && bothDrives) {
    // mutate list in place: remove both
    segments.splice(firstIdx, 2);
    return segments; // return the mutated list
  }

  // No removal needed -> return original list
  return segments;
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

function insertDriveBetweenById(segments, idA, idB) {
  const idxA = segments.findIndex(s => s.id === idA);
  const idxB = segments.findIndex(s => s.id === idB);

  if (idxA === -1 || idxB === -1) {
    // They were already modified/removed earlier
    return false;
  }

  // normalize order
  const firstIdx  = Math.min(idxA, idxB);
  const secondIdx = Math.max(idxA, idxB);

  const first  = segments[firstIdx];
  const second = segments[secondIdx];

  const areAdjacent = secondIdx === firstIdx + 1;
  if (!areAdjacent) return false;

  // The rule: insert a drive only if both are non-drive
  const shouldInsert =
    first?.type !== "drive" &&
    second?.type !== "drive";

  if (!shouldInsert) return false;

  // Create new drive segment
  const driveSeg = {
    id: newId(),
    name: `Drive from ${first.name || "current stop"} to ${
      second.name || "next stop"
    }`,
    type: "drive",
    autoDrive: true,
    manualEdit: false,
    originId: first.id,
    destinationId: second.id,
  };

  // Mutate list IN PLACE
  // Insert between firstIdx and secondIdx
  segments.splice(firstIdx + 1, 0, driveSeg);

  return true;
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

/**
  function sortByDateInPlace(list = []) {
    const dated = list.filter((seg) => parseDate(seg?.start?.utc));
    dated.sort((a, b) => parseDate(a?.start?.utc) - parseDate(b?.start?.utc));
  
    const merged = [];
    let di = 0;
    for (const seg of list) {
      if (!parseDate(seg?.start?.utc)) merged.push(seg);
      else merged.push(dated[di++]);
    }
    list.splice(0, list.length, ...merged);
    return list;
  }
*/


function segLabel(seg, segments) {
  if (!seg) return '(unknown)';
  if (seg.name) return seg.name;
  if (seg.type === 'drive') {
    const origin = segments.find(s => s.id === seg.originId);
    const dest   = segments.find(s => s.id === seg.destinationId);
    return `Drive: ${origin?.name || '?'} → ${dest?.name || '?'}`;
  }
  return seg.id;
}
