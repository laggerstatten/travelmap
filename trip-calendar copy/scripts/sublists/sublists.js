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
    toggle.querySelector('i').className = collapsed ?
        'fa-solid fa-caret-right' :
        'fa-solid fa-caret-down';
  });

  addBtn ?.addEventListener('click', () => {
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
    const durFields = Array.from(editor.querySelectorAll('.item-dur')).map(
        (i) => parseFloat(i.value) || 0
    );
    const breakHr = durFields.reduce((a, b) => a + b, 0);

    seg.breakHr = breakHr;

    const baseHr = parseFloat(seg.durationHr || seg.duration ?.val || 0 );
    const totalHr = baseHr + breakHr;

    seg.duration = seg.duration || {};
    seg.duration.val = totalHr;

    const durInput = editor.querySelector('input[name="duration"]');
    if (durInput) durInput.value = totalHr.toFixed(2);
}