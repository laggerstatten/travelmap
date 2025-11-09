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

  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
    reorderFromDOM(document.getElementById('calendar'));
  });
}

function editSegment(seg, card) {
  if (card.classList.contains('editing')) return;
  card.classList.add('editing');
  const editor = buildOnCardEditor(seg, card);
}

async function insertQueuedSegment(seg, card) {
  delete seg.isQueued;
  delete seg.openEditor;
  await insertStopInNearestRoute(seg, segments);
}

function deleteSegment(seg, card) {
  const id = seg.id;
  deleteSegmentById(id);
  renderTimeline();
}

function deleteSegmentById(id) {
  const idx = segments.findIndex((seg) => String(seg.id) === String(id));
  if (idx !== -1) {
    segments.splice(idx, 1);
    save();
  }
}



















