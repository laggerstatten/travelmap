/* ===============================
   Sublist Handlers (Add / Remove / Reorder / Collapse)
   =============================== */
function attachSublistHandlers(editor, seg) {
  const addBtn = editor.querySelector('.add-item');
  const list = editor.querySelector('.sublist-items');
  const sublist = editor.querySelector('.sublist');
  const toggle = editor.querySelector('.toggle-sublist');
  if (!sublist) return;

  // Prevent outer drag interference
  ['mousedown', 'touchstart', 'pointerdown'].forEach((evt) => {
    sublist.addEventListener(evt, (e) => e.stopPropagation(), {
      passive: true
    });
  });

  // Collapse / expand
  toggle?.addEventListener('click', () => {
    const collapsed = sublist.classList.toggle('collapsed');
    toggle.querySelector('i').className = collapsed
      ? 'fa-solid fa-caret-right'
      : 'fa-solid fa-caret-down';
  });

  addBtn?.addEventListener('click', () => {
    const li = document.createElement('li');
    li.innerHTML = `
  <span class="drag-handle"><i class="fa-solid fa-grip-vertical"></i></span>
  <input class="item-name" placeholder="Task or stop" />
  <input class="item-dur" type="number" step="0.25" placeholder="hr" />
  <button type="button" class="remove-item">✕</button>`;
    list.appendChild(li);
    sublist.classList.remove('collapsed');
    toggle.querySelector('i').className = 'fa-solid fa-caret-down';
  });

  editor.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-item')) {
      e.target.closest('li').remove();
      if (list.children.length === 0) {
        sublist.classList.add('collapsed');
        toggle.querySelector('i').className = 'fa-solid fa-caret-right';
      }
      if (seg.type === 'drive') updateDriveDurations(editor, seg);
    }
  });

  // Auto-recalculate when durations change (drives only)
  if (seg.type === 'drive') {
    editor.addEventListener('input', (e) => {
      if (e.target.classList.contains('item-dur')) {
        updateDriveDurations(editor, seg);
      }
    });
  }

  // Enable reordering
  if (typeof Sortable !== 'undefined' && list) {
    new Sortable(list, {
      animation: 150,
      handle: '.drag-handle',
      forceFallback: true,
      fallbackOnBody: true,
      fallbackTolerance: 5,
      filter: 'input,button',
      preventOnFilter: false
    });
  }
}

/* ===============================
   Drive Duration Updater
   =============================== */
function updateDriveDurations(editor, seg) {
  const items = Array.from(editor.querySelectorAll('.sublist-items li'));

  seg.items = items.map((li) => {
    const type = li.dataset.type;
    const name = li.querySelector('.item-name').value.trim();

    if (type === 'waypoint') {
      const coords = JSON.parse(li.dataset.coords);
      return {
        type: 'waypoint',
        name,
        coordinates: coords
      };
    }

    return {
      name,
      dur: parseFloat(li.querySelector('.item-dur').value) || 0
    };
  });

  saveSegments();
}

function refreshSublistUI(seg) {
  const card = document.querySelector(`.card[data-id="${seg.id}"]`);
  if (!card) return;

  const editor = card.querySelector('form.oncard-editor');
  const list = editor.querySelector('.sublist-items');

  const html = (seg.items || [])
    .map((item, i) => {
      const isWaypoint = item.type === 'waypoint';

      return `
      <li data-index="${i}" data-type="${isWaypoint ? 'waypoint' : 'note'}">
        <span class="drag-handle"><i class="fa-solid fa-grip-vertical"></i></span>

        <input class="item-name"
               value="${item.name ?? ''}"
               placeholder="${isWaypoint ? 'Waypoint' : 'Task or stop'}" />

        ${
          isWaypoint
            ? `<span class="wp-coords">${item.coordinates[1].toFixed(
                5
              )}, ${item.coordinates[0].toFixed(5)}</span>`
            : `<input class="item-dur" type="number" value="${
                item.dur ?? ''
              }" step="0.25" />`
        }

        <button type="button" class="remove-item">✕</button>
      </li>
    `;
    })
    .join('');

  list.innerHTML = html;

  attachSublistHandlers(editor, seg);
}
