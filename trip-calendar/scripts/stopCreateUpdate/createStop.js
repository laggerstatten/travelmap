/* ===============================
   Queue Trip Origin / Destination
   =============================== */
/**
 * CREATE a new segment with the trip_start type and hard end lock
 *
 * @param {*} segments
 */
function queueTripOrigin(segments) { 
    const seg = {
        id: newId(),
        name: '(untitled)',
        type: 'trip_start',
        isAnchorStart: true,
        start: { lock: 'undefined', utc: '' },
        end: { lock: 'hard', utc: '' },
        isQueued: true,
        openEditor: true
    };

    segments.unshift(seg);
}

/**
 * CREATE a new segment with the trip_end type and hard start lock
 *
 * @param {*} segments
 */
function queueTripDestination(segments) { 
    const seg = {
        id: newId(),
        name: '(untitled)',
        type: 'trip_end',
        isAnchorEnd: true,
        start: { lock: 'hard', utc: '' },
        end: { lock: 'undefined', utc: '' },
        isQueued: true,
        openEditor: true
    };

    segments.push(seg);
}

/* ===============================
   Queue Trip Stop
   =============================== */

/**
 * CREATE segment with stop type
 *
 * @param {*} segments
 */
function queueStop(segments) { 
    const seg = {
        id: newId(),
        name: '(untitled)',
        type: 'stop',
        start: { utc: '', lock: 'unlocked' },
        end: { utc: '', lock: 'unlocked' },
        duration: { val: null, lock: 'unlocked' },
        isQueued: true,
        openEditor: true
    };

    segments.unshift(seg);

}





