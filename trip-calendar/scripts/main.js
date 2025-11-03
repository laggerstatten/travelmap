(function() {
    const S = window.TripCal;

    // Public render switcher
    S.render = function() {
        if (S.viewMode === "timeline") S.renderTimeline();
        else S.renderWeek();
    };

    // Toolbar actions
    document.getElementById("mode-timeline").onclick = () => { S.viewMode = "timeline";
        S.render(); };
    document.getElementById("mode-week").onclick = () => { S.viewMode = "week";
        S.render(); };
    document.getElementById("add-event").onclick = () => {
        S.events.push({ id: S.newId(), name: "(untitled)", type: "stop", start: "", end: "", duration: "" });
        S.save();
    };
    document.getElementById("sort-date").onclick = () => S.sortByDate();
    document.getElementById("insert-drives").onclick = () => S.insertDriveSegments();
    document.getElementById("clear-auto").onclick = () => S.clearAutoDrives();

    // Initial render
    S.render();
})();