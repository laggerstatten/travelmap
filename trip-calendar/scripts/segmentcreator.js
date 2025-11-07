function queueStop(segments) {
  const newStop = {
    id: newId(),
    name: '(untitled)',
    type: 'stop',
    isQueued: true
  };
  segments.unshift(newStop);

  save();
  renderTimeline();

  // Open editor for queued stop
  setTimeout(() => {
    const card = document.querySelector(`.segment[data-id="${newStop.id}"]`);
    if (!card) return;
    buildOnCardEditor(newStop, card);
  }, 50);
}

async function insertQueuedStops(segments) {
  const queued = segments.filter((s) => s.isQueued);
  if (!queued.length) {
    alert('No queued stops to insert.');
    return;
  }

  // Example: show a selection dialog, or auto-insert sequentially
  for (const stop of queued) {
    if (!stop.coordinates) continue; // skip incomplete
    delete stop.isQueued;
    await insertStopInNearestRoute(stop, segments);
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

  if (
    !origin.coordinates ||
    !destination.coordinates
  ) {
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
