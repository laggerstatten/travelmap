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

function normalizeBeforeId(beforeId, list) {
  let next = list.find(s => s.id === beforeId);
  while (next && next.type !== "stop" && next.type !== "trip_start" && next.type !== "trip_end") {
    // Skip ephemeral segments
    const idx = list.findIndex(s => s.id === next.id);
    next = list[idx + 1];
  }
  return next ? next.id : null;
}



async function reorderFromDOM(calendar, movedId) {
  console.log("=== SAFE reorderFromDOM === movedId:", movedId);
  if (!movedId) return;

  const allCards = [
    ...calendar.querySelectorAll(".rail-pair .timeline-card")
  ];

  const movedEl = allCards.find(el => el.dataset.id === movedId);
  if (!movedEl) {
    console.warn("Dragged card not found in DOM.");
    return;
  }

  const cardIndex = allCards.indexOf(movedEl);
  const prevCard  = allCards[cardIndex - 1] || null;
  const nextCard  = allCards[cardIndex + 1] || null;

  const afterCard = nextCard; // semantic "insert before this one"
  const afterId   = afterCard ? afterCard.dataset.id : null;

  console.log("afterId (element moved in front of):", afterId);

  // ---- Load segments to reason about drives ----
  const list = loadSegments();
  const movedSeg = list.find(s => s.id === movedId);
  if (!movedSeg) {
    console.warn("Moved segment not found in list.");
    return;
  }

  // Only enforce this for real stops
  if (movedSeg.type === "stop") {
    const incomingDrive = list.find(
      s => s.type === "drive" && s.destinationId === movedSeg.id
    );
    const outgoingDrive = list.find(
      s => s.type === "drive" && s.originId === movedSeg.id
    );

    // Case 1: stop is being dropped BETWEEN origin and its incoming drive:
    // pattern after drop:  [ originStop , movedStop , incomingDrive ]
    if (
      incomingDrive &&
      nextCard && nextCard.dataset.id === incomingDrive.id &&
      prevCard && prevCard.dataset.id === incomingDrive.originId
    ) {
      console.warn(
        "Blocked: cannot place stop between its origin and its incoming drive."
      );
      // revert UI to model state
      renderTimeline(list);
      renderMap(list);
      return;
    }

    // Case 2: stop is being dropped BETWEEN its outgoing drive and destination:
    // pattern after drop: [ outgoingDrive , movedStop , destStop ]
    if (
      outgoingDrive &&
      prevCard && prevCard.dataset.id === outgoingDrive.id &&
      nextCard && nextCard.dataset.id === outgoingDrive.destinationId
    ) {
      console.warn(
        "Blocked: cannot place stop between its outgoing drive and its destination."
      );
      renderTimeline(list);
      renderMap(list);
      return;
    }
  }

  // ---- normal semantic insert index code ----
  let insertIndex;
  if (afterId) {
    insertIndex = list.findIndex(s => s.id === afterId);
    console.log("Semantic insertIndex (before afterId):", insertIndex);
  } else {
    insertIndex = list.length;
    console.log("Semantic insertIndex = END:", insertIndex);
  }

  const stopLikeBeforeId = normalizeBeforeId(afterId, list);
  await movePlacedStopById(movedId, stopLikeBeforeId);

  console.log("=== END SAFE reorderFromDOM ===");
}

async function movePlacedStopById(stopId, beforeId) {
  console.log("========== MOVE PLACED STOP ==========");
  console.log("stopId:", stopId, "beforeId:", beforeId);

  // -----------------------------------------
  // Load original full list (authoritative)
  // -----------------------------------------
  const beforeList = loadSegments();
  console.log("Initial list:", snap(beforeList));

  const stop = beforeList.find(s => s.id === stopId);
  if (!stop) {
    console.warn("Stop not found:", stopId);
    return;
  }

  // Clone for modification
  let list = [...beforeList];

  //
  // ====================================
  // A. REMOVE STOP & HEAL OLD CORRIDOR
  // ====================================
  //
  console.log("--- A. Removing stop and healing old corridor ---");

  let {
    list: afterRemoval,
    prevId,
    nextId
  } = removeSegmentFromList(list, stop);

  list = afterRemoval;

  console.log("After raw removal:", snap(list));
  console.log("Removed stop:", stopId, "prevId:", prevId, "nextId:", nextId);

  list = await healRouteIfNeeded(list, prevId, nextId);
  console.log("After healRouteIfNeeded:", snap(list));

  //
  // ====================================
  // B. INSERT STOP AT NEW LOCATION
  // ====================================
  //
  console.log("--- B. Inserting stop at new location ---");
  console.log("Inserting", stopId, "before", beforeId);

  list = insertStopRelativeToId(list, stop, beforeId);
  console.log("After insertion:", snap(list));

  //
  // ====================================
  // C. FIX LOCAL DRIVE PAIRS AROUND STOP
  // First remove bad drive, then insert missing drives
  // ====================================
  //
  /**
    console.log("--- C. Fixing drives around the stop ---");
  
    const { left, right } = getNeighborsById(list, stopId);
    console.log("Neighbors around stop:", { left: left?.id, right: right?.id });
  
    if (left && right) {
      console.log("Checking adjacent removal X->Y:", left.id, right.id);
      removeAdjacentDrivesById(list, left.id, right.id);
  
      console.log("Checking insert X->S:", left.id, stopId);
      insertDriveBetweenById(list, left.id, stopId);
  
      console.log("Checking insert S->Y:", stopId, right.id);
      insertDriveBetweenById(list, stopId, right.id);
    }
  
    console.log("After pair fixes:", snap(list));
  */

  //
  // ====================================
  // D. CORRIDOR SPLIT USING ORIGINAL LIST
  // ------------------------------------
  // This is where we MUST pass beforeList
  // ====================================
  //
  console.log("--- D. Corridor split check ---");

  list = await splitIfInsertedIntoDrive(list, stopId, beforeList);
  console.log("After splitIfInsertedIntoDrive:", snap(list));

  //
  // ====================================
  // E. FINAL NORMALIZATION
  // ====================================
  //
  console.log("--- E. Running final pipeline ---");

  list = await runPipeline(list);
  console.log("After pipeline:", snap(list));

  console.log("========== END MOVE ==========");

  saveSegments(list);
  renderTimeline(list);
  renderMap(list);

  return list;
}


function insertStopRelativeToId(list, seg, beforeId) {
  console.log("insertStopRelativeToId: inserting", seg.id, "before", beforeId);

  const out = [...list];

  if (!beforeId) {
    console.log("  No beforeId → appending");
    out.push(seg);
    return out;
  }

  const idx = out.findIndex(s => s.id === beforeId);

  console.log("  beforeId index:", idx);

  if (idx === -1) {
    console.log("  beforeId not found → appending");
    out.push(seg);
    return out;
  }

  out.splice(idx, 0, seg);
  console.log("  Inserted at index:", idx);

  return out;
}

function getNeighborsById(list, id) {
  const i = list.findIndex(s => s.id === id);
  if (i === -1) return { left: null, right: null };

  return {
    left: list[i - 1] || null,
    right: list[i + 1] || null
  };
}

async function splitIfInsertedIntoDrive(list, stopId, beforeList) {
  console.log("splitIfInsertedIntoDrive:", stopId);

  // Current neighbors after insertion
  const { left, right } = getNeighborsById(list, stopId);
  console.log("  Neighbors:", { left: left?.id, right: right?.id });

  const stop = list.find(s => s.id === stopId);
  if (!stop) return list;

  // ------------------------------------------------------
  // CASE 1: Left neighbor is the drive that needs splitting
  // ------------------------------------------------------
  if (left && left.type === "drive") {
    // Confirm this drive existed in the original list:
    const existed = beforeList.some(d => d.id === left.id);
    if (existed) {
      console.log("  Splitting left drive", left.id);
      return await insertStopInRouteById(list, stopId, left.id, stop);
    }
  }

  // ------------------------------------------------------
  // CASE 2: Right neighbor is the drive that needs splitting
  // ------------------------------------------------------
  if (right && right.type === "drive") {
    const existed = beforeList.some(d => d.id === right.id);
    if (existed) {
      console.log("  Splitting right drive", right.id);
      return await insertStopInRouteById(list, stopId, right.id, stop);
    }
  }

  console.log("  No split needed.");
  return list;
}



