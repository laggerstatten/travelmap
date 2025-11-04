/* ===============================
   Timeline Rendering & Interaction
   =============================== */


// --- Attach event listeners to a card ---
function attachCardHandlers(card) {
    const id = card.dataset.id;

    card.querySelector('.edit-btn').onclick = ev => {
        ev.stopPropagation();
        if (card.classList.contains('editing')) return;
        card.classList.add('editing');
        const seg = segments.find(x => String(x.id) === String(id));
        const editor = buildOnCardEditor(seg, card);
    };

    card.querySelector('.del-btn').onclick = ev => {
        ev.stopPropagation();
        deleteSegmentById(id);
        renderTimeline();
    };

    // --- Drag logic ---
    card.draggable = true;
    card.addEventListener('dragstart', ev => {
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


/* ===============================
   Drag helpers
   =============================== */

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
            return offset < 0 && offset > closest.offset ?
                { offset, element: el.querySelector('.timeline-card') } :
                closest;
        }, { offset: Number.NEGATIVE_INFINITY, element: null }
    ).element;
}