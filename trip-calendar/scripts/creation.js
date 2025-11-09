/* ===============================
   Trip Initialization (Async)
   =============================== */
async function initTrip(segments) {
  console.log('Initializing trip...');

  queueTripOrigin(segments);
  queueTripDestination(segments);

  // Wait until both anchors are committed (unqueued)
  await waitForTripAnchorsReady(segments);

  console.log('Both anchors committed — building route');
  await validateAndRepair();
  console.log('Trip initialization complete.');
}

/* ===============================
   Helper: Wait for Anchors Ready
   =============================== */
function waitForTripAnchorsReady(segments) {
  return new Promise((resolve) => {
    const check = () => {
      const startReady = segments.some(
        (s) => s.type === 'trip_start' && !s.isQueued
      );
      const endReady = segments.some(
        (s) => s.type === 'trip_end' && !s.isQueued
      );
      if (startReady && endReady) {
        resolve();
      } else {
        requestAnimationFrame(check); // efficient lightweight loop
      }
    };
    check();
  });
}

/* ===============================
   Queue Trip Origin / Destination
   =============================== */
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
  save();
  renderTimeline();
}

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
  save();
  renderTimeline();
}

/* ===============================
   Queue Trip Stop
   =============================== */
function queueStop(segments) {
  const seg = {
    id: newId(),
    name: '(untitled)',
    type: 'stop',
    isQueued: true,
    openEditor: true
  };

  segments.unshift(seg);
  save();
  renderTimeline();
}
