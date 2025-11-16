function clearTimesAndDurations(list, opts = {}) {
    //console.log('clearTimesAndDurations');
    let segments = [...list];
    const { onlyUnlocked = true } = opts;

    const message = onlyUnlocked ?
        'Clear all non-locked times and durations?' :
        'Clear all start/end times and durations?';

    if (!confirm(message)) return;

    const shouldClear = (lock) => {
        if (!onlyUnlocked) return true;
        return !(lock === 'hard' || lock === 'soft');
    };

    segments.forEach((seg) => {
        seg.start ??= { utc: '', lock: 'unlocked' };
        seg.end ??= { utc: '', lock: 'unlocked' };
        seg.duration ??= { val: null, lock: 'unlocked' };

        if (shouldClear(seg.start.lock)) {
            seg.start.utc = '';
            seg.start.lock = 'unlocked';
        }

        if (shouldClear(seg.end.lock)) {
            seg.end.utc = '';
            seg.end.lock = 'unlocked';
        }

        if (shouldClear(seg.duration.lock)) {
            seg.duration.val = null;
            seg.duration.lock = 'unlocked';
        }

        if (seg.type === 'drive') {
            seg.duration.val = seg.durationHr ?? seg.duration ?.val ?? null;
            seg.duration.lock = 'auto';
        }

        delete seg.manualEdit;
    });

    console.log(segments);
    return segments;
}