function clearAutoDrives() {
    segments = segments.filter(
        (seg) => !(seg.type === 'drive' && seg.autoDrive && !seg.manualEdit)
    );
    save();
};

function parseDate(v) {
    const d = new Date(v);
    return isNaN(d) ? null : d;
};

/* ---------- Sorting (keep undated in place) ---------- */
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
};

function insertDriveSegments() { //edit to ignore slack and overlaps
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
                name: `Drive from ${cur.name || 'current stop'} to ${next.name || 'next stop'}`,
                type: 'drive',
                autoDrive: true,
                manualEdit: false,
                originId: cur.id,
                destinationId: next.id,
                //start: cur.end || '',
                //end: ''
            });
        }
    }
    segments = out;
    save();
};

async function generateRoutes() {
    for (const seg of segments) {
        if (seg.type !== 'drive') continue;

        // Use explicit IDs first
        const origin = segments.find((ev) => ev.id === seg.originId);
        const destination = segments.find((ev) => ev.id === seg.destinationId);

        // Fallback: nearest non-drive neighbors
        const originAlt =
            origin || [...segments.slice(0, segments.indexOf(seg))]
                .reverse()
                .find((ev) => ev.coordinates[1] && ev.coordinates[0]);
        const destAlt =
            destination || segments.slice(segments.indexOf(seg) + 1)
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
                seg.duration.val = (route.duration_min / 60).toFixed(2);
                seg.originId = from.id;
                seg.destinationId = to.id;
                seg.duration.lock = 'hard';
            }
        } catch (err) { }
    }

    save();
    renderTimeline();
};