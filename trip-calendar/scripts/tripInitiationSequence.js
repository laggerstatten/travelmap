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
  /**
    segs = await validateAndRepair(segs);
    //saveSegments(segs);
    //renderTimeline(segs);
  
    segs = annotateEmitters(segs);
    segs = determineEmitterDirections(segs, { priority: PLANNING_DIRECTION });
    segs = propagateTimes(segs);
    //saveSegments(segs);
    //renderTimeline(segs);
  
    // Compute slack/overlap
    segs = computeSlackAndOverlap(segs);
  */

  runPipeline(newList); // test 

  saveSegments(segs);
  renderTimeline(segs);
  renderMap(segs);

  console.log('Trip initialization complete.');
}

/* ===============================
   Queue Trip Origin / Destination
   =============================== */
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
      const startReady = segs.some(
        (s) => s.type === 'trip_start' && !s.isQueued
      );
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
  const placed = list.filter(seg => !seg.isQueued);
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

function removeAdjacentDrives(list) {
  let segments = [...list];

  for (let i = 0; i < segments.length - 1; i++) {
    if (segments[i].type === 'drive' && segments[i + 1].type === 'drive') {
      segments.splice(i, 2);
      i--;
    }
  }
  return segments;
}

function insertDriveSegments(list) {
  let segments = [...list];
  const out = [];
  for (let i = 0; i < segments.length; i++) {
    const cur = segments[i];
    out.push(cur);
    const next = segments[i + 1];
    if (!next) break;
    if (cur.type !== 'drive' && next.type !== 'drive') {
      out.push({
        // check to see if there are other attributes we need to push
        id: newId(),
        name: `Drive from ${cur.name || 'current stop'} to ${
          next.name || 'next stop'
        }`,
        type: 'drive',
        autoDrive: true,
        manualEdit: false,
        originId: cur.id,
        destinationId: next.id
      });
    }
  }
  return out;
}

async function generateRoutes(list) {
  //const segments = sortByDateInPlace([...list]);
  // // commenting this out to see if anything breaks
  // may need to be part of validate and repair function
  const segments = [...list];

  for (const seg of segments) {
    if (seg.type !== 'drive') continue;

    // Use explicit IDs first
    const origin = segments.find((ev) => ev.id === seg.originId);
    const destination = segments.find((ev) => ev.id === seg.destinationId);

    // Fallback: nearest non-drive neighbors
    const originAlt =
      origin ||
      [...segments.slice(0, segments.indexOf(seg))]
        .reverse()
        .find((ev) => ev.coordinates[1] && ev.coordinates[0]);
    const destAlt =
      destination ||
      segments
        .slice(segments.indexOf(seg) + 1)
        .find((ev) => ev.coordinates[1] && ev.coordinates[0]);
    const from = originAlt;
    const to = destAlt;

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
