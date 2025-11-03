/* ---------- Sorting (keep undated in place) ---------- */
function sortByDateInPlace(list) {
    const dated = list.filter((e) => parseDate(e.start));
    dated.sort((a, b) => parseDate(a.start) - parseDate(b.start));

    const merged = [];
    let di = 0;
    for (const e of list) {
        if (!parseDate(e.start)) merged.push(e);
        else merged.push(dated[di++]);
    }
    list.splice(0, list.length, ...merged);
};


function insertDriveSegments() {
    sortByDateInPlace(events);
    const out = [];
    for (let i = 0; i < events.length; i++) {
        const cur = events[i];
        out.push(cur);
        const next = events[i + 1];
        if (!next) break;
        if (cur.type !== 'drive' && next.type !== 'drive') {
            out.push({
                id: newId(),
                name: `Drive to ${next.name || 'next stop'}`,
                type: 'drive',
                autoDrive: true,
                manualEdit: false,
                start: cur.end || '',
                end: ''
            });
        }
    }
    events = out;
    save();
};


function clearAutoDrives() {
    events = events.filter(
        (e) => !(e.type === 'drive' && e.autoDrive && !e.manualEdit)
    );
    save();
};


async function generateRoutes() {
    console.log('Generate Routes clicked');

    for (let i = 0; i < events.length; i++) {
        const e = events[i];
        if (e.type !== 'drive') continue; // only for drive segments

        // find nearest previous and next event that have coordinates
        const origin = [...events.slice(0, i)]
            .reverse()
            .find((ev) => ev.lat && ev.lon);
        const destination = events
            .slice(i + 1)
            .find((ev) => ev.lat && ev.lon);

        if (!origin || !destination) {
            console.warn(
                'Skipping drive',
                e.name,
                '— missing origin or destination'
            );
            continue;
        }

        try {
            const route = await getRouteInfo(origin, destination);
            if (route) {
                //e.autoDrive = true; // mark that it was auto-generated / refreshed
                //e.manualEdit = false;
                e.routeGeometry = route.geometry;
                e.distanceMi = route.distance_mi.toFixed(1);
                e.durationMin = route.duration_min.toFixed(0);

                // duration field in hours (for start/end calc)
                e.duration = (route.duration_min / 60).toFixed(2);

                console.log(
                    `Route ${origin.name} → ${destination.name}: ${e.distanceMi} mi`
                );
            }
        } catch (err) {
            console.error(
                'Route failed',
                origin.name,
                '→',
                destination.name,
                err
            );
        }
    }

    save();
    renderTimeline();
};