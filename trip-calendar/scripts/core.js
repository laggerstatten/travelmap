(function() {
    const S = {};
    window.TripCal = S;

    /* ---------- State ---------- */
    S.events = JSON.parse(localStorage.getItem("tripEvents")) || [];
    S.viewMode = "timeline";

    S.save = function(noRender = false) {
        localStorage.setItem("tripEvents", JSON.stringify(S.events));
        if (!noRender) window.TripCal.render();
    };

    S.newId = () => Date.now() + Math.floor(Math.random() * 1000);

    /* ---------- Dates ---------- */
    S.fmtDate = function(dtString) {
        if (!dtString) return "";
        const d = new Date(dtString);
        return isNaN(d) ? "" : d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
    };
    S.parseDate = function(v) {
        const d = new Date(v);
        return isNaN(d) ? null : d;
    };

    /* ---------- Sorting (keep undated in place) ---------- */
    S.sortByDateInPlace = function(list) {
        const dated = list.filter(e => S.parseDate(e.start));
        dated.sort((a, b) => S.parseDate(a.start) - S.parseDate(b.start));

        const merged = [];
        let di = 0;
        for (const e of list) {
            if (!S.parseDate(e.start)) merged.push(e);
            else merged.push(dated[di++]);
        }
        list.splice(0, list.length, ...merged);
    };

    S.sortByDate = function() {
        S.sortByDateInPlace(S.events);
        S.save();
    };

    /* ---------- Utility: compute end from duration (hours, local) ---------- */
    S.endFromDuration = function(startISO, hoursStr) {
        const hrs = parseFloat(hoursStr);
        if (!startISO || !isFinite(hrs)) return "";
        const start = new Date(startISO);
        const end = new Date(start.getTime() + hrs * 3600000);
        // keep minute precision for input[type=datetime-local]
        return end.toISOString().slice(0, 16);
    };
})();