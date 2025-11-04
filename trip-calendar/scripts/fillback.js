/* ===============================
   Per-card Fill BACKWARD
   =============================== */
function fillBackward(fromEvent) {
    const idx = events.findIndex(ev => ev.id === fromEvent.id);
    if (idx === -1) return;

    let cursor = fromEvent.start || fromEvent.end;
    if (!cursor) return;

    for (let i = idx - 1; i >= 0; i--) {
        const e = events[i];

        // stop at manual departure/end boundary
        if (e.manualEnd) break;

        if (e.type === "trip_start") {
            // set departure if not manual; then stop
            if (!e.manualEnd) e.end = cursor;
            break;
        }

        // set end unless manual
        if (!e.manualEnd) e.end = cursor;

        // compute start unless manual
        const durHrs = Number(e.duration) || 0;
        if (!e.manualStart) e.start = addMinutes(e.end, -durHrs * 60);

        // move cursor backward to this event's start (or end if start missing)
        cursor = e.start || e.end;
    }

    save();
    renderTimeline();
}