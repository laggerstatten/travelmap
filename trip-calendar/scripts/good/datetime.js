/* ---------- Dates ---------- */
function fmtDate(dtString) {
    if (!dtString) return '';
    const d = new Date(dtString);
    return isNaN(d) ?
        '' :
        d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
};

function parseDate(v) {
    const d = new Date(v);
    return isNaN(d) ? null : d;
};

function dayStr(iso) {
    if (!iso) return '';
    return new Date(iso).toDateString();
}

function sortByDate() {
    sortByDateInPlace(events);
    save();
};

/* ---------- Utility: compute end from duration (hours, local) ---------- */
function endFromDuration(startLocal, hoursStr) {
    const hrs = parseFloat(hoursStr);
    if (!startLocal || !isFinite(hrs)) return '';
    const start = new Date(startLocal);
    const end = new Date(start.getTime() + hrs * 3600000);
    // return value in local time for input[type=datetime-local]
    const tzOffset = end.getTimezoneOffset() * 60000;
    const localISO = new Date(end - tzOffset).toISOString().slice(0, 16);
    return localISO;
};


const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getWeekStart(refDate) {
    const d = new Date(refDate);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay());
    return d;
}

function minsSinceMidnight(d) {
    return d.getHours() * 60 + d.getMinutes();
}