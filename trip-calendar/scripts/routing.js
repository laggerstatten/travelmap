/* ===============================
   Trip Validation & Repair Module
   =============================== */

async function validateAndRepair() {
  // edit for slack / overlap

  removeAdjacentDrives();

  segments = segments.filter((seg) => {
    if (seg.type !== 'drive') return true;
    const origin = segments.find((x) => x.id === seg.originId);
    const dest = segments.find((x) => x.id === seg.destinationId);
    if (!origin || !dest) {
      return false;
    }
    return true;
  });

  insertDriveSegments();

  await generateRoutes();
  save();
  renderTimeline();
}

function removeAdjacentDrives() {
  // edit for slack / overlap

  let removed = 0;
  for (let i = 0; i < segments.length - 1; i++) {
    const a = segments[i];
    const b = segments[i + 1];
    if (a.type === 'drive' && b.type === 'drive') {
      segments.splice(i, 2); // remove both
      removed += 2;
      i--; // step back to recheck next pair
    }
  }

  if (removed > 0) {
    save();
    renderTimeline();
  }
}

function insertDriveSegments() {
  //edit to ignore slack and overlaps
  sortByDateInPlace(segments);
  const out = [];
  for (let i = 0; i < segments.length; i++) {
    const cur = segments[i];
    out.push(cur);
    const next = segments[i + 1];
    if (!next) break;
    if (cur.type !== 'drive' && next.type !== 'drive') {
      out.push({
        id: newId(),
        name: `Drive from ${cur.name || 'current stop'} to ${
          next.name || 'next stop'
        }`,
        type: 'drive',
        autoDrive: true,
        manualEdit: false,
        originId: cur.id,
        destinationId: next.id
        //start: cur.end || '',
        //end: ''
      });
    }
  }
  segments = out;
  save();
}

function sortByDateInPlace(list) {
  const dated = list.filter((seg) => parseDate(seg.start.utc));
  dated.sort((a, b) => parseDate(a.start.utc) - parseDate(b.start.utc));

  const merged = [];
  let di = 0;
  for (const seg of list) {
    if (!parseDate(seg.start.utc)) merged.push(seg);
    else merged.push(dated[di++]);
  }
  list.splice(0, list.length, ...merged);
}

function parseDate(v) {
  const d = new Date(v);
  return isNaN(d) ? null : d;
}

async function generateRoutes() {
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
        seg.duration = {val: (route.duration_min / 60).toFixed(2), lock: 'hard'};
        seg.originId = from.id;
        seg.destinationId = to.id;
      }
    } catch (err) {}
  }

  save();
  renderTimeline();
}

async function insertStopInNearestRoute(stop, segments) {
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

  save();
  renderTimeline();
}
