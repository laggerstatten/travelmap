function detectOverlaps(segments) {
    console.log("Checking for overlaps...");
    const overlaps = [];

    // clear any previous highlights/connectors
    document.querySelectorAll(".overlap").forEach(el => el.classList.remove("overlap"));
    document.querySelectorAll(".overlap-connector").forEach(el => el.remove());

    const calendar = document.getElementById("calendar");
    const cards = [...calendar.querySelectorAll(".timeline-card")];

    for (let i = 0; i < segments.length - 1; i++) {
        const a = segments[i],
            b = segments[i + 1];
        if (!a.end || !b.start) continue;

        const aEnd = new Date(a.end);
        const bStart = new Date(b.start);

        if (aEnd > bStart) {
            overlaps.push({ a, b, overlapMinutes: (aEnd - bStart) / 60000 });

            // find matching cards
            const aCard = cards.find(c => c.dataset.id === a.id);
            const bCard = cards.find(c => c.dataset.id === b.id);

            // highlight them
            if (aCard) aCard.classList.add("overlap");
            if (bCard) bCard.classList.add("overlap");

            // visually connect
            // visually connect — use the shared parent container
            if (aCard && bCard) {
                // when you detect overlap:
                const connector = document.createElement("div");
                connector.className = "overlap-connector";

                // find the wrapper of the earlier event
                const wrapper = aCard.closest(".rail-pair");

                // insert connector after that wrapper (keeps same width and centering)
                wrapper.insertAdjacentElement("afterend", connector);



            }

        }
    }

    if (overlaps.length) {
        console.warn("⚠ Overlaps detected:", overlaps);
        alert(`${overlaps.length} overlapping segments detected. Check console.`);
    } else {
        console.log("✅ No overlaps found.");
    }
}