function attachCardDragHandlers(card) {
  //console.log('Attaching drag handlers to card', card);
  const id = card.dataset.id;

  // --- Drag logic ---
  card.draggable = true;
  card.addEventListener('dragstart', (ev) => {
    if (card.classList.contains('editing')) {
      ev.preventDefault();
      return;
    }
    card.classList.add('dragging');
    ev.dataTransfer.effectAllowed = 'move';
    ev.dataTransfer.setData('text/plain', id);
  });

  /**
  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
    reorderFromDOM(document.getElementById('calendar'));
    // do we need to do anything after this?
  });
  */

  card.addEventListener('dragend', () => {
    const movedId = card.dataset.id;
    card.classList.remove('dragging');
    reorderFromDOM(document.getElementById('calendar'), movedId);
  });

}

function handleDragOver(e) {
  //console.log('Drag over', e);
  e.preventDefault();
  const cal = e.currentTarget;
  const dragging = cal.querySelector('.timeline-card.dragging');
  if (!dragging) return;

  // find card immediately after the cursor
  const after = getDragAfterElement(cal, e.clientY);
  const rails = dragging.closest('.rail-pair');
  if (!rails) return;

  const draggingWrapper = rails; // move the whole pair, not just card

  if (after) {
    cal.insertBefore(draggingWrapper, after.closest('.rail-pair'));
  } else {
    cal.appendChild(draggingWrapper);
  }
}

function getDragAfterElement(container, y) { 
  //console.log('Getting drag after element at y=', y);
  // include entire rail-pair for position math
  const pairs = [...container.querySelectorAll('.rail-pair:not(.dragging)')];
  return pairs.reduce(
    (closest, el) => {
      const box = el.getBoundingClientRect();
      const offset = y - (box.top + box.height / 2);
      return offset < 0 && offset > closest.offset
        ? { offset, element: el.querySelector('.timeline-card') }
        : closest;
    },
    { offset: Number.NEGATIVE_INFINITY, element: null }
  ).element;
}

/**
  function reorderFromDOM(calendar) { //FIXME: uses index lookup
    console.log('Reordering segments from DOM');
    const ids = [...calendar.querySelectorAll('.rail-pair .timeline-card')].map(
      (el) => el.dataset.id
    );
  
    segments = ids.map((id) => segments.find((s) => s.id === id));
    saveSegments(segments);
    //renderTimeline(syncGlobal());
  }
*/

async function reorderFromDOM(calendar, movedId) {
  console.log("=== SAFE reorderFromDOM === movedId:", movedId);

  if (!movedId) {
    console.warn("No movedId passed.");
    return;
  }

  const allCards = [
    ...calendar.querySelectorAll(".rail-pair .timeline-card")
  ];

  const movedEl = allCards.find(el => el.dataset.id === movedId);
  if (!movedEl) {
    console.warn("Dragged card not found in DOM.");
    return;
  }

  // We're only using index here as a transient DOM thing
  const cardIndex = allCards.indexOf(movedEl);
  const afterCard = allCards[cardIndex + 1];
  const afterId = afterCard ? afterCard.dataset.id : null;

  console.log("afterId (element moved in front of):", afterId);

  // We now work PURELY by IDs
  await movePlacedStopById(movedId, afterId);

  console.log("=== END SAFE reorderFromDOM ===");
}

async function movePlacedStopById(stopId, afterId) {
  console.log("=== MOVE PLACED STOP ===");
  console.log("Stop ID:", stopId, "→ before afterId:", afterId);

  const before = loadSegments();
  console.log("Before snapshot:", snap(before));

  let list = removeSlackAndOverlap(before);

  const seg = list.find(s => s.id === stopId);
  if (!seg) {
    console.warn("Stop not found in list.");
    return;
  }

  console.log("Part A: Removing stop from original position...");

  let {
    list: listAfterRemoval,
    removed,
    prevId,
    nextId
  } = removeSegmentFromList(list, seg);

  list = listAfterRemoval;

  console.log("Removed stop:", removed?.id);
  console.log("Neighbors:", { prevId, nextId });
  console.log("After raw removal:", snap(list));

  // Heal old corridor if it was drive–stop–drive
  list = await healRouteIfNeeded(list, prevId, nextId);
  console.log("After healing old corridor:", snap(list));

  // PART B — Insert at new position, relative to afterId
  console.log("Part B: Inserting before afterId:", afterId);

  list = insertStopRelativeToId(list, seg, afterId);
  console.log("After insertion:", snap(list));

  // PART C — Split corridor if needed using stopId, not an index
  console.log("Running splitCorridorIfNeededById…");
  list = await splitCorridorIfNeededById(list, seg.id, before);
  console.log("After split (Part C final):", snap(list));

  console.log("=== END MOVE ===");

  const piped = await runPipeline(list);
  console.log("After pipeline:", snap(piped));

  saveSegments(piped);
  renderTimeline(piped);
  renderMap(piped);

  return piped;
}

function insertStopRelativeToId(list, seg, afterId) {
  // Work on same array or a shallow copy if you prefer immutable
  const out = [...list];

  if (!afterId) {
    // Drop at end
    out.push(seg);
    return out;
  }

  const idx = out.findIndex(s => s.id === afterId);
  if (idx === -1) {
    // Fallback: also drop at end if anchor not found
    out.push(seg);
    return out;
  }

  out.splice(idx, 0, seg); // insert BEFORE afterId
  return out;
}

async function splitCorridorIfNeededById(list, stopId, beforeList) {
  console.log("=== splitCorridorIfNeededById ===");
  console.log("  stopId:", stopId);

  const stopIndex = list.findIndex(s => s.id === stopId);
  if (stopIndex === -1) {
    console.log("  Stop not found — skipping split.");
    return list;
  }

  const X = list[stopIndex];
  console.log("  Stop:", X ? X.name : null);

  if (!X || X.type !== "stop") {
    console.log("  Not a stop — skipping split.");
    return list;
  }

  const { leftStop: A, rightStop: B } = findStopNeighborsById(list, stopId);
  if (!A || !B) {
    console.log("  Missing neighbors — no corridor to split.");
    return list;
  }

  console.log(`  Corridor candidates: ${A.name} → ${X.name} → ${B.name}`);

  const existed = corridorHadDrive(beforeList, A, B);
  if (!existed) {
    console.log("  No original corridor — do NOT split.");
    return list;
  }

  console.log("  Corridor existed — performing split.");

  let out = removeCorridorDrives(list, A, B);

  const newIdx = out.findIndex(s => s.id === X.id);
  console.log("  newIdx after cleanup:", newIdx);

  const drives = await buildSplitDrives(A, X, B);
  console.log("  Built drives:", snap(drives));

  if (!drives) {
    console.log("  Failed to build split drives.");
    return out;
  }

  out.splice(newIdx, 0, drives.d1);
  out.splice(newIdx + 2, 0, drives.d2);

  console.log("  After inserting split drives:", snap(out));
  console.log("=== end splitCorridorIfNeededById ===");
  return out;
}

function findStopNeighborsById(list, stopId) {
  const stopIndex = list.findIndex(s => s.id === stopId);
  console.log("  findStopNeighborsById at index", stopIndex);

  if (stopIndex === -1) {
    return { leftStop: null, rightStop: null };
  }

  let leftStop = null;
  let rightStop = null;

  for (let i = stopIndex - 1; i >= 0; i--) {
    if (isStopLike(list[i])) {
      leftStop = list[i];
      break;
    }
  }

  for (let i = stopIndex + 1; i < list.length; i++) {
    if (isStopLike(list[i])) {
      rightStop = list[i];
      break;
    }
  }

  console.log("    Left stop:", leftStop ? leftStop.name : null);
  console.log("    Right stop:", rightStop ? rightStop.name : null);

  return { leftStop, rightStop };
}

function isStopLike(s) {
  return s.type === "stop" ||
         s.type === "trip_start" ||
         s.type === "trip_end";
}

function corridorHadDrive(beforeList, A, B) {
  console.log(`  Checking if corridor existed: ${A.name} → ${B.name}`);

  const existed = beforeList.some(d =>
    d.type === "drive" &&
    d.originId === A.id &&
    d.destinationId === B.id
  );

  console.log("    existed?", existed);

  return existed;
}

function removeCorridorDrives(list, A, B) {
  console.log(`  Removing corridor drives: ${A.name} → ${B.name}`);

  const before = snap(list);

  const out = list.filter(d =>
    !(d.type === "drive" &&
      d.originId === A.id &&
      d.destinationId === B.id)
  );

  const removed = before.filter(d =>
    d.type === "drive" &&
    d.originId === A.id &&
    d.destinationId === B.id
  );

  console.log("    Removed drives:", snap(removed));
  console.log("    List after removal:", snap(out));

  return out;
}

async function buildSplitDrives(A, X, B) {
    const r1 = await getRouteInfo(A, X);
    const r2 = await getRouteInfo(X, B);

    if (!r1 || !r2) return null;

    const d1 = {
        id: newId(),
        type: "drive",
        autoDrive: true,
        name: `Drive from ${A.name} to ${X.name}`,
        routeGeometry: r1.geometry,
        distanceMi: r1.distance_mi.toFixed(1),
        durationMin: r1.duration_min.toFixed(0),
        durationHr: (r1.duration_min / 60).toFixed(2),
        duration: { val: (r1.duration_min / 60).toFixed(2), lock: "hard" },
        originId: A.id,
        destinationId: X.id,
        originTz: A.timeZone,
        destinationTz: X.timeZone,
    };

    const d2 = {
        id: newId(),
        type: "drive",
        autoDrive: true,
        name: `Drive from ${X.name} to ${B.name}`,
        routeGeometry: r2.geometry,
        distanceMi: r2.distance_mi.toFixed(1),
        durationMin: r2.duration_min.toFixed(0),
        durationHr: (r2.duration_min / 60).toFixed(2),
        duration: { val: (r2.duration_min / 60).toFixed(2), lock: "hard" },
        originId: X.id,
        destinationId: B.id,
        originTz: X.timeZone,
        destinationTz: B.timeZone,
    };

    return { d1, d2 };
}






