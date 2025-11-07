function initTrip(segments) {
    const container = createTripInitUI();
    document.getElementById("calendar").prepend(container);

    const startBox = container.querySelector("#trip-start-search");
    const endBox = container.querySelector("#trip-end-search");
    [startBox, endBox].forEach(el => el.accessToken = mapboxgl.accessToken);

    const tripState = { start: {}, end: {} };

    startBox.addEventListener("retrieve", ev => handleRetrieve(ev, tripState, "start"));
    endBox.addEventListener("retrieve", ev => handleRetrieve(ev, tripState, "end"));

    container.querySelector(".cancel").onclick = () => container.remove();
    container.querySelector(".create").onclick = () =>
        handleCreateTrip(container, tripState, segments);
}

function createTripInitUI() {
    const div = document.createElement("div");
    div.className = "trip-init";
    div.innerHTML = `
    <div class="trip-init-fields">
        <label>Starting Location</label>
        <mapbox-search-box id="trip-start-search"></mapbox-search-box>
        <label>Start Date/Time</label>
        <input type="datetime-local" id="trip-start-time">
        <br>
        <label>Destination</label>
        <mapbox-search-box id="trip-end-search"></mapbox-search-box>
        <label>End Date/Time</label>
        <input type="datetime-local" id="trip-end-time">

        <div class="actions">
            <button class="small cancel">Cancel</button>
            <button class="small create">Create Trip</button>
        </div>
    </div>
    `;
    return div;
}

async function handleRetrieve(ev, tripState, key) {
    const f = ev.detail?.features?.[0];
    if (!f) return;

    // Build base object immediately
    const location = {
        name: f.properties?.name || f.place_name,
        coordinates: f.geometry.coordinates,
        location_name: f.properties?.place_formatted || f.place_name,
    };

    // Store base info immediately (so it's never empty)
    tripState[key] = location;

    // Then fetch timezone (async, augment in place)
    try {
        const tz = await getTimeZone(f.geometry.coordinates);
        location.timeZone = tz;
        console.log(`[${key}] resolved timezone:`, tz);
    } catch (err) {
        console.warn(`[${key}] timezone lookup failed:`, err);
    }

    console.log(`[${key}] tripState now:`, tripState[key]);
}



async function handleCreateTrip(container, tripState, segments) {
    const startInput = container.querySelector("#trip-start-time").value;
    const endInput = container.querySelector("#trip-end-time").value;

    if (!tripState.start.coordinates || !tripState.end.coordinates) {
        alert("Please choose both start and end points.");
        return;
    }

    // Ensure zones exist
  if (!tripState.start.timeZone) {
    tripState.start.timeZone = await getTimeZone(tripState.start.coordinates);
  }
  if (!tripState.end.timeZone) {
    tripState.end.timeZone = await getTimeZone(tripState.end.coordinates);
  }

    // Convert entered local times → UTC
    const startUTC = startInput ? localToUTC(startInput, tripState.start.timeZone) : "";
    const endUTC = endInput ? localToUTC(endInput, tripState.end.timeZone) : "";

    console.log("Converted start:", startUTC, "end:", endUTC);

    segments.length = 0;

    const startSegment = {
        id: newId(),
        ...tripState.start,
        type: "trip_start",
        isAnchorStart: true,
        endLock: 'hard',
        start: "",
        end: startUTC
    };

    const endSegment = {
        id: newId(),
        ...tripState.end,
        type: "trip_end",
        isAnchorEnd: true,
        startLock: 'hard',
        start: endUTC,
        end: ""
    };


    let driveSegment = {
        id: newId(),
        name: "Initial Drive",
        type: "drive",
        originId: startSegment.id,
        destinationId: endSegment.id
    };

    try {
        console.log("StartSegment ID:", startSegment.id);
        console.log("EndSegment ID:", endSegment.id);

        const route = await getRouteInfo(tripState.start, tripState.end);
        if (route) {
            Object.assign(driveSegment, {
                autoDrive: true,
                routeGeometry: route.geometry,
                distanceMi: route.distance_mi.toFixed(1),
                durationMin: route.duration_min.toFixed(0),
                duration: (route.duration_min / 60).toFixed(2)
            });
        }
    } catch (err) {
        console.error("Failed to get initial route:", err);
    }

    segments.push(startSegment, driveSegment, endSegment);
    save();
    container.remove();
}

