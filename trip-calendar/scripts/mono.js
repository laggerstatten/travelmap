




/* ===============================
   Timeline Rendering & Interaction
   =============================== */

// --- Main render ---
function renderTimeline() {
  const cal = document.getElementById('calendar');
  cal.className = 'timeline';
  cal.innerHTML = '';

  let lastDay = '';
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const day = seg.start?.utc ? dayStr(seg.start.utc) : '';
    if (day && day !== lastDay) {
      cal.appendChild(renderDayDivider(day));
      lastDay = day;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'rail-pair';
    wrapper.appendChild(renderRails());
    wrapper.appendChild(renderCard(seg));
    cal.appendChild(wrapper);
  }

  cal.addEventListener('dragover', handleDragOver);
  cal.addEventListener('drop', (e) => e.preventDefault());
}


function dayStr(iso) {
  if (!iso) return '';
  return new Date(iso).toDateString();
}

// --- Build single day divider ---
function renderDayDivider(day) {
  const div = document.createElement('div');
  div.className = 'day-divider';
  div.textContent = day;
  return div;
}

function newId() {
  return crypto.randomUUID ?
    crypto.randomUUID() :
    Date.now() + Math.random().toString(36).slice(2);
}

function save(noRender = false) {
  //computeSlackAndOverlap(segments);
  localStorage.setItem('tripSegments', JSON.stringify(segments));
  if (!noRender) renderTimeline();
  console.log('save');
}

// --- Build decorative rails ---
function renderRails() {
  const rails = document.createElement('div');
  rails.className = 'rails';
  rails.innerHTML = `
    <div class="insolation-rail"></div>
    <div class="weather-rail"></div>`;
  return rails;
}

// --- Build a card ---
function renderCard(seg) {
  const card = document.createElement('div');
  card.className = `segment timeline-card ${seg.type || 'stop'} ${cardBadgeClass(seg)}`;

  let title = seg.name || '(untitled)';
  let metaHTML = 'No date set';
  let driveInfoHTML = '';

  // ───────────────────────────────
  // Trip start
  // ───────────────────────────────
  if (seg.type === 'trip_start') {
    if (seg.end?.utc) metaHTML = fmtDate(seg.end.utc, seg.timeZone);

    card.innerHTML = `
      <div class="title">${title}</div>
      <div class="subtitle">
      ${seg.type}${seg.name ? ' • ' + seg.name : ''}
      ${seg.coordinates ? `<span class="coord-pill">📍</span>` : ''}
      </div>
      <div class="meta">${metaHTML}</div>
      <div class="card-footer">
        <button class="fill-forward-btn">⏩ Fill Forward</button>
        <button class="edit-btn">Edit</button>
      </div>`;
    card.querySelector('.edit-btn').onclick = () => editSegment(seg, card);
    card.querySelector('.fill-forward-btn').onclick = () => fillForward(seg);
  }

  // ───────────────────────────────
  // Trip end
  // ───────────────────────────────
  else if (seg.type === 'trip_end') {
    if (seg.start?.utc) metaHTML = fmtDate(seg.start.utc, seg.timeZone);

    card.innerHTML = `
      <div class="title">${title}</div>
      <div class="subtitle">
      ${seg.type}${seg.name ? ' • ' + seg.name : ''}
      ${seg.coordinates ? `<span class="coord-pill">📍</span>` : ''}
    </div>
      <div class="meta">${metaHTML}</div>
      <div class="card-footer">
        <button class="fill-backward-btn">⏪ Fill Backward</button>
        <button class="edit-btn">Edit</button>
      </div>`;
    card.querySelector('.edit-btn').onclick = () => editSegment(seg, card);
    card.querySelector('.fill-backward-btn').onclick = () => fillBackward(seg);
  }

  // ───────────────────────────────
  // Stop
  // ───────────────────────────────
  else if (seg.type === 'stop') {
    if (seg.start?.utc || seg.end?.utc) {
      const startStr = fmtDate(seg.start.utc, seg.timeZone);
      const endStr = fmtDate(seg.end.utc, seg.timeZone);
      metaHTML = `${startStr || ''}${endStr ? ' → ' + endStr : ''}`;
    }

    card.innerHTML = `
      <div class="title">${title}</div>
      <div class="subtitle">
      ${seg.type}${seg.name ? ' • ' + seg.name : ''}
      ${seg.coordinates ? `<span class="coord-pill">📍</span>` : ''}
    </div>
      <div class="meta">${metaHTML}</div>
      <div class="card-footer">
        <button class="fill-forward-btn">⏩ Fill Forward</button>
        <button class="fill-backward-btn">⏪ Fill Backward</button>
        ${seg.isQueued
        ? `<button class="insert-btn small">Insert into Route</button>`
        : ''
      }
        <button class="edit-btn">Edit</button>
        <button class="del-btn">Delete</button>
      </div>`;

    card.querySelector('.edit-btn').onclick = () => editSegment(seg, card);
    seg.isQueued
      ? (card.querySelector('.insert-btn').onclick = async () =>
        insertQueuedSegment(seg, card))
      : '';
    card.querySelector('.del-btn').onclick = () => deleteSegment(seg, card);
    card.querySelector('.fill-forward-btn').onclick = () => fillForward(seg);
    card.querySelector('.fill-backward-btn').onclick = () => fillBackward(seg);
  }

  // ───────────────────────────────
  // Drive
  // ───────────────────────────────
  else if (seg.type === 'drive') {
    const origin = segments.find((ev) => ev.id === seg.originId);
    const dest = segments.find((ev) => ev.id === seg.destinationId);
    const originName = origin?.name || origin?.location_name || 'Unknown';
    const destName = dest?.name || dest?.location_name || 'Unknown';
    title = `Drive: ${originName} → ${destName}`;

    if (seg.start?.utc || seg.end?.utc) {
      const startStr = fmtDate(seg.start.utc, origin?.timeZone || seg.timeZone);
      const endStr = fmtDate(seg.end.utc, dest?.timeZone || seg.timeZone);
      metaHTML = `${startStr || ''}${endStr ? ' → ' + endStr : ''}`;
    }

    if (seg.distanceMi) {
      driveInfoHTML = `<div class="drive-info">🚗 ${seg.distanceMi} mi • ${seg.durationMin} min</div>`;
    }

    card.innerHTML = `
      <div class="title">${title}</div>
      <div class="subtitle">
      ${seg.type}${seg.name ? ' • ' + seg.name : ''}${driveInfoHTML}
    </div>
      <div class="meta">${metaHTML}</div>
      <div class="card-footer">
        <button class="fill-forward-btn">⏩ Fill Forward</button>
        <button class="fill-backward-btn">⏪ Fill Backward</button>
        <button class="edit-btn">Edit</button>
        <button class="del-btn">Delete</button>
      </div>`;

    card.querySelector('.edit-btn').onclick = () => editSegment(seg, card);
    card.querySelector('.del-btn').onclick = () => deleteSegment(seg, card);
    card.querySelector('.fill-forward-btn').onclick = () => fillForward(seg);
    card.querySelector('.fill-backward-btn').onclick = () => fillBackward(seg);
  }

  // ───────────────────────────────
  // Slack
  // ───────────────────────────────
  else if (seg.type === 'slack') {
    const startStr = fmtDate(seg.start.utc);
    const endStr = fmtDate(seg.end.utc);
    metaHTML = `${startStr} → ${endStr}`;
    const hours =
      seg.duration?.val?.toFixed(2) ?? (seg.minutes / 60).toFixed(2);

    card.innerHTML = `
      <div class="title">Slack (${hours}h)</div>
      <div class="subtitle">Gap between ${seg.a} → ${seg.b}</div>
      <div class="meta">${metaHTML}</div>`;
  }

  // ───────────────────────────────
  // Overlap
  // ───────────────────────────────
  else if (seg.type === 'overlap') {
    const startStr = fmtDate(seg.start.utc);
    const endStr = fmtDate(seg.end.utc);
    metaHTML = `${startStr} → ${endStr}`;
    const hours =
      seg.duration?.val?.toFixed(2) ?? (seg.minutes / 60).toFixed(2);

    card.innerHTML = `
      <div class="title">Overlap (${hours}h)</div>
      <div class="subtitle">Conflict between ${seg.a} ↔ ${seg.b}</div>
      <div class="meta">${metaHTML}</div>`;
  }

  attachCardDragHandlers(card);

  // Auto-open editor
  if (seg.openEditor) {
    // Avoid duplicates if already editing
    if (!card.querySelector('.oncard-editor')) {
      buildOnCardEditor(seg, card);
    }
  }

  return card;
}

function cardBadgeClass(seg) {
  if (seg.type !== 'drive') return '';
  if (seg.autoDrive && !seg.manualEdit) return 'auto';
  if (seg.manualEdit) return 'edited';
  return 'manual';
}

function buildOnCardEditor(seg, card) {
  // Prevent duplicates
  card.querySelector('.oncard-editor')?.remove();
  card.classList.add('editing');

  const editor = createEditorForm(seg);
  card.appendChild(editor);

  attachLockButtons(editor, seg);
  attachClearButtons(editor, seg);
  attachSearchBox(editor, seg);
  handleEditorSubmit(editor, seg, card);

  // Cancel button
  editor.querySelector('.cancel').onclick = () => {
    card.classList.remove('editing');
    editor.remove();
  };
}

// Form Creation
function createEditorForm(seg) {
  const form = document.createElement('form');
  form.className = 'oncard-editor';

  const id = seg.id;

  const localStart = seg.start
    ? utcToLocalInput(seg.start.utc, seg.timeZone)
    : '';
  const localEnd = seg.end ? utcToLocalInput(seg.end.utc, seg.timeZone) : '';

  let timeFields = '';

if (seg.type === 'trip_start') {
  timeFields = createTimeField('Trip Start', 'end', localEnd, 'end.lock', seg.end);
} else if (seg.type === 'trip_end') {
  timeFields = createTimeField('Trip End', 'start', localStart, 'start.lock', seg.start);
} else if (seg.type === 'stop') {
  timeFields = `
    ${createTimeField('Start', 'start', localStart, 'start.lock', seg.start)}
    ${createTimeField('End', 'end', localEnd, 'end.lock', seg.end)}
    <label>Duration (hours)
      <div class="time-row">
        <input type="number" step="0.25" name="duration" value="${seg.duration?.val ?? ''}" />
        ${lockButtonHTML('duration.lock', seg.duration)}
        ${clearButtonHTML('duration')}
      </div>
    </label>`;
}

  if (seg.type === 'drive') {
  }

  if (seg.type === 'slack') {
  }

  if (seg.type === 'overlap') {
  }

  form.innerHTML = `
    <label>Name
      <input name="name" value="${seg.name || ''}" />
    </label>
    <label>Type
      <select name="type">
        ${['trip_start', 'stop', 'drive', 'lodging', 'break', 'trip_end']
      .map(
        (t) =>
          `<option value="${t}" ${seg.type === t ? 'selected' : ''}>${t[0].toUpperCase() + t.slice(1)
          }</option>`
      )
      .join('')}
      </select>
    </label>
    <label>Location
      <mapbox-search-box id="searchbox-${id}" value="${seg.location_name || ''
    }"></mapbox-search-box>
    </label>
    ${timeFields}

    <div class="actions">
      <button type="submit" class="small save">Save</button>
      <button type="button" class="small cancel">Cancel</button>
    </div>`;

  // Initialize Flatpickr on any date/time fields
  /**
    setTimeout(() => {
      form.querySelectorAll('.flatpickr-datetime').forEach((el) => {
        flatpickr(el, {
          enableTime: true,
          dateFormat: "Y-m-d H:i",  // no seconds
          time_24hr: true,
          minuteIncrement: 15,
          allowInput: true,
          defaultDate: el.value || null,
          onChange: function(selectedDates, dateStr) {
            // Strip seconds if manually typed
            el.value = dateStr.slice(0, 16);
          }
        });
      });
    }, 0);
  */

  setTimeout(() => {
  form.querySelectorAll('input[name="start"], input[name="end"]').forEach((el) => {
    flatpickr(el, {
      enableTime: true,
      dateFormat: "Y-m-d\\TH:i",
      time_24hr: true,
      minuteIncrement: 15,
      allowInput: true,
      defaultDate: el.value || null,
      onChange: (dates, dateStr) => { el.value = dateStr; }
    });
  });
}, 0);


  return form;
}

  function createTimeField(label, name, value, lockField, timeElement) {
    return `
    <label class="time-field">
      <span>${label}</span>
      <div class="time-row">
        <!--<input type="datetime-local" name="${name}" step="900" value="${value}" />-->
        <input type="text" name="${name}" step="900" value="${value}" />

        ${lockButtonHTML(lockField, timeElement)}
        ${clearButtonHTML(name)}
      </div>
    </label>`;
  }

/**
  function createTimeField(label, name, value, lockField, timeElement) {
    return `
    <label class="time-field">
      <span>${label}</span>
      <div class="time-row">
        <input 
          type="text" 
          class="flatpickr-datetime" 
          name="${name}" 
          data-field="${name}" 
          value="${value}" 
          placeholder="Select date/time" />
        ${lockButtonHTML(lockField, timeElement)}
        ${clearButtonHTML(name)}
      </div>
    </label>`;
  }
*/


function lockButtonHTML(field, timeelement = {}) {
  const lock = timeelement.lock || 'unlocked';
  let iconClass, title;
  switch (lock) {
    case 'hard':
      iconClass = 'fa-solid fa-lock';
      title = 'Hard locked — click to unlock';
      break;
    case 'soft':
      iconClass = 'fa-solid fa-gear';
      title = 'Soft (derived)';
      break;
    default:
      iconClass = 'fa-regular fa-square';
      title = 'Unlocked — click to hard lock';
  }
  const disabled = lock === 'soft' ? 'disabled' : '';
  return `<button type="button" class="lock-toggle" data-field="${field}" ${disabled} 
  title="${title}"><i class="${iconClass}"></i></button>`;
}

function clearButtonHTML(field) {
  return `<button type="button" class="clear-field" data-field="${field}" 
  title="Clear field">
    <i class="fa-solid fa-xmark"></i>
  </button>`;
}






function attachSearchBox(editor, seg) {
  /* ---------- Mapbox Search ---------- */
  const searchEl = editor.querySelector(`#searchbox-${seg.id}`);
  if (!searchEl) return;

  try {
    searchEl.accessToken = mapboxgl.accessToken;
  } catch { }
  searchEl.addEventListener('retrieve', async (ev) => {
    const f = ev.detail?.features?.[0];
    if (!f?.geometry) return;

    seg.coordinates = f.geometry.coordinates;

    seg.location_name =
      f.properties?.name || f.properties?.place_formatted || f.place_name || '';

    // Auto-title if blank
    if (!seg.name || seg.name.trim() === '' || seg.name === '(untitled)') {
      seg.name = seg.location_name;
      editor.querySelector('input[name="name"]').value = seg.name;
    }

    // Ensure timezone is attached
    try {
      seg.timeZone = await getTimeZone(seg.coordinates);
    } catch (err) {
      console.warn('Timezone lookup failed:', err);
    }
  });
}

function handleEditorSubmit(editor, seg, card) {
  editor.addEventListener('submit', (submitEv) => {
    submitEv.preventDefault();

    const formData = Object.fromEntries(new FormData(editor).entries());
    console.log(formData);
    const prev = structuredClone(seg); // full copy

    // ✅ Ensure nested structure exists
    seg.start ??= { utc: '', lock: 'unlocked' };
    seg.end ??= { utc: '', lock: 'unlocked' };
    seg.duration ??= { val: null, lock: 'unlocked' };

    // Parse numeric duration
    const durVal = formData['duration']?.trim()
      ? Number(formData['duration'])
      : null;

    // Convert form times to UTC
    const newStartUTC = formData['start']
      ? localToUTC(formData['start'], seg.timeZone)
      : '';
    const newEndUTC = formData['end']
      ? localToUTC(formData['end'], seg.timeZone)
      : '';

    // Only set hard locks if user explicitly changed or field was previously unlocked
    if (newStartUTC && newStartUTC !== prev.start?.utc) {
      seg.start.utc = newStartUTC;
      if (seg.start.lock !== 'hard') seg.start.lock = 'unlocked';
    }
    if (newEndUTC && newEndUTC !== prev.end?.utc) {
      seg.end.utc = newEndUTC;
      if (seg.end.lock !== 'hard') seg.end.lock = 'unlocked';
    }
    if (durVal !== null && durVal !== Number(prev.duration?.val || 0)) {
      seg.duration.val = durVal;
      if (seg.duration.lock !== 'hard') seg.duration.lock = 'unlocked';
    }

    // Preserve any existing soft/unlocked states
    seg.start.lock ??= prev.start?.lock || 'unlocked';
    seg.end.lock ??= prev.end?.lock || 'unlocked';
    seg.duration.lock ??= prev.duration?.lock || 'unlocked';

    // Apply derived/soft lock logic
    updateLockConsistency(seg);

    seg.name = formData.name || '';
    seg.type = formData.type || 'stop';

    if (seg.type === 'drive' && seg.autoDrive) {
      seg.manualEdit = true;
      seg.autoDrive = false;
    }

    card.classList.remove('editing');
    editor.remove();
    if (
      seg.isQueued &&
      (seg.type === 'trip_start' || seg.type === 'trip_end')
    ) {
      seg.isQueued = false;
    }

    if (seg.openEditor) {
      seg.openEditor = false;
    }

    save();

    renderTimeline();
  });
}