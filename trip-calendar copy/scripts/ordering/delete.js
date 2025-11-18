function deleteQueuedStop(seg) {
    let list = loadSegments();
    const { list: newList } = removeSegmentFromList(list, seg);
    saveSegments(newList);
    renderTimeline(newList);
    renderMap(newList);
}

async function deletePlacedStop(seg) {
    let list = loadSegments();

    // Remove it
    let { list: newList, idx } = removeSegmentFromList(list, seg);

    // Heal if needed
    await removeStopAndHealRouteIfNeeded(seg, newList, idx);

    newList = await runPipeline(newList); // test

    saveSegments(newList);
    renderTimeline(newList);
    renderMap(newList);
}

function deleteSegment(seg, card) {
    // fire-and-forget async wrapper
    (async () => {
        const id = seg.id;
        deleteSegmentById(id);

        let segs = loadSegments();

        segs = await runPipeline(segs); // test

        saveSegments(segs);
        renderTimeline(segs);
        renderMap(segs);
    })();
}

function deleteSegmentById(id) {
    let segments = loadSegments();
    const idx = segments.findIndex((seg) => String(seg.id) === String(id));
    if (idx !== -1) {
        segments.splice(idx, 1);
        saveSegments(segments);
    }
}

function removeSegmentFromList(list, seg) {
    const idx = list.findIndex(s => s.id === seg.id);
    if (idx === -1) return { list, idx: -1 };

    const [removed] = list.splice(idx, 1);
    return { list, idx, removed };
}






