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