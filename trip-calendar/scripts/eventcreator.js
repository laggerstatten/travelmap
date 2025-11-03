function ensureAnchorsAndAddStop(events, saveFn) {
  const hasStart = events.some(e => e.type === 'trip_start');
  const hasEnd   = events.some(e => e.type === 'trip_end');

  // Create start anchor if missing
  if (!hasStart) {
    events.unshift({
      id: newId(),
      name: 'Trip Start',
      type: 'trip_start',
      start: '',
      end: '',
      duration: '',
      isAnchorStart: true
    });
  }

  // Create end anchor if missing
  if (!hasEnd) {
    events.push({
      id: newId(),
      name: 'Trip End',
      type: 'trip_end',
      start: '',
      end: '',
      duration: '',
      isAnchorEnd: true
    });
  }

  // Insert a new stop before the end anchor
  const newStop = {
    id: newId(),
    name: '(untitled)',
    type: 'stop',
    start: '',
    end: '',
    duration: ''
  };

  const endIndex = events.findIndex(e => e.type === 'trip_end');
  if (endIndex !== -1) {
    events.splice(endIndex, 0, newStop);
  } else {
    events.push(newStop);
  }

  if (typeof saveFn === 'function') saveFn();
}
