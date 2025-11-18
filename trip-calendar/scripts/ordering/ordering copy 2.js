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

  const cardIndex = allCards.indexOf(movedEl);
  const afterCard = allCards[cardIndex + 1];
  const afterId = afterCard ? afterCard.dataset.id : null;

  console.log("afterId (element moved in front of):", afterId);

  await movePlacedStopById(movedId, afterId);

  console.log("=== END SAFE reorderFromDOM ===");
}

async function movePlacedStopById(stopId, beforeId) {
  let list = loadSegments();

  const stop = list.find(s => s.id === stopId);
  if (!stop) {
    console.warn("Stop not found:", stopId);
    return;
  }

  // A. Remove & Heal Old Corridor
  let {
    list: L1,
    prevId,
    nextId
  } = removeSegmentFromList(list, stop);

  list = L1;

  list = await healRouteIfNeeded(list, prevId, nextId);


  // B. Insert Stop at New Location (by ID)
  list = insertStopRelativeToId(list, stop, beforeId);


  // C. Fix Drives Around the Stop Using Only Pair Helpers
  const { left, right } = getNeighborsById(list, stopId);

  if (left && right) {
    // 1. Remove any invalid X→Y drive
    removeAdjacentDrivesById(list, left.id, right.id);

    // 2. Insert missing X→S and S→Y drives
    insertDriveBetweenById(list, left.id, stopId);
    insertDriveBetweenById(list, stopId, right.id);
  }

  // D. Split corridor if stop inserted mid-drive (existing helper)
  // Uses ONLY your pair-based drive splitter
  list = await splitIfInsertedIntoDrive(list, stopId);


  // E. Final Full Normalization Pipeline
  list = await runPipeline(list);

  saveSegments(list);
  renderTimeline(list);
  renderMap(list);

  return list;
}

function insertStopRelativeToId(list, seg, beforeId) {
  const out = [...list];

  if (!beforeId) {
    out.push(seg);
    return out;
  }

  const idx = out.findIndex(s => s.id === beforeId);
  if (idx === -1) {
    out.push(seg);
    return out;
  }

  out.splice(idx, 0, seg);
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



async function splitIfInsertedIntoDrive(list, stopId) {
  const { left, right } = getNeighborsById(list, stopId);

  if (!left || !right) return list;

  // Detect: was the corridor originally a drive with origin--destination?
  if (left.type === "drive" && left.originId === right.destinationId) {
    // Classic case: stop inserted inside a drive corridor
    return await insertStopInRouteById(list, stopId, left.id, list.find(s => s.id === stopId));
  }

  return list;
}

  






