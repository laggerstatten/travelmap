function deleteQueuedStop(seg) {
  let list = loadSegments();
  const { list: newList } = removeSegmentFromList(list, seg);
  saveSegments(newList);
  renderTimeline(newList);
  renderMap(newList);
}

async function deletePlacedStop(seg) {
  let list = loadSegments();

  // Remove it
  let { list: newList, removed, prevId, nextId } = removeSegmentFromList(list, seg);

  // Heal if needed
  await healRouteIfNeeded(list, prevId, nextId);

  // Recompute
  //newList = removeSlackAndOverlap(newList);
  //newList = await validateAndRepair(newList); // need a way to make this conditional
  //newList = annotateEmitters(newList);
  //newList = determineEmitterDirections(newList, { priority: PLANNING_DIRECTION });
  //newList = propagateTimes(newList);
  //newList = computeSlackAndOverlap(newList);

  newList = await runPipeline(newList); // test

  saveSegments(newList);
  renderTimeline(newList);
  renderMap(newList);
}


async function movePlacedStopToQueue(seg) {
  let list = loadSegments();
  list = removeSlackAndOverlap(list);
  let { list: newList, removed, prevId, nextId } = removeSegmentFromList(list, seg);

  // Heal
  newList = await healRouteIfNeeded(list, prevId, nextId);

  // Modify seg
  unlockAndQueue(seg);

  // Add to top
  newList.unshift(seg);

  newList = await runPipeline(newList); // test

  saveSegments(newList);
  renderTimeline(newList);
  renderMap(newList);
}

function removeSegmentFromList(list, seg) {
  const idx = list.findIndex(s => s.id === seg.id);
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

  const [removed] = list.splice(idx, 1);  // mutates list

  return {
    list,
    removed,
    prevId: prev ? prev.id : null,
    nextId: next ? next.id : null
  };
}

async function healRouteIfNeeded(list, prevId, nextId) {
  const left = prevId ? list.find(s => s.id === prevId) : null;
  const right = nextId ? list.find(s => s.id === nextId) : null;

  // Only heal if both neighbors are drives
  if (left?.type === "drive" && right?.type === "drive") {
    return await healRouteBetweenDrives(left.id, right.id, list);
  }

  return list;
}

async function healRouteBetweenDrives(leftDriveId, rightDriveId, list) {
  const leftIdx = list.findIndex(s => s.id === leftDriveId);
  const rightIdx = list.findIndex(s => s.id === rightDriveId);

  if (leftIdx === -1 || rightIdx === -1) return list;

  const left = list[leftIdx];
  const right = list[rightIdx];

  if (left.type !== "drive" || right.type !== "drive") return list;

  const origin = list.find(s => s.id === left.originId);
  const destination = list.find(s => s.id === right.destinationId);

  if (!origin || !destination) return list;

  const r = await getRouteInfo(origin, destination);
  if (!r) return list;

  const newDrive = {
    id: newId(),
    type: "drive",
    autoDrive: true,
    name: `Drive from ${origin.name} to ${destination.name}`,
    routeGeometry: r.geometry,
    distanceMi: r.distance_mi.toFixed(1),
    durationMin: r.duration_min.toFixed(0),
    durationHr: (r.duration_min / 60).toFixed(2),
    duration: { val: (r.duration_min / 60).toFixed(2), lock: "hard" },
    originId: origin.id,
    destinationId: destination.id,
    originTz: origin.timeZone,
    destinationTz: destination.timeZone,
  };

  // ------------------------
  // Remove the two drives
  // ------------------------
  // Important: remove RIGHT FIRST so its index doesn't shift under LEFT
  list.splice(rightIdx, 1);
  list.splice(leftIdx, 1);

  // ------------------------
  // Insert the merged drive at leftIdx
  // ------------------------
  list.splice(leftIdx, 0, newDrive);

  return list;
}


