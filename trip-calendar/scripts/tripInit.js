// tripInit.js
// Function to initialize a new trip inline, similar to creating an event
function initTrip(events, saveFn, getRouteInfo, newId) {
    // Create temporary inline container
    const container = document.createElement("div");
    container.className = "trip-init";
    container.innerHTML = `
    <div class="trip-init-fields">
      <label>Starting Location</label>
      <mapbox-search-box id="trip-start-search"></mapbox-search-box>
      <label>Destination</label>
      <mapbox-search-box id="trip-end-search"></mapbox-search-box>
      <div class="actions">
        <button class="small cancel">Cancel</button>
        <button class="small create">Create Trip</button>
      </div>
    </div>
  `;
    document.getElementById("calendar").prepend(container);

    // Setup search boxes
    const startBox = container.querySelector("#trip-start-search");
    const endBox = container.querySelector("#trip-end-search");
    [startBox, endBox].forEach(el => el.accessToken = mapboxgl.accessToken);

    let tripStart = {},
        tripEnd = {};

    startBox.addEventListener("retrieve", ev => {
        const f = ev.detail ?.features ?.[0];
        if (f) {
            tripStart = {
                name: f.properties ?.name || f.place_name,
                lat: f.geometry.coordinates[1],
                lon: f.geometry.coordinates[0],
                location_name: f.properties ?.place_formatted || f.place_name
            };
        }
    });

    endBox.addEventListener("retrieve", ev => {
        const f = ev.detail ?.features ?.[0];
        if (f) {
            tripEnd = {
                name: f.properties ?.name || f.place_name,
                lat: f.geometry.coordinates[1],
                lon: f.geometry.coordinates[0],
                location_name: f.properties ?.place_formatted || f.place_name
            };
        }
    });

    // Cancel handler
    container.querySelector(".cancel").onclick = () => container.remove();

    // Create handler
    container.querySelector(".create").onclick = async() => {
        if (!tripStart.lat || !tripEnd.lat) {
            alert("Please choose both start and end points.");
            return;
        }

        // Clear existing trip
        events.length = 0;

        // Create start and end anchors
        const startEvent = {
            id: newId(),
            ...tripStart,
            type: "trip_start",
            isAnchorStart: true,
        };
        const endEvent = {
            id: newId(),
            ...tripEnd,
            type: "trip_end",
            isAnchorEnd: true,
        };

        // Build initial drive
        let driveEvent = {
            id: newId(),
            name: "Initial Drive",
            type: "drive",
            originId: startEvent.id,
            destinationId: endEvent.id
        };

        try {
            const route = await getRouteInfo(tripStart, tripEnd);
            if (route) {
                driveEvent = {
                    ...driveEvent,
                    autoDrive: true,
                    routeGeometry: route.geometry,
                    distanceMi: route.distance_mi.toFixed(1),
                    durationMin: route.duration_min.toFixed(0),
                    duration: (route.duration_min / 60).toFixed(2)
                };
            }
        } catch (err) {
            console.error("Failed to get initial route:", err);
        }

        // Assemble trip
        events.push(startEvent, driveEvent, endEvent);
        if (typeof saveFn === "function") saveFn();
        container.remove();
    };
}