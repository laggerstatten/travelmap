(function() {
    const S = window.TripCal;

    S.insertDriveSegments = function() {
        S.sortByDateInPlace(S.events);
        const out = [];
        for (let i = 0; i < S.events.length; i++) {
            const cur = S.events[i];
            out.push(cur);
            const next = S.events[i + 1];
            if (!next) break;
            if (cur.type !== "drive" && next.type !== "drive") {
                out.push({
                    id: S.newId(),
                    name: `Drive to ${next.name || "next stop"}`,
                    type: "drive",
                    autoDrive: true,
                    manualEdit: false,
                    start: cur.end || "",
                    end: ""
                });
            }
        }
        S.events = out;
        S.save();
    };

    S.clearAutoDrives = function() {
        S.events = S.events.filter(e => !(e.type === "drive" && e.autoDrive && !e.manualEdit));
        S.save();
    };
})();