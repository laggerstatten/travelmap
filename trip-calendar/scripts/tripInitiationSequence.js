/* ===============================
   Trip Initialization (Async)
   =============================== */
async function initTrip() {
  let segs = loadSegments();

  // queue anchors in-memory, then persist once
  queueTripOrigin(segs);
  queueTripDestination(segs);
  saveSegments(segs);
  renderTimeline(segs);
  await waitForTripAnchorsReady();

  segs = loadSegments();

  segs = await runPipeline(segs); // test
  saveSegments(segs);
  renderTimeline(segs); //TODO POI table update?
  renderMap(segs);
}

/* ===============================
   Helper: Wait for Anchors Ready
   =============================== */
function waitForTripAnchorsReady() {
  return new Promise((resolve) => {
    const check = () => {
      const segs = loadSegments();
      const startReady = segs.some(
        (s) => s.type === 'trip_start' && !s.isQueued
      );
      const endReady = segs.some((s) => s.type === 'trip_end' && !s.isQueued);
      if (startReady && endReady) resolve();
      else requestAnimationFrame(check);
    };
    check();
  });
}
