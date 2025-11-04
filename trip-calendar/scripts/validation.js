/* ===============================
   Trip Validation & Repair Module
   =============================== */

async function validateAndRepair() {
    console.group("🧩 repairAllRoutes");

    // 1️⃣ Remove duplicates (adjacent drives)
    removeAdjacentDrives();

    // 2️⃣ Remove invalid drives (no origin/dest in list)
    events = events.filter(e => {
        if (e.type !== "drive") return true;
        const origin = events.find(x => x.id === e.originId);
        const dest = events.find(x => x.id === e.destinationId);
        if (!origin || !dest) {
            console.warn(`🗑 Removing orphaned drive ${e.name}`);
            return false;
        }
        return true;
    });

    // 3️⃣ Fill in missing drives using your existing loop
    insertDriveSegments();

    // 4️⃣ Regenerate routes for new drives
    await generateRoutes();

    save();
    renderTimeline();

    console.groupEnd();
}

function removeAdjacentDrives() {
    console.group("🧹 removeAdjacentDrives");

    let removed = 0;
    for (let i = 0; i < events.length - 1; i++) {
        const a = events[i];
        const b = events[i + 1];
        if (a.type === "drive" && b.type === "drive") {
            console.log(`Removing adjacent drives: ${a.name} / ${b.name}`);
            events.splice(i, 2); // remove both
            removed += 2;
            i--; // step back to recheck next pair
        }
    }

    if (removed > 0) {
        console.warn(`🗑 Removed ${removed} adjacent drive(s).`);
        save();
        renderTimeline();
    } else {
        console.log("✅ No adjacent drives found.");
    }

    console.groupEnd();
}



function hasCoords(e) {
    return e && typeof e.lat === "number" && typeof e.lon === "number";
}

/* ===============================
   Timing Fill Helpers
   =============================== */

/**
 * Forward-fill times from start → end.
 * Propagates start/end times based on durations
 * until a null is found.
 */
function forwardFillTimes(events) {
    for (let i = 0; i < events.length - 1; i++) {
        const cur = events[i];
        const next = events[i + 1];
        const dur = Number(cur.duration) || 0;

        // Fill missing end (unless manually set)
        if (!cur.end && cur.start && !cur.manualEnd) {
            cur.end = window.TripCal.endFromDuration(cur.start, dur);
        }

        // Forward-fill next start (stop only if next has manualStart)
        if (cur.end && next && !next.start) {
            next.start = cur.end;
        }
        if (next && next.manualStart) break;
    }
    return events;
}


/**
 * Back-fill times from end → start.
 * Works backwards until a missing value is hit.
 */

function backFillTimes(events) {
    for (let i = events.length - 1; i > 0; i--) {
        const cur = events[i];
        const prev = events[i - 1];
        const dur = Number(cur.duration) || 0;

        // Fill missing start (unless manually set)
        if (!cur.start && cur.end && !cur.manualStart) {
            const d = new Date(cur.end);
            d.setHours(d.getHours() - dur);
            cur.start = d.toISOString().slice(0, 16);
        }

        // Back-fill previous end (stop only if prev.manualEnd)
        if (cur.start && prev && !prev.end) {
            prev.end = cur.start;
        }
        if (prev && prev.manualEnd) break;
    }
    return events;
}

// helper
function addMinutes(baseIso, mins) {
    // assume baseIso in "YYYY-MM-DDTHH:mm" local form
    const [datePart, timePart] = baseIso.split("T");
    const [year, month, day] = datePart.split("-").map(Number);
    const [hour, minute] = timePart.split(":").map(Number);

    const d = new Date(year, month - 1, day, hour, minute); // local Date
    d.setMinutes(d.getMinutes() + mins);

    // re-emit as local YYYY-MM-DDTHH:mm (no timezone conversion)
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}


/* ===============================
   Per-card Fill FORWARD
   =============================== */
function fillForward(fromEvent) {
    const idx = events.findIndex(ev => ev.id === fromEvent.id);
    if (idx === -1) return;

    let cursor = fromEvent.end || fromEvent.start;
    if (!cursor) return;

    for (let i = idx + 1; i < events.length; i++) {
        const e = events[i];

        // stop at manual arrival/start boundary
        if (e.manualStart) break;

        if (e.type === "trip_end") {
            // set arrival if not manual; then stop
            if (!e.manualStart) e.start = cursor;
            break;
        }

        // set start unless manual
        if (!e.manualStart) e.start = cursor;

        // compute end unless manual
        const durHrs = Number(e.duration) || 0;
        if (!e.manualEnd) e.end = addMinutes(e.start, durHrs * 60);

        // advance cursor to end if present, else start
        cursor = e.end || e.start;
    }

    save();
    renderTimeline();
}

/* ===============================
   Per-card Fill BACKWARD
   =============================== */
function fillBackward(fromEvent) {
    const idx = events.findIndex(ev => ev.id === fromEvent.id);
    if (idx === -1) {
        console.warn("fillBackward: event not found", fromEvent.name);
        return;
    }

    let cursor = fromEvent.start || fromEvent.end;
    if (!cursor) {
        console.warn("fillBackward: no valid start/end for", fromEvent.name);
        return;
    }

    console.group(`⏪ fillBackward from "${fromEvent.name}" (${cursor})`);

    for (let i = idx - 1; i >= 0; i--) {
        const e = events[i];
        console.log(`→ [${i}] ${e.name} (${e.type})`);
        console.log(`   before start=${e.start || '-'} end=${e.end || '-'} dur=${e.duration}`);

        if (e.manualEnd || e.manualStart) {
            console.log("   🛑 Stop: manual field found");
            break;
        }

        if (e.type === "trip_start") {
            if (!e.manualEnd && !e.end) {
                e.end = cursor;
                console.log(`   set trip_start.end = ${e.end}`);
            }
            break;
        }

        if (!e.manualEnd) {
            e.end = cursor;
            console.log(`   updated end = ${e.end}`);
        }

        const durHrs = Number(e.duration) || 0;
        if (!e.manualStart) {
            e.start = addMinutes(e.end, -durHrs * 60);
            console.log(`   calc start = ${e.start} (−${durHrs}h)`);
        }

        cursor = e.start || e.end;
        console.log(`   cursor -> ${cursor}`);
    }

    console.groupEnd();
    save(true);
    renderTimeline();
}


function clearAllTimesAndFlags() {
    if (!confirm("Clear all start/end times and manual flags?")) return;

    events.forEach(e => {
        // preserve drive duration (if from routing)
        const keepDuration = e.type === "drive" && e.duration;

        // wipe all time fields
        delete e.start;
        delete e.end;

        // reset duration only for non-drives
        if (!keepDuration) e.duration = "";

        // clear manual flags
        delete e.manualStart;
        delete e.manualEnd;
        delete e.manualDuration;
        delete e.manualEdit;
    });

    save();
    renderTimeline();
}