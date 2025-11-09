/* ===============================
   Nudge Tools
   =============================== */

function shiftTime(dt, minutes) {
    if (!dt) return dt;
    const t = new Date(dt);
    t.setMinutes(t.getMinutes() + minutes);

    // format for <input type="datetime-local"> (local time, no timezone)
    const pad = n => String(n).padStart(2, "0");
    const yyyy = t.getFullYear();
    const mm = pad(t.getMonth() + 1);
    const dd = pad(t.getDate());
    const hh = pad(t.getHours());
    const min = pad(t.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}



function nudgeEvent(event, minutes, cascade = false) {
    const idx = events.findIndex(ev => ev.id === event.id);
    if (idx === -1) return;

    const delta = minutes;

    // shift current event
    if (!event.manualStart && event.start)
        event.start = shiftTime(event.start, delta);
    if (!event.manualEnd && event.end)
        event.end = shiftTime(event.end, delta);

    // cascade to later events until hitting a manual one
    if (cascade) {
        for (let i = idx + 1; i < events.length; i++) {
            const e = events[i];
            if (e.manualStart || e.manualEnd) break;

            if (e.start) e.start = shiftTime(e.start, delta);
            if (e.end) e.end = shiftTime(e.end, delta);
        }
    }

    save();
    renderTimeline();
    console.log(`🕓 Nudged ${event.name} by ${minutes} min (cascade=${cascade})`);
}