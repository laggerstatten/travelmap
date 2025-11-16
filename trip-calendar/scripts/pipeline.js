async function runPipeline(list) {
    const level = PIPELINELEVEL;
    let segs = [...list];

    //
    // 1. STRUCTURE + ROUTING LEVEL
    // These run if level is routing OR beyond.
    //
    if (level === "routing" || level === "timing" || level === "conflict") {
        segs = removeSlackAndOverlap(segs);
        segs = await validateAndRepair(segs); 
    }

    //
    // 2. TIMING LEVEL
    // These run if level is timing OR beyond.
    //
    if (level === "timing" || level === "conflict") {
        segs = annotateEmitters(segs);
        segs = determineEmitterDirections(segs, { priority: PLANNING_DIRECTION });
        segs = propagateTimes(segs);
        segs = computeSlackAndOverlap(segs);
    }

    //
    // 3. CONFLICT LEVEL
    // These run ONLY if level is conflict.
    //
    if (level === "conflict") {
        // future conflict resolution

    }

    return segs;
}
