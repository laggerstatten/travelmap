function clearAllTimesAndFlags() {
    if (!confirm("Clear all start/end times and manual flags?")) return;

    segments.forEach(seg => {
        // preserve drive duration (if from routing)
        const keepDuration = seg.type === "drive" && seg.duration;

        // wipe all time fields
        delete seg.start;
        delete seg.end;

        // reset duration only for non-drives
        if (!keepDuration) seg.duration = "";

        // clear manual flags
        delete seg.manualStart;
        delete seg.manualEnd;
        delete seg.manualDuration;
        delete seg.manualEdit;
    });

    save();
    renderTimeline();
}


/* ===============================
   Per-card Fill FORWARD
   =============================== */
function fillForward(fromSegment) {
    const idx = segments.findIndex(ev => ev.id === fromSegment.id);
    if (idx === -1) return;

    let cursor = fromSegment.end || fromSegment.start;
    if (!cursor) return;

    for (let i = idx + 1; i < segments.length; i++) {
        const seg = segments[i];

        if (seg.manualStart) break;

        if (seg.type === "trip_end") {
            if (!seg.manualStart) seg.start = cursor;
            break;
        }

        if (!seg.manualStart) seg.start = cursor;

        const durHrs = Number(seg.duration) || 0;
        if (!seg.manualEnd) seg.end = addMinutes(seg.start, durHrs * 60);

        cursor = seg.end || seg.start;
    }

    save();
    renderTimeline();
}

/* ===============================
   Per-card Fill BACKWARD
   =============================== */
function fillBackward(fromSegment) {
    const idx = segments.findIndex(ev => ev.id === fromSegment.id);
    if (idx === -1) return;

    let cursor = fromSegment.start || fromSegment.end;
    if (!cursor) return;

    for (let i = idx - 1; i >= 0; i--) {
        const seg = segments[i];

        if (seg.manualEnd) break;

        if (seg.type === "trip_start") {
            if (!seg.manualEnd) seg.end = cursor;
            break;
        }

        if (!seg.manualEnd) seg.end = cursor;

        const durHrs = Number(seg.duration) || 0;
        if (!seg.manualStart) seg.start = addMinutes(seg.end, -durHrs * 60);

        cursor = seg.start || seg.end;
    }

    save();
    renderTimeline();
}