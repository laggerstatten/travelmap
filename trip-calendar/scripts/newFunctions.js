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
  let { list: newList, idx } = removeSegmentFromList(list, seg);

  // Heal if needed
  await removeStopAndHealRouteIfNeeded(seg, newList, idx);

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

  let { list: newList, idx } = removeSegmentFromList(list, seg);

  // Heal
  newList = await removeStopAndHealRouteIfNeeded(seg, newList, idx);

  // Modify seg
  unlockAndQueue(seg);

  // Add to top
  newList.unshift(seg);

  // Run pipeline once
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


function removeSegmentFromList(list, seg) { //FIXME: uses index lookup
  const idx = list.findIndex(s => s.id === seg.id);
  if (idx === -1) return { list, idx: -1 };

  const [removed] = list.splice(idx, 1);
  return { list, idx, removed };
}

async function removeStopAndHealRouteIfNeeded(seg, list, idx) { //FIXME: uses index lookup
  const left = list[idx - 1];
  const right = list[idx];

  if (left?.type === "drive" && right?.type === "drive") {
    return await removeStopAndHealRoute(seg, list, idx);
  }

  return list;
}


async function removeStopAndHealRoute(stop, list, idx) { //FIXME: uses index lookup
  const left = list[idx - 1];
  const right = list[idx];

  if (!left || !right) return list;
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
    durationHr: (r.duration_min/60).toFixed(2),
    duration: { val: (r.duration_min/60).toFixed(2), lock: "hard" },
    originId: origin.id,
    destinationId: destination.id,
    originTz: origin.timeZone,
    destinationTz: destination.timeZone,
  };

  // Remove [left-drive, stop, right-drive]
  list.splice(idx + 1, 1);
  list.splice(idx, 1);
  list.splice(idx - 1, 1);

  // Insert merged drive
  list.splice(idx - 1, 0, newDrive);

  return list;
}




