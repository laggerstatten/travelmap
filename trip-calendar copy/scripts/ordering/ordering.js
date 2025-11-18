function attachCardDragHandlers(card) {
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
  // include entire rail-pair for position math
  const pairs = [...container.querySelectorAll('.rail-pair:not(.dragging)')];
  return pairs.reduce(
    (closest, el) => {
      const box = el.getBoundingClientRect();
      const offset = y - (box.top + box.height / 2);
      return offset < 0 && offset > closest.offset ? { offset, element: el.querySelector('.timeline-card') } :
        closest;
    }, { offset: Number.NEGATIVE_INFINITY, element: null }
  ).element;
}

/**
  function reorderFromDOM(calendar) {
    console.log('Reordering segments from DOM');
    const ids = [...calendar.querySelectorAll('.rail-pair .timeline-card')].map(
      (el) => el.dataset.id
    );
    console.log(segments);
    segments = ids.map((id) => segments.find((s) => s.id === id));
    saveSegments(segments);
    //renderTimeline(syncGlobal());
  }
*/

/**
  async function reorderFromDOM(calendar, movedId) {
    console.log("Running safe reorderFromDOM…", movedId);
  
    if (!movedId) {
      console.warn("No movedId passed into reorderFromDOM.");
      return;
    }
  
    const domIds = [...calendar.querySelectorAll('.rail-pair .timeline-card')]
      .map(el => el.dataset.id);
  
    const newIndex = domIds.indexOf(movedId);
    if (newIndex === -1) {
      console.warn("Moved ID not found in new DOM order.");
      return;
    }
  
    const list = loadSegments();
    const seg = list.find(s => s.id === movedId);
    if (!seg) {
      console.warn("Moved segment not found in segment list.");
      return;
    }
  
    await movePlacedStop(seg, newIndex);
  }
*/

async function reorderFromDOM(calendar, movedId) {
    console.log("=== SAFE reorderFromDOM === movedId:", movedId);

    if (!movedId) {
        console.warn("No movedId passed.");
        return;
    }

    //
    // 1. Read DOM order AFTER drop, ignoring the dragged element.
    //
    const allCards = [
        ...calendar.querySelectorAll(".rail-pair .timeline-card")
    ];

    const movedEl = allCards.find(el => el.dataset.id === movedId);
    if (!movedEl) {
        console.warn("Dragged card not found in DOM.");
        return;
    }

    //
    // 2. Determine the element AFTER the moved one.
    //    This is the semantic anchor for reordering.
    //
    // We do NOT trust the index of movedEl. Instead, we look at the
    // NEXT element in the DOM ordering.
    //
    const cardIndex = allCards.indexOf(movedEl);
    const afterCard = allCards[cardIndex + 1];
    const afterId = afterCard ? afterCard.dataset.id : null;

    console.log("afterId (element moved in front of):", afterId);

    //
    // 3. Load current segment list
    //
    const list = loadSegments();
    const seg = list.find(s => s.id === movedId);
    if (!seg) {
        console.warn("Moved segment not found in list.");
        return;
    }

    //
    // 4. Compute SEMANTIC insert index in the logical timeline
    //
    //    insert before segment whose id == afterId
    //
    let insertIndex;
    if (afterId) {
        insertIndex = list.findIndex(s => s.id === afterId);
        console.log("Semantic insertIndex (before afterId):", insertIndex);
    } else {
        // dropping at the very end
        insertIndex = list.length;
        console.log("Semantic insertIndex = END:", insertIndex);
    }

    //
    // 5. Perform move (this handles all healing / splitting)
    //
    await movePlacedStop(seg, insertIndex);

    console.log("=== END SAFE reorderFromDOM ===");
}
