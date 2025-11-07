async function addStop(segments) {
  // 2️⃣ Create temporary stop at top of timeline
  const newStop = {
    id: newId(),
    name: '(untitled)',
    type: 'stop',
    isTemporary: true
  };
  segments.unshift(newStop);

  save();
  renderTimeline();

  // 3️⃣ After render, open oncard editor and attach single retrieve handler
  setTimeout(() => {
    const card = document.querySelector(`.segment[data-id="${newStop.id}"]`);
    if (!card) return;
    buildOnCardEditor(newStop, card);

    setTimeout(() => {
      const editor = card.querySelector('.oncard-editor');
      if (!editor) return;

      // intercept Save submit from oncard editor
      editor.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const data = Object.fromEntries(new FormData(editor).entries());
        Object.assign(newStop, data);

        // derive duration-based end time if needed
        if (data.duration && data.start) {
          newStop.end = endFromDuration(data.start, data.duration);
        }

        // confirm lat/lon exist before proceeding
        if (!newStop.coordinates) {
          save();
          renderTimeline();
          return;
        }

        delete newStop.isTemporary;
        await insertStopInNearestRoute(newStop, segments);
      });
    }, 100);
  }, 100);
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
    !origin.coordinates[1] ||
    !origin.coordinates[0] ||
    !destination.coordinates[1] ||
    !destination.coordinates[0]
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
    duration: (r1.duration_min / 60).toFixed(2),
    originId: origin.id,
    destinationId: stop.id,
    durationLock: 'hard'
  };

  const newDrive2 = {
    id: newId(),
    type: 'drive',
    autoDrive: true,
    routeGeometry: r2.geometry,
    distanceMi: r2.distance_mi.toFixed(1),
    durationMin: r2.duration_min.toFixed(0),
    duration: (r2.duration_min / 60).toFixed(2),
    originId: stop.id,
    destinationId: destination.id,
    durationLock: 'hard'
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
