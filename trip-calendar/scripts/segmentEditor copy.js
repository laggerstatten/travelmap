function buildOnCardEditor(seg, card) {
  // Prevent duplicates
  card.querySelector('.oncard-editor')?.remove();
  card.classList.add('editing');

  const editor = createEditorForm(seg);
  card.appendChild(editor);

  attachLockButtons(editor, seg);
  attachClearButtons(editor, seg);

  // Only show geocoder while segment is queued
  if (seg.isQueued) {
    requestAnimationFrame(() => attachGeocoder(editor, seg));
  } else {
    const geoContainer = editor.querySelector(`#geocoder-${seg.id}`);
    if (geoContainer) geoContainer.style.display = 'none';
  }

  handleEditorSubmit(editor, seg, card);

  // Cancel button
  editor.querySelector('.cancel').onclick = () => {
    card.classList.remove('editing');
    editor.remove();
  };
}

/* ===============================
   Form Creation
   =============================== */
function createEditorForm(seg) {
  const form = document.createElement('form');
  form.className = 'oncard-editor';
  const id = seg.id;

  const localStart = seg.start ? utcToLocalInput(seg.start.utc, seg.timeZone) : '';
  const localEnd = seg.end ? utcToLocalInput(seg.end.utc, seg.timeZone) : '';

  let timeFields = '';

  if (seg.type === 'trip_start') {
    timeFields = createTimeField('Trip Start', 'end', localEnd, 'end.lock', seg.end);
    form.innerHTML = `
      <label>Name
        <input name="name" value="${seg.name || ''}" />
      </label>
      <label>Location
        <div id="geocoder-${id}" class="geocoder-container"></div>
      </label>
      ${timeFields}
      <div class="actions">
        <button type="submit" class="small save">Save</button>
        <button type="button" class="small cancel">Cancel</button>
      </div>`;
  }

  else if (seg.type === 'trip_end') {
    timeFields = createTimeField('Trip End', 'start', localStart, 'start.lock', seg.start);

    form.innerHTML = `
      <label>Name
        <input name="name" value="${seg.name || ''}" />
      </label>
      <label>Location
        <div id="geocoder-${id}" class="geocoder-container"></div>
      </label>
      ${timeFields}

      <div class="actions">
        <button type="submit" class="small save">Save</button>
        <button type="button" class="small cancel">Cancel</button>
      </div>`;
  }

  else if (seg.type === 'stop' || seg.type === 'drive') {
    const listItems = (seg.items || []).map((item, i) => `
      <li data-index="${i}">
        <span class="drag-handle"><i class="fa-solid fa-grip-vertical"></i></span>
        <input value="${item}" />
        <button type="button" class="remove-item">✕</button>
      </li>
      `).join('');

    const hasItems = seg.items && seg.items.length > 0;
    const collapsed = hasItems ? '' : 'collapsed';

    timeFields = seg.type === 'stop' ? `
      ${createTimeField('Start', 'start', localStart, 'start.lock', seg.start)}
      <label>Duration (hours)
        <div class="time-row">
          <input type="number" step="0.25" name="duration" value="${seg.duration?.val ?? ''}" />
          ${lockButtonHTML('duration.lock', seg.duration)}
          ${clearButtonHTML('duration')}
        </div>
      </label>
      ${createTimeField('End', 'end', localEnd, 'end.lock', seg.end)}` : '';

    form.innerHTML = `
      ${seg.type === 'stop' ? `
        <label>Name
          <input name="name" value="${seg.name || ''}" />
        </label>
        <label>Location
          <div id="geocoder-${id}" class="geocoder-container"></div>
        </label>` : ''}
      ${timeFields}
      <div class="sublist ${collapsed}">
        <div class="sublist-header">
          <span>Notes / Subitems</span>
          <button type="button" class="toggle-sublist">
            <i class="fa-solid fa-caret-${collapsed ? 'right' : 'down'}"></i>
          </button>
        </div>
        <ul class="sublist-items">${listItems}</ul>
        <button type="button" class="add-item">Add Item</button>
      </div>
      <div class="actions">
        <button type="submit" class="small save">Save</button>
        <button type="button" class="small cancel">Cancel</button>
      </div>`;
  }

  // Initialize flatpickr on time inputs
  setTimeout(() => {
    form.querySelectorAll('input[name="start"], input[name="end"]').forEach((el) => {
      flatpickr(el, {
        enableTime: true,
        dateFormat: 'Y-m-d\\TH:i',
        time_24hr: true,
        minuteIncrement: 15,
        allowInput: true,
        defaultDate: el.value || null,
        onChange: (dates, dateStr) => { el.value = dateStr; }
      });
    });
  }, 0);

  attachSublistHandlers(form);
  return form;
}

/* ===============================
   Sublist Handlers (Add / Remove / Reorder / Collapse)
   =============================== */
function attachSublistHandlers(editor) {
  const addBtn = editor.querySelector('.add-item');
  const list = editor.querySelector('.sublist-items');
  const sublist = editor.querySelector('.sublist');
  const toggle = editor.querySelector('.toggle-sublist');


  // ensure outer timeline/card drag code doesn't intercept
  ['mousedown','touchstart','pointerdown'].forEach(evt => {
    sublist.addEventListener(evt, e => e.stopPropagation(), { passive: true });
  });


  if (!sublist) return;

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
    <input value="">
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
    }
  });

  // Optional reorder with SortableJS if available
  if (typeof Sortable !== 'undefined' && list) {
    new Sortable(list, {
      animation: 150,
      handle: '.drag-handle',

      // 👇 key bits to avoid conflicts with outer drag logic
      forceFallback: true,        // use mouse/touch fallback (not HTML5 DnD)
      fallbackOnBody: true,
      fallbackTolerance: 5,       // px before it considers it a drag

      // keep scrolling/dragover sane inside scrollable cards
      scroll: true,
      bubbleScroll: true,
      dragoverBubble: true,

      // don't block clicks on inputs/buttons
      filter: 'input,button',
      preventOnFilter: false,
    });
  }


}

/* ===============================
   Time / Lock / Clear Helpers
   =============================== */
function createTimeField(label, name, value, lockField, timeElement) {
  return `
    <label class="time-field">
      <span>${label}</span>
      <div class="time-row">
        <input type="text" name="${name}" step="900" value="${value}"
          autocomplete="off" autocorrect="off" autocapitalize="off"
          spellcheck="false" data-no-autocomplete/>
        ${lockButtonHTML(lockField, timeElement)}
        ${clearButtonHTML(name)}
      </div>
    </label>`;
}

function lockButtonHTML(field, timeelement = {}) {
  const lock = timeelement.lock || 'unlocked';
  let iconClass, title;
  switch (lock) {
    case 'hard': iconClass = 'fa-solid fa-lock'; title = 'Hard locked — click to unlock'; break;
    case 'soft': iconClass = 'fa-solid fa-gear'; title = 'Soft (derived)'; break;
    default: iconClass = 'fa-regular fa-square'; title = 'Unlocked — click to hard lock';
  }
  const disabled = lock === 'soft' ? 'disabled' : '';
  return `<button type="button" class="lock-toggle" data-field="${field}" ${disabled} title="${title}">
            <i class="${iconClass}"></i>
          </button>`;
}

function clearButtonHTML(field) {
  return `<button type="button" class="clear-field" data-field="${field}" title="Clear field">
            <i class="fa-solid fa-xmark"></i>
          </button>`;
}

