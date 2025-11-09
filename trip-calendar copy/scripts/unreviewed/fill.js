/* ===============================
   Timing Fill Helpers
   =============================== */

/**
 * Forward-fill times from start → end.
 * Propagates start/end times based on durations
 * until a null is found.
 */
function forwardFillTimes(segments) {
    for (let i = 0; i < segments.length - 1; i++) {
        const cur = segments[i];
        const next = segments[i + 1];
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
    return segments;
}



/**
 * Back-fill times from end → start.
 * Works backwards until a missing value is hit.
 */

function backFillTimes(segments) {
    for (let i = segments.length - 1; i > 0; i--) {
        const cur = segments[i];
        const prev = segments[i - 1];
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
    return segments;
}