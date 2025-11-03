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
        const e = events.find(x => String(x.id) === String(id));
        const editor = buildInlineEditor(e, card);
    };

    card.querySelector('.del-btn').onclick = ev => {
        ev.stopPropagation();
        deleteEventById(id);
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
    const dragging = cal.querySelector('.event.dragging');
    if (!dragging) return;
    const after = getDragAfterElement(cal, e.clientY);
    if (!after) cal.appendChild(dragging);
    else cal.insertBefore(dragging, after);
}

function getDragAfterElement(container, y) {
    const cards = [...container.querySelectorAll('.timeline-card:not(.dragging)')];
    return cards.reduce(
        (closest, el) => {
            const box = el.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            return offset < 0 && offset > closest.offset ? { offset, element: el } :
                closest;
        }, { offset: Number.NEGATIVE_INFINITY, element: null }
    ).element;
}