function getSegmentsInTimeWindow(stop, segments) {
    if (!stop ?.start ?.utc && !stop ?.end ?.utc ) return [...segments];

    const tRef = new Date(stop.start ?.utc || stop.end ?.utc ).getTime();
    let latestBeforeIdx = -1;
    let earliestAfterIdx = segments.length;

    // latest segment whose *end OR start* is before stop
    for (let i = 0; i < segments.length; i++) {
        const s = segments[i];
        if (s.isQueued) continue;
        const tSeg = segments[i].end ?.utc ?
            new Date(s.end.utc).getTime() :
            s.start ?.utc ?
                new Date(s.start.utc).getTime() :
                null ;
        if (tSeg && tSeg <= tRef) latestBeforeIdx = i;
    }

    // earliest segment whose *start OR end* is after stop
    for (let i = segments.length - 1; i >= 0; i--) {
        const s = segments[i];
        if (s.isQueued) continue;
        const tSeg = s.start ?.utc ?
            new Date(s.start.utc).getTime() :
            s.end ?.utc ?
                new Date(s.end.utc).getTime() :
                null ;
        if (tSeg && tSeg >= tRef) earliestAfterIdx = i;
    }

    // If stop is outside the trip window, return empty list
    if (latestBeforeIdx === -1 || earliestAfterIdx === segments.length) {
        console.log('Stop outside trip window — no valid time window.');
        return [];
    }

    return segments.slice(latestBeforeIdx, earliestAfterIdx + 1);
}