function snap(obj) {
  return JSON.parse(JSON.stringify(obj));
}


async function movePlacedStop(seg, targetIndex) {
    console.log("=== MOVE PLACED STOP ===");
    console.log("Stop:", seg.name, seg.id, "→ targetIndex:", targetIndex);

    const before = loadSegments();
    console.log("Before snapshot:", snap(before));

    let list = [...before];

    // PART A
    console.log("Part A: Removing stop from original position...");
    let { list: withoutSeg, idx: oldIdx } = removeSegmentFromList(list, seg);
    console.log("Old index:", oldIdx);
    console.log("After raw removal:", snap(withoutSeg));

    withoutSeg = await removeStopAndHealRouteIfNeeded(seg, withoutSeg, oldIdx);
    console.log("After healing old corridor:", snap(withoutSeg));

    // PART C (Insert)
    console.log("Part C: Inserting at target index:", targetIndex);
    const withInserted = insertStopAtIndex(withoutSeg, seg, targetIndex);
    console.log("After insertion:", snap(withInserted));

    console.log("Running splitCorridorIfNeeded…");
    const final = await splitCorridorIfNeeded(withInserted, targetIndex, before);
    console.log("After split (Part C final):", snap(final));

    console.log("=== END MOVE ===");

    const piped = await runPipeline(final);
    console.log("After pipeline:", snap(piped));

    saveSegments(piped);
    renderTimeline(piped);
    renderMap(piped);

    return piped;
}


function insertStopAtIndex(list, seg, targetIndex) {
    const out = [...list];

    // Clamp index
    const idx = Math.max(0, Math.min(targetIndex, out.length));

    out.splice(idx, 0, seg);
    return out;
}

function isStopLike(s) {
    return s.type === "stop" ||
           s.type === "trip_start" ||
           s.type === "trip_end";
}

function findStopNeighbors(list, stopIndex) {
    console.log("  findStopNeighbors at index", stopIndex);

    let leftStop = null;
    let rightStop = null;

    for (let i = stopIndex - 1; i >= 0; i--) {
        if (isStopLike(list[i])) {
            leftStop = list[i];
            break;
        }
    }

    for (let i = stopIndex + 1; i < list.length; i++) {
        if (isStopLike(list[i])) {
            rightStop = list[i];
            break;
        }
    }

    console.log("    Left stop:", leftStop ? leftStop.name : null);
    console.log("    Right stop:", rightStop ? rightStop.name : null);

    return { leftStop, rightStop };
}


function corridorHadDrive(beforeList, A, B) {
    console.log(`  Checking if corridor existed: ${A.name} → ${B.name}`);

    const existed = beforeList.some(d =>
        d.type === "drive" &&
        d.originId === A.id &&
        d.destinationId === B.id
    );

    console.log("    existed?", existed);

    return existed;
}


function removeCorridorDrives(list, A, B) {
    console.log(`  Removing corridor drives: ${A.name} → ${B.name}`);

    const before = snap(list);

    const out = list.filter(d =>
        !(d.type === "drive" &&
          d.originId === A.id &&
          d.destinationId === B.id)
    );

    const removed = before.filter(d =>
        d.type === "drive" &&
        d.originId === A.id &&
        d.destinationId === B.id
    );

    console.log("    Removed drives:", snap(removed));
    console.log("    List after removal:", snap(out));

    return out;
}


/**
    function removeCorridorDrives(list, A, B) {
    
        // Remove ANY drive whose origin/destination match the A→B corridor,
        // even if DOM reordering moved it somewhere weird.
        return list.filter(d => {
            if (d.type !== "drive") return true;
            if (d.originId === A.id && d.destinationId === B.id) return false;
            return true;
        });
    }
*/



async function buildSplitDrives(A, X, B) {
    const r1 = await getRouteInfo(A, X);
    const r2 = await getRouteInfo(X, B);

    if (!r1 || !r2) return null;

    const d1 = {
        id: newId(),
        type: "drive",
        autoDrive: true,
        name: `Drive from ${A.name} to ${X.name}`,
        routeGeometry: r1.geometry,
        distanceMi: r1.distance_mi.toFixed(1),
        durationMin: r1.duration_min.toFixed(0),
        durationHr: (r1.duration_min / 60).toFixed(2),
        duration: { val: (r1.duration_min / 60).toFixed(2), lock: "hard" },
        originId: A.id,
        destinationId: X.id,
        originTz: A.timeZone,
        destinationTz: X.timeZone,
    };

    const d2 = {
        id: newId(),
        type: "drive",
        autoDrive: true,
        name: `Drive from ${X.name} to ${B.name}`,
        routeGeometry: r2.geometry,
        distanceMi: r2.distance_mi.toFixed(1),
        durationMin: r2.duration_min.toFixed(0),
        durationHr: (r2.duration_min / 60).toFixed(2),
        duration: { val: (r2.duration_min / 60).toFixed(2), lock: "hard" },
        originId: X.id,
        destinationId: B.id,
        originTz: X.timeZone,
        destinationTz: B.timeZone,
    };

    return { d1, d2 };
}

async function splitCorridorIfNeeded(list, stopIndex, beforeList) {
    console.log("=== splitCorridorIfNeeded ===");
    console.log("  stopIndex:", stopIndex);

    const X = list[stopIndex];
    console.log("  Stop:", X ? X.name : null);

    if (!X || X.type !== "stop") {
        console.log("  Not a stop — skipping split.");
        return list;
    }

    const { leftStop: A, rightStop: B } = findStopNeighbors(list, stopIndex);
    if (!A || !B) {
        console.log("  Missing neighbors — no corridor to split.");
        return list;
    }

    console.log(`  Corridor candidates: ${A.name} → ${X.name} → ${B.name}`);

    const existed = corridorHadDrive(beforeList, A, B);
    if (!existed) {
        console.log("  No original corridor — do NOT split.");
        return list;
    }

    console.log("  Corridor existed — performing split.");

    let out = removeCorridorDrives(list, A, B);

    const newIdx = out.findIndex(s => s.id === X.id);
    console.log("  newIdx after cleanup:", newIdx);

    const drives = await buildSplitDrives(A, X, B);
    console.log("  Built drives:", snap(drives));

    if (!drives) {
        console.log("  Failed to build split drives.");
        return out;
    }

    out.splice(newIdx, 0, drives.d1);
    out.splice(newIdx + 2, 0, drives.d2);

    console.log("  After inserting split drives:", snap(out));

    console.log("=== end splitCorridorIfNeeded ===");
    return out;
}




