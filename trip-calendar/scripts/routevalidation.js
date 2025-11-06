/* ===============================
   Trip Validation & Repair Module
   =============================== */

async function validateAndRepair() { // edit for slack / overlap

    removeAdjacentDrives();

    segments = segments.filter(seg => {
        if (seg.type !== "drive") return true;
        const origin = segments.find(x => x.id === seg.originId);
        const dest = segments.find(x => x.id === seg.destinationId);
        if (!origin || !dest) {
            return false;
        }
        return true;
    });

    insertDriveSegments();

    await generateRoutes();

    save();
    renderTimeline();

}

function removeAdjacentDrives() { // edit for slack / overlap

    let removed = 0;
    for (let i = 0; i < segments.length - 1; i++) {
        const a = segments[i];
        const b = segments[i + 1];
        if (a.type === "drive" && b.type === "drive") {
            segments.splice(i, 2); // remove both
            removed += 2;
            i--; // step back to recheck next pair
        }
    }

    if (removed > 0) {
        save();
        renderTimeline();
    } 
}
