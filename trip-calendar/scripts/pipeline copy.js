async function runPipeline(list) {
    let level = PIPELINELEVEL;
    let segs = [...list];
    if (level == "routing" || level == "timing" || level == "conflictresolution") {
        segs = removeSlackAndOverlap(segs);
        segs = await validateAndRepair(segs);
    }

    if (level == "timing" || level == "conflictresolution") {
        segs = annotateEmitters(segs);
        segs = determineEmitterDirections(segs, { priority: PLANNING_DIRECTION });
        segs = propagateTimes(segs);
        segs = computeSlackAndOverlap(segs);
    }

    if (level == "conflictresolution") {
        // future conflict resolution functions
    }

    return segs;
}
