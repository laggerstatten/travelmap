async function ensureAnchorsAndAddStop(events, saveFn, renderFn) {
    // 1️⃣ Ensure trip anchors exist
    const hasStart = events.some(e => e.type === 'trip_start');
    const hasEnd = events.some(e => e.type === 'trip_end');

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

    // 2️⃣ Create the temporary stop and put it at the top of the timeline
    const newStop = {
        id: newId(),
        name: '(untitled)',
        type: 'stop',
        isTemporary: true
    };
    events.unshift(newStop);

    if (typeof saveFn === 'function') saveFn(false); // save without rerender
    if (typeof renderFn === 'function') renderFn();

    // 3️⃣ Wait for DOM update, then open the inline editor for this stop
    setTimeout(() => {
        const card = document.querySelector(`.event[data-id="${newStop.id}"]`);
        if (card && typeof window.buildInlineEditor === 'function') {
            buildInlineEditor(newStop, card);

            // Wait a bit for the searchbox to be rendered inside the editor
            setTimeout(() => {
                const searchEl = card.querySelector("mapbox-search-box");
                if (searchEl) {
                    searchEl.addEventListener("retrieve", async(ev) => {
                        const f = ev.detail ?.features ?.[0];
                        if (!f ?.geometry) return;

                        newStop.lat = f.geometry.coordinates[1];
                        newStop.lon = f.geometry.coordinates[0];
                        newStop.location_name = f.properties ?.place_formatted || f.place_name;
                        if (!newStop.name || newStop.name === "(untitled)") newStop.name = newStop.location_name;

                        delete newStop.isTemporary;
                        await insertStopInNearestRoute(newStop, events, saveFn, getRouteInfo, renderFn);
                    });
                }
            }, 100);
        }
    }, 100);


    // 4️⃣ Hook into the Mapbox searchbox "retrieve" event for auto-placement
    document.addEventListener('retrieve', async(ev) => {
        const f = ev.detail ?.features ?.[0];
        if (!f ?.geometry) return;

        // Apply geocode results
        newStop.lat = f.geometry.coordinates[1];
        newStop.lon = f.geometry.coordinates[0];
        newStop.location_name = f.properties ?.place_formatted || f.place_name;
        if (!newStop.name || newStop.name === '(untitled)') newStop.name = newStop.location_name;

        delete newStop.isTemporary;
        await insertStopInNearestRoute(newStop, events, saveFn, renderFn);
    }, { once: true }); // only listen for the first retrieve
}

async function insertStopInNearestRoute(stop, events, saveFn, renderFn) {
  console.log("insertStopInNearestRoute");

  // 1️⃣ Find drives with geometry
  const drives = events.filter(ev => ev.type === "drive" && ev.routeGeometry);
  if (!drives.length) return;

  // 2️⃣ Find the nearest drive midpoint
  let bestDrive = null;
  let bestDist = Infinity;
  for (const d of drives) {
    const coords = d.routeGeometry.coordinates;
    if (!coords?.length) continue;
    const mid = coords[Math.floor(coords.length / 2)];
    const dx = stop.lon - mid[0];
    const dy = stop.lat - mid[1];
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < bestDist) {
      bestDist = dist;
      bestDrive = d;
    }
  }
  if (!bestDrive) return;

  // 3️⃣ Use explicit IDs to find origin/destination
  const origin = events.find(e => e.id === bestDrive.originId);
  const destination = events.find(e => e.id === bestDrive.destinationId);
  if (!origin || !destination) {
    console.warn("Missing origin or destination IDs for bestDrive");
    return;
  }

  // 4️⃣ Compute new routes
  const r1 = await getRouteInfo(origin, stop);
  const r2 = await getRouteInfo(stop, destination);
  if (!r1 || !r2) return;

  // 5️⃣ Create new drive objects
  const newDrive1 = {
    id: newId(),
    type: "drive",
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
    type: "drive",
    autoDrive: true,
    routeGeometry: r2.geometry,
    distanceMi: r2.distance_mi.toFixed(1),
    durationMin: r2.duration_min.toFixed(0),
    duration: (r2.duration_min / 60).toFixed(2),
    originId: stop.id,
    destinationId: destination.id
  };

  // 6️⃣ Remove the old drive and any existing temp copy of this stop
  const tempIndex = events.findIndex(e => e.id === stop.id);
  if (tempIndex !== -1) events.splice(tempIndex, 1);

  const driveIndex = events.findIndex(e => e.id === bestDrive.id);
  if (driveIndex === -1) return;

  // 7️⃣ Replace that drive with [newDrive1, stop, newDrive2]
  events.splice(driveIndex, 1, newDrive1, stop, newDrive2);

  // 8️⃣ Save and refresh
  if (typeof saveFn === "function") saveFn();
  if (typeof renderFn === "function") renderFn();
}

