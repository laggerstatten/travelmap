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

  else if (seg.type === 'stop') {
    timeFields = `
      ${createTimeField('Start', 'start', localStart, 'start.lock', seg.start)}
      <label>Duration (hours)
        <div class="time-row">
          <input type="number" step="0.25" name="duration" value="${seg.duration?.val ?? ''}" />
          ${lockButtonHTML('duration.lock', seg.duration)}
          ${clearButtonHTML('duration')}
        </div>
      </label>
      ${createTimeField('End', 'end', localEnd, 'end.lock', seg.end)}`;

    const listItems = (seg.items || []).map((item, i) => `
      <li data-index="${i}">
        <input value="${item}" />
        <button type="button" class="remove-item">✕</button>
      </li>`).join('');

    form.innerHTML = `
      <label>Name
        <input name="name" value="${seg.name || ''}" />
      </label>
      <label>Location
        <div id="geocoder-${id}" class="geocoder-container"></div>
      </label>
      ${timeFields}

      <div class="sublist">
        <label>Notes / Subitems</label>
        <ul class="sublist-items">${listItems}</ul>
        <button type="button" class="add-item">Add Item</button>
      </div>
      <div class="actions">
        <button type="submit" class="small save">Save</button>
        <button type="button" class="small cancel">Cancel</button>
      </div>`;
  }

  else if (seg.type === 'drive') {
    const listItems = (seg.items || []).map((item, i) => `
      <li data-index="${i}">
        <input value="${item}" />
        <button type="button" class="remove-item">✕</button>
      </li>`).join('');

    form.innerHTML = `
      ${timeFields}
      
      <div class="sublist">
        <label>Notes / Subitems</label>
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

  // Add sublist handlers
  attachSublistHandlers(form);

  return form;
}

/* ===============================
   Sublist Handlers
   =============================== */
function attachSublistHandlers(editor) {
  const addBtn = editor.querySelector('.add-item');
  const list = editor.querySelector('.sublist-items');
  if (!addBtn || !list) return;

  addBtn.addEventListener('click', () => {
    const li = document.createElement('li');
    li.innerHTML = `<input value=""><button type="button" class="remove-item">✕</button>`;
    list.appendChild(li);
  });

  editor.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-item')) {
      e.target.closest('li').remove();
    }
  });

  // Optional reorder with SortableJS if included
  if (typeof Sortable !== 'undefined') {
    new Sortable(list, { animation: 150 });
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
