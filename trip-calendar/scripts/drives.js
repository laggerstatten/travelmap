(function() {
    const S = window.TripCal;

    window.addEventListener("DOMContentLoaded", () => {
        document.getElementById("gen-routes").onclick = async() => {
            console.log("Generate Routes clicked");

            for (let i = 0; i < S.events.length; i++) {
                const e = S.events[i];
                if (e.type !== "drive") continue; // only for drive segments

                // find nearest previous and next event that have coordinates
                const origin = [...S.events.slice(0, i)].reverse().find(ev => ev.lat && ev.lon);
                const destination = S.events.slice(i + 1).find(ev => ev.lat && ev.lon);

                if (!origin || !destination) {
                    console.warn("Skipping drive", e.name, "— missing origin or destination");
                    continue;
                }

                try {
                    const route = await getRouteInfo(origin, destination);
                    if (route) {
                        e.autoDrive = true; // mark that it was auto-generated / refreshed
                        e.manualEdit = false;
                        e.routeGeometry = route.geometry;
                        e.distanceKm = route.distance_km.toFixed(1);
                        e.durationMin = route.duration_min.toFixed(0);
                        console.log(`Route ${origin.name} → ${destination.name}: ${e.distanceKm} km`);
                    }
                } catch (err) {
                    console.error("Route failed", origin.name, "→", destination.name, err);
                }
            }

            S.save();
            S.renderTimeline();
        };
    });




    S.insertDriveSegments = function() {
        S.sortByDateInPlace(S.events);
        const out = [];
        for (let i = 0; i < S.events.length; i++) {
            const cur = S.events[i];
            out.push(cur);
            const next = S.events[i + 1];
            if (!next) break;
            if (cur.type !== "drive" && next.type !== "drive") {
                out.push({
                    id: S.newId(),
                    name: `Drive to ${next.name || "next stop"}`,
                    type: "drive",
                    autoDrive: true,
                    manualEdit: false,
                    start: cur.end || "",
                    end: ""
                });
            }
        }
        S.events = out;
        S.save();
    };

    S.clearAutoDrives = function() {
        S.events = S.events.filter(e => !(e.type === "drive" && e.autoDrive && !e.manualEdit));
        S.save();
    };
})();