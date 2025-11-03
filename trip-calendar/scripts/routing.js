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
                originId: cur.id, // 🔹 track endpoints
                destinationId: next.id,
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

    for (const e of events) {
        if (e.type !== 'drive') continue;

        // Use explicit IDs first
        const origin = events.find((ev) => ev.id === e.originId);
        const destination = events.find((ev) => ev.id === e.destinationId);

        // Fallback: nearest non-drive neighbors
        const originAlt =
            origin || [...events.slice(0, events.indexOf(e))]
            .reverse()
            .find((ev) => ev.lat && ev.lon);
        const destAlt =
            destination ||
            events.slice(events.indexOf(e) + 1).find((ev) => ev.lat && ev.lon);
        const from = originAlt;
        const to = destAlt;

        if (!from || !to) {
            console.warn('Skipping drive', e.name, '— missing origin or destination');
            continue;
        }

        try {
            const route = await getRouteInfo(from, to);
            if (route) {
                e.autoDrive = true;
                e.routeGeometry = route.geometry;
                e.distanceMi = route.distance_mi.toFixed(1);
                e.durationMin = route.duration_min.toFixed(0);
                e.duration = (route.duration_min / 60).toFixed(2);
                e.originId = from.id; // 🔹 ensure kept
                e.destinationId = to.id;

                console.log(`Route ${from.name} → ${to.name}: ${e.distanceMi} mi`);
            }
        } catch (err) {
            console.error('Route failed', from.name, '→', to.name, err);
        }
    }

    save();
    renderTimeline();
};