async function ensureAnchorsAndAddStop(events, saveFn, renderFn) {
  console.group('🆕 ensureAnchorsAndAddStop');

  // 1️⃣ Ensure trip anchors exist
  const hasStart = events.some((e) => e.type === 'trip_start');
  const hasEnd = events.some((e) => e.type === 'trip_end');

  if (!hasStart) {
    events.unshift({
      id: newId(),
      name: 'Trip Start',
      type: 'trip_start',
      isAnchorStart: true
    });
  }

  if (!hasEnd) {
    events.push({
      id: newId(),
      name: 'Trip End',
      type: 'trip_end',
      isAnchorEnd: true
    });
  }

  // 2️⃣ Create temporary stop at top of timeline
  const newStop = {
    id: newId(),
    name: '(untitled)',
    type: 'stop',
    isTemporary: true
  };
  events.unshift(newStop);

  if (typeof saveFn === 'function') saveFn(false);
  if (typeof renderFn === 'function') renderFn();

  // 3️⃣ After render, open inline editor and attach single retrieve handler
  setTimeout(() => {
    const card = document.querySelector(`.event[data-id="${newStop.id}"]`);
    if (!card) return;
    if (typeof window.buildInlineEditor === 'function')
      buildInlineEditor(newStop, card);

    setTimeout(() => {
      const editor = card.querySelector('.inline-editor');
      if (!editor) return;

      // intercept Save submit from inline editor
      editor.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const data = Object.fromEntries(new FormData(editor).entries());
        Object.assign(newStop, data);

        // derive duration-based end time if needed
        if (data.duration && data.start) {
          newStop.end = window.TripCal.endFromDuration(
            data.start,
            data.duration
          );
        }

        // confirm lat/lon exist before proceeding
        if (!newStop.lat || !newStop.lon) {
          console.warn('Stop missing coordinates – skipping placement');
          window.TripCal.save();
          window.TripCal.renderTimeline();
          return;
        }

        delete newStop.isTemporary;
        console.log('💾 Saving and inserting new stop:', newStop);
        await insertStopInNearestRoute(newStop, events, saveFn, renderFn);
      });
    }, 100);
  }, 100);
}

async function insertStopInNearestRoute(stop, events, saveFn, renderFn) {
  console.group('🧭 insertStopInNearestRoute');
  console.log('stop:', stop);

  const drives = events.filter((ev) => ev.type === 'drive' && ev.routeGeometry);
  console.log('candidate drives:', drives.length);
  if (!drives.length) {
    console.warn('No drives with geometry');
    console.groupEnd();
    return;
  }

  let bestDrive = null;
  let bestDist = Infinity;
  for (const d of drives) {
    const coords = d.routeGeometry?.coordinates;
    if (!coords?.length) {
      console.warn('drive has no coordinates:', d);
      continue;
    }
    const mid = coords[Math.floor(coords.length / 2)];
    const dx = stop.lon - mid[0];
    const dy = stop.lat - mid[1];
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < bestDist) {
      bestDist = dist;
      bestDrive = d;
    }
  }
  console.log('bestDrive:', bestDrive);
  if (!bestDrive) {
    console.warn('No bestDrive found');
    console.groupEnd();
    return;
  }

  const origin = events.find((e) => e.id === bestDrive.originId);
  const destination = events.find((e) => e.id === bestDrive.destinationId);
  console.log('origin:', origin);
  console.log('destination:', destination);

  if (!origin || !destination) {
    console.warn('Missing origin or destination object for drive:', bestDrive);
    console.groupEnd();
    return;
  }

  if (!origin.lat || !origin.lon || !destination.lat || !destination.lon) {
    console.error('Origin/destination missing lat/lon', {
      originLat: origin.lat,
      originLon: origin.lon,
      destLat: destination.lat,
      destLon: destination.lon
    });
    console.groupEnd();
    return;
  }

  console.log('Calling getRouteInfo(origin, stop)');
  const r1 = await getRouteInfo(origin, stop);
  console.log('r1:', r1);

  console.log('Calling getRouteInfo(stop, destination)');
  const r2 = await getRouteInfo(stop, destination);
  console.log('r2:', r2);

  if (!r1 || !r2) {
    console.warn('One or both route results missing');
    console.groupEnd();
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
    destinationId: stop.id
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
    destinationId: destination.id
  };

  // remove temp and replace old drive
  const tempIndex = events.findIndex((e) => e.id === stop.id);
  if (tempIndex !== -1) events.splice(tempIndex, 1);

  const driveIndex = events.findIndex((e) => e.id === bestDrive.id);
  if (driveIndex === -1) {
    console.warn('Could not find bestDrive index for replacement');
    console.groupEnd();
    return;
  }

  events.splice(driveIndex, 1, newDrive1, stop, newDrive2);

  if (typeof saveFn === 'function') saveFn();
  if (typeof renderFn === 'function') renderFn();

  console.groupEnd();
}
