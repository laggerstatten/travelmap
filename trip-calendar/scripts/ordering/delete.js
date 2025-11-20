function deleteSegment(seg, card) {
  // fire-and-forget async wrapper
  (async () => {
    const id = seg.id;
    deleteSegmentById(id);

    let segs = loadSegments();
    PIPELINELEVEL = '';
    segs = await runPipeline(segs); // test

    saveSegments(segs);
    renderTimeline(segs);
    renderMap(segs);
  })();
}

function deleteSegmentById(id) {
  let segments = loadSegments();
  const idx = segments.findIndex((seg) => String(seg.id) === String(id));
  if (idx !== -1) {
    segments.splice(idx, 1);
    saveSegments(segments);
  }
}

function removeSegmentFromList(list, seg) {
  const idx = list.findIndex((s) => s.id === seg.id);
  if (idx === -1) {
    return {
      list,
      removed: null,
      prevId: null,
      nextId: null
    };
  }

  const prev = list[idx - 1] || null;
  const next = list[idx + 1] || null;

  const [removed] = list.splice(idx, 1); // mutates list

  return {
    list,
    removed,
    prevId: prev ? prev.id : null,
    nextId: next ? next.id : null
  };
}

async function deletePlacedStop(seg) {
  let list = loadSegments();
  list = removeSlackAndOverlap(list);
  let {
    list: newList,
    removed,
    prevId,
    nextId
  } = removeSegmentFromList(list, seg);

  // Heal
  newList = await healRouteIfNeeded(newList, prevId, nextId);

  newList = await runPipeline(newList); // test

  saveSegments(newList);
  renderTimeline(newList);
  renderMap(newList);
}

function deleteQueuedStop(seg) {
  let list = loadSegments();
  const { list: newList } = removeSegmentFromList(list, seg);
  saveSegments(newList);
  renderTimeline(newList);
  renderMap(newList);
}
