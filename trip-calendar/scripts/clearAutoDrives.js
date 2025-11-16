function clearAutoDrives(list) {
    let segments = [...list];
    segments = segments.filter(
        (seg) => !(seg.type === 'drive' && seg.autoDrive && !seg.manualEdit)
    );
    return segments;
}