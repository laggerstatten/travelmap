async function insertQueuedSegment(seg, card) {
    let segs = loadSegments();
    delete seg.isQueued;
    delete seg.openEditor;
    segs = await insertStopInNearestRoute(seg, segs);

    segs = await runPipeline(segs); // test 

    saveSegments(segs);
    renderTimeline(segs);
    renderMap(segs);
}

function pushToQueueTop(list, seg) {
    const idx = list.findIndex(s => s.id === seg.id);
    if (idx !== -1) {
        list.splice(idx, 1);
        list.unshift(seg);
    }
}

async function movePlacedStopToQueue(seg) {
    let list = loadSegments();

    let { list: newList, idx } = removeSegmentFromList(list, seg);

    // Heal
    newList = await removeStopAndHealRouteIfNeeded(seg, newList, idx);

    // Modify seg
    unlockAndQueue(seg);

    // Add to top
    newList.unshift(seg);

    newList = await runPipeline(newList); // test

    saveSegments(newList);
    renderTimeline(newList);
    renderMap(newList);
}


