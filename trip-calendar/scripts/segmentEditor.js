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
    const listItems = (seg.items || []).map((item, i) => {
      const name = typeof item === 'object' ? item.name ?? '' : item;
      const dur = typeof item === 'object' ? item.dur ?? '' : '';
      return `
        <li data-index="${i}">
          <span class="drag-handle"><i class="fa-solid fa-grip-vertical"></i></span>
          <input class="item-name" value="${name}" placeholder="Task or stop" />
          <input class="item-dur" type="number" step="0.25" value="${dur}" placeholder="hr" />
          <button type="button" class="remove-item">✕</button>
        </li>`;
    }).join('');

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

    const constraintSection = `
      <div class="constraint-section">
        <div class="constraint-header">
          <span>Constraints</span>
          <div class="constraint-controls">
            <select class="constraint-type-select"></select>
            <button type="button" class="add-constraint small">Add</button>
          </div>
        </div>
        <ul class="constraint-list"></ul>
      </div>`;

    form.innerHTML = `
      ${seg.type === 'stop' ? `
        <label>Name 
        <input name="name" value="${seg.name || ''}" />
        </label>
        <label>Location 
        <div id="geocoder-${id}" class="geocoder-container"></div>
        </label>` : ''}
      ${timeFields}
      ${constraintSection}
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
        time_24hr: false, // changed
        minuteIncrement: 15,
        allowInput: true,
        defaultDate: el.value || null,
        onChange: (dates, dateStr) => { el.value = dateStr; }
      });
    });
  }, 0);

  attachSublistHandlers(form, seg);
  if (seg.type === 'stop') {
    attachConstraintEditor(form, seg);
  }


  return form;
}

/* ===============================
   Time / Lock / Clear Helpers
   =============================== */
function createTimeField(label, name, value, lockField, timeElement) {
  console.log(label);
  console.log(name);
  console.log(value);
  console.log(lockField);
  console.log(timeElement);

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

function renderParamField(seg, constraint, paramName) {
  const cid = constraint.cid;
  const ptype = detectParamType(paramName, constraint.type);
  const value = constraint.params[paramName] || "";

  /* ============================
     1. OPERATOR SELECT
     ============================ */
  if (ptype === "operator") {
    const cat = constraintTypes[constraint.type].operatorCategory;
    const opts = operatorOptions[cat] || [];

    return `
      <label class="param-row">
        ${paramName}:
        <select class="param-operator" data-cid="${cid}" data-param="${paramName}">
          ${opts.map(o =>
            `<option value="${o.value}" ${value === o.value ? 'selected':''}>
              ${o.label}
            </option>`
          ).join("")}
        </select>
      </label>`;
  }

  /* ============================
     2. DAYS OF WEEK CHECKBOXES
     ============================ */
  if (ptype === "daysOfWeek") {
    const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
    const selected = Array.isArray(value) ? value : [];

    return `
      <label class="param-row">
        ${paramName}:
        <div class="dow-checkboxes" data-cid="${cid}" data-param="${paramName}">
          ${days.map(d => `
            <label class="dow">
              <input type="checkbox" value="${d}" ${selected.includes(d) ? 'checked':''}>
              ${d}
            </label>
          `).join("")}
        </div>
      </label>`;
  }

  /* ============================
     3. MULTIPLE DATES
     ============================ */
  if (ptype === "multiDate") {
    return `
      <label class="param-row">
        ${paramName}:
        <input class="param-input multi-date"
               data-cid="${cid}" data-param="${paramName}"
               value="${Array.isArray(value) ? value.join(", ") : value}">
      </label>`;
  }

  /* ============================
     4. DATE RANGE
     ============================ */
  if (ptype === "dateRangeSingle") {
    return `
      <label class="param-row">
        ${paramName}:
        <input class="param-input date-range"
               data-cid="${cid}" data-param="${paramName}"
               value="${value && value.startDate ? `${value.startDate} to ${value.endDate}` : ""}">
      </label>`;
  }

  /* ============================
     5. WINDOWS LIST (time windows)
     ============================ */
  if (ptype === "windowsList") {
    const windows = Array.isArray(value) ? value : [];
    return `
      <div class="param-row windows-editor" data-cid="${cid}" data-param="${paramName}">
        <div class="windows-list">
          ${windows.map((w, i) => `
            <div class="window-item" data-index="${i}">
              <input class="window-start" value="${w.startTime || ''}" />
              <span>→</span>
              <input class="window-end" value="${w.endTime || ''}" />
              <button type="button" class="remove-window" data-index="${i}">✕</button>
            </div>
          `).join("")}
        </div>
        <button type="button" class="add-window">+ Add Window</button>
      </div>`;
  }

  /* ============================
     6. DATETIME
     ============================ */
  if (ptype === "datetime") {
    return `
      <label class="param-row">
        ${paramName}:
        <input class="param-input datetime-input"
               data-cid="${cid}" data-param="${paramName}"
               value="${value}">
      </label>`;
  }

  /* ============================
     7. DATE
     ============================ */
  if (ptype === "date") {
    return `
      <label class="param-row">
        ${paramName}:
        <input class="param-input date-input"
               data-cid="${cid}" data-param="${paramName}"
               value="${value}">
      </label>`;
  }

  /* ============================
     8. TIME
     ============================ */
  if (ptype === "time") {
    return `
      <label class="param-row">
        ${paramName}:
        <input class="param-input time-input"
               data-cid="${cid}" data-param="${paramName}"
               value="${value}">
      </label>`;
  }

  /* ============================
     9. SEGMENT SELECTOR
     ============================ */
  if (ptype === "segmentSelector") {
    return `
      <label class="param-row">
        ${paramName}:
        <select class="param-other-seg"
                data-cid="${cid}" data-param="${paramName}">
          ${window.globalSegments.map(s =>
            `<option value="${s.id}" ${s.id === value ? "selected":""}>
              ${s.name || s.id}
            </option>`
          ).join("")}
        </select>
      </label>`;
  }

  /* ============================
     10. DEFAULT TEXT FIELD
     ============================ */
  return `
    <label class="param-row">
      ${paramName}:
      <input class="param-input"
             data-cid="${cid}" data-param="${paramName}"
             value="${value}">
    </label>`;
}











