
/* ===============================
   Trip Validation & Repair Module
   =============================== */

async function validateAndRepair(list) {
    // --- split into placed timeline vs queued ---
    const placed = list.filter(seg => !seg.isQueued); // check for errors
    const queued = list.filter(seg => seg.isQueued);
    // Work only on placed segments
    let segments = [...placed];

    segments = removeAdjacentDrives(segments);

    segments = segments.filter((seg) => {
        if (seg.type !== 'drive') return true;
        const origin = segments.find((x) => x.id === seg.originId);
        const dest = segments.find((x) => x.id === seg.destinationId);
        return origin && dest;
    });
    // do we need to sort by date here
    segments = insertDriveSegments(segments);
    segments = await generateRoutes(segments);

    const finalList = [...queued, ...segments];

    return finalList;
}

/**
 * UPDATE segments by checking for drives adjacent to each other and removing them
 * DELETE adjacent segments with drive type
 *
 * @param {*} list
 * @return {*}
 */

function removeAdjacentDrives(list) {
    let segments = [...list];

    for (let i = 0; i < segments.length - 1; i++) {
        if (segments[i].type === 'drive' && segments[i + 1].type === 'drive') {
            segments.splice(i, 2);
            i--;
        }
    }
    return segments;
}

/**
 * UPDATE segments by checking for non-drives adjacent to each other and inserting drives
 * CREATE segment with drive type
 *
 * @param {*} list
 * @return {*}
 */

function insertDriveSegments(list) {
    let segments = [...list];
    const out = [];
    for (let i = 0; i < segments.length; i++) {
        const cur = segments[i];
        out.push(cur);
        const next = segments[i + 1];
        if (!next) break;
        if (cur.type !== 'drive' && next.type !== 'drive') {
            out.push({
                // check to see if there are other attributes we need to push
                id: newId(),
                name: `Drive from ${cur.name || 'current stop'} to ${next.name || 'next stop'}`,
                type: 'drive',
                autoDrive: true,
                manualEdit: false,
                originId: cur.id,
                destinationId: next.id
            });
        }
    }
    return out;
}

/**
 * UPDATE segments by writing routing data for drive type segments
 * UPDATE segment
 *
 * @param {*} list
 * @return {*}
 */
async function generateRoutes(list) {
    //const segments = sortByDateInPlace([...list]);
    // commenting this out to see if anything breaks
    // may need to be part of validate and repair function
    const segments = [...list];

    for (const seg of segments) {
        if (seg.type !== 'drive') continue;

        // Use explicit IDs first
        const origin = segments.find((ev) => ev.id === seg.originId);
        const destination = segments.find((ev) => ev.id === seg.destinationId);

        // Fallback: nearest non-drive neighbors
        const originAlt = origin || [...segments.slice(0, segments.indexOf(seg))]
            .reverse()
            .find((ev) => ev.coordinates[1] && ev.coordinates[0]);
        const destAlt = destination ||
            segments
                .slice(segments.indexOf(seg) + 1)
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
                seg.duration = {
                    val: (route.duration_min / 60).toFixed(2),
                    lock: 'hard'
                };
                seg.originId = from.id;
                seg.destinationId = to.id;
                seg.originTz = from.timeZone;
                seg.destinationTz = to.timeZone;
            }
        } catch (err) { }
    }

    return segments;
}

function clearAutoDrives(list) {
    let segments = [...list];
    segments = segments.filter(
        (seg) => !(seg.type === 'drive' && seg.autoDrive && !seg.manualEdit)
    );
    return segments;
}

async function insertStopInNearestRoute(stop, list) {
    let segments = [...list];
    let timeWindow = getSegmentsInTimeWindow(stop, segments);

    if (!Array.isArray(timeWindow) || !timeWindow.length) {
        console.log('No time window found — falling back to all segments');
        timeWindow = [...segments];

        if (stop.start) delete stop.start.utc;
        if (stop.end) delete stop.end.utc;

    }

    const drives = timeWindow.filter(
        (ev) => ev.type === 'drive' && ev.routeGeometry
    );
    if (!drives.length) {
        console.warn("No drives found — appending stop.");
        segments.push(stop);
        return segments;
    }

    let bestDrive = null;
    let bestDist = Infinity;
    for (const d of drives) {
        const coords = d.routeGeometry ?.coordinates;
        if (!coords ?.length) continue;
        const mid = coords[Math.floor(coords.length / 2)];
        const dx = stop.coordinates[0] - mid[0];
        const dy = stop.coordinates[1] - mid[1];
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < bestDist) {
            bestDist = dist;
            bestDrive = d;
        }
    }
    if (!bestDrive) return;

    const origin = segments.find((seg) => seg.id === bestDrive.originId);
    const destination = segments.find(
        (seg) => seg.id === bestDrive.destinationId
    );

    if (!origin || !destination) {
        return;
    }

    if (!origin.coordinates || !destination.coordinates) return;

    const r1 = await getRouteInfo(origin, stop);
    const r2 = await getRouteInfo(stop, destination);
    if (!r1 || !r2) return;

    const newDrive1 = {
        id: newId(),
        type: 'drive',
        autoDrive: true,
        name: `Drive from ${origin.name} to ${stop.name}`,
        routeGeometry: r1.geometry,
        distanceMi: r1.distance_mi.toFixed(1),
        durationMin: r1.duration_min.toFixed(0),
        durationHr: (r1.duration_min / 60).toFixed(2),
        duration: { val: (r1.duration_min / 60).toFixed(2), lock: 'hard' },
        originId: origin.id,
        destinationId: stop.id,
        originTz: origin.timeZone,
        destinationTz: stop.timeZone,
    };

    const newDrive2 = {
        id: newId(),
        type: 'drive',
        autoDrive: true,
        name: `Drive from ${stop.name} to ${destination.name}`,
        routeGeometry: r2.geometry,
        distanceMi: r2.distance_mi.toFixed(1),
        durationMin: r2.duration_min.toFixed(0),
        durationHr: (r2.duration_min / 60).toFixed(2),
        duration: { val: (r2.duration_min / 60).toFixed(2), lock: 'hard' },
        originId: stop.id,
        destinationId: destination.id,
        originTz: stop.timeZone,
        destinationTz: destination.timeZone,
    };

    const tempIndex = segments.findIndex((seg) => seg.id === stop.id);
    if (tempIndex !== -1) segments.splice(tempIndex, 1);

    const driveIndex = segments.findIndex((seg) => seg.id === bestDrive.id);
    if (driveIndex === -1) {
        return;
    }

    segments.splice(driveIndex, 1, newDrive1, stop, newDrive2);
    return segments;
}


async function removeStopAndHealRouteIfNeeded(seg, list, idx) {
    const left = list[idx - 1];
    const right = list[idx];

    if (left ?.type === "drive" && right ?.type === "drive") {
        return await removeStopAndHealRoute(seg, list, idx);
    }

    return list;
}

async function removeStopAndHealRoute(stop, list, idx) {
    const left = list[idx - 1];
    const right = list[idx];

    if (!left || !right) return list;
    if (left.type !== "drive" || right.type !== "drive") return list;

    const origin = list.find(s => s.id === left.originId);
    const destination = list.find(s => s.id === right.destinationId);

    if (!origin || !destination) return list;

    const r = await getRouteInfo(origin, destination);
    if (!r) return list;

    const newDrive = {
        id: newId(),
        type: "drive",
        autoDrive: true,
        name: `Drive from ${origin.name} to ${destination.name}`,
        routeGeometry: r.geometry,
        distanceMi: r.distance_mi.toFixed(1),
        durationMin: r.duration_min.toFixed(0),
        durationHr: (r.duration_min / 60).toFixed(2),
        duration: { val: (r.duration_min / 60).toFixed(2), lock: "hard" },
        originId: origin.id,
        destinationId: destination.id,
        originTz: origin.timeZone,
        destinationTz: destination.timeZone,
    };

    // Remove [left-drive, stop, right-drive]
    list.splice(idx + 1, 1);
    list.splice(idx, 1);
    list.splice(idx - 1, 1);

    // Insert merged drive
    list.splice(idx - 1, 0, newDrive);

    return list;
}







