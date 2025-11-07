function buildOnCardEditor(segment, card) {
  // Prevent duplicates
  card.querySelector('.oncard-editor')?.remove();
  card.classList.add('editing');

  const editor = createEditorForm(segment);
  card.appendChild(editor);

  attachLockButtons(editor, segment);
  attachClearButtons(editor, segment);
  attachSearchBox(editor, segment);
  handleEditorSubmit(editor, segment, card);

  // Cancel button
  editor.querySelector('.cancel').onclick = () => {
    card.classList.remove('editing');
    editor.remove();
  };
}

/* ---------- 1️⃣ Create form ---------- */
function createEditorForm(segment) {
  const form = document.createElement('form');
  form.className = 'oncard-editor';

  const id = segment.id;
  const isStart = segment.type === 'trip_start';
  const isEnd = segment.type === 'trip_end';

  const localStart = segment.start
    ? utcToLocalInput(segment.start.utc, segment.timeZone)
    : '';
  const localEnd = segment.end
    ? utcToLocalInput(segment.end.utc, segment.timeZone)
    : '';

  const timeFields = isStart
    ? `
      <label>Trip Start
        <input type="datetime-local" name="end" value="${localEnd}" />
        ${lockButtonHTML('endLock', segment.end)}
        ${clearButtonHTML('end')}
      </label>`
    : isEnd
      ? `
      <label>Trip End
        <input type="datetime-local" name="start" value="${localStart}" />
        ${lockButtonHTML('startLock', segment.start)}
        ${clearButtonHTML('start')}
      </label>`
      : `
      <label>Start
        <input type="datetime-local" name="start" value="${localStart}" />
        ${lockButtonHTML('startLock', segment.start)}
        ${clearButtonHTML('start')}
      </label>
      <label>End
        <input type="datetime-local" name="end" value="${localEnd}" />
        ${lockButtonHTML('endLock', segment.end)}
        ${clearButtonHTML('end')}
      </label>
      <label>Duration (hours)
        <input type="number" step="0.25" name="duration" value="${segment.duration?.val ?? ''}" />
        ${lockButtonHTML('durationLock', segment.duration)}
        ${clearButtonHTML('duration')}
      </label>`;

  form.innerHTML = `
    <label>Name
      <input name="name" value="${segment.name || ''}" />
    </label>
    <label>Type
      <select name="type">
        ${['trip_start', 'stop', 'drive', 'lodging', 'break', 'trip_end']
      .map(
        (t) =>
          `<option value="${t}" ${segment.type === t ? 'selected' : ''}>${t[0].toUpperCase() + t.slice(1)
          }</option>`
      )
      .join('')}
      </select>
    </label>
    <label>Location
      <mapbox-search-box id="searchbox-${id}" value="${segment.location_name || ''
    }"></mapbox-search-box>
    </label>
    ${timeFields}

    <div class="actions">
      <button type="submit" class="small save">Save</button>
      <button type="button" class="small cancel">Cancel</button>
    </div>`;
  return form;
}


function lockButtonHTML(field, state = {}) {
  const lock = state.lock || "";
  const icon =
    lock === "hard" ? "🔒" :
      lock === "soft" ? "🟡" :
        "🔓";
  const title =
    lock === "hard"
      ? "Hard locked — click to unlock"
      : lock === "soft"
        ? "Soft locked (derived)"
        : "Unlocked — click to hard lock";
  const disabled = lock === "soft" ? "disabled" : "";
  return `<button type="button" class="lock-toggle" data-field="${field}" ${disabled} title="${title}">${icon}</button>`;
}





/* ---------- 3️⃣ Submit handler ---------- */
function handleEditorSubmit(editor, segment, card) {
  editor.addEventListener('submit', (submitEv) => {
    submitEv.preventDefault();

    const formData = Object.fromEntries(new FormData(editor).entries());
    console.log(formData);
    const prev = structuredClone(segment); // full copy

    // ✅ Ensure nested structure exists
    segment.start ??= { utc: '', lock: 'unlocked' };
    segment.end ??= { utc: '', lock: 'unlocked' };
    segment.duration ??= { val: null, lock: 'unlocked' };

    // Parse numeric duration
    const durVal = formData['duration']?.trim()
      ? Number(formData['duration'])
      : null;

    // Convert form times to UTC
    const newStartUTC = formData['start']
      ? localToUTC(formData['start'], segment.timeZone)
      : '';
    const newEndUTC = formData['end']
      ? localToUTC(formData['end'], segment.timeZone)
      : '';

    // Only set hard locks if user explicitly changed the field
    if (newStartUTC && newStartUTC !== prev.start?.utc) {
      segment.start.utc = newStartUTC;
      segment.start.lock = 'hard';
    }
    if (newEndUTC && newEndUTC !== prev.end?.utc) {
      segment.end.utc = newEndUTC;
      segment.end.lock = 'hard';
    }
    if (durVal !== null && durVal !== Number(prev.duration?.val || 0)) {
      segment.duration.val = durVal;
      segment.duration.lock = 'hard';
    }

    // Preserve any existing soft/unlocked states
    segment.start.lock ??= prev.start?.lock || 'unlocked';
    segment.end.lock ??= prev.end?.lock || 'unlocked';
    segment.duration.lock ??= prev.duration?.lock || 'unlocked';

    // Apply derived/soft lock logic
    updateLockConsistency(segment);

    segment.name = formData.name || '';
    segment.type = formData.type || 'stop';

    if (segment.type === 'drive' && segment.autoDrive) {
      segment.manualEdit = true;
      segment.autoDrive = false;
    }

    card.classList.remove('editing');
    editor.remove();
    save();
    renderTimeline();
  });
}

function updateLockConsistency(segment) {
  const hard = {
    start: segment.start.lock === 'hard',
    end: segment.end.lock === 'hard',
    duration: segment.duration.lock === 'hard'
  };

  // Soft-lock logic
  segment.start.lock = hard.start ? 'hard' : 'unlocked';
  segment.end.lock = hard.end ? 'hard' : 'unlocked';
  segment.duration.lock = hard.duration ? 'hard' : 'unlocked';

  const lockedCount = Object.values(hard).filter(Boolean).length;

  // Apply soft locks and derive missing field
  if (lockedCount >= 2) {
    if (hard.start && hard.end && !hard.duration) {
      segment.duration.val = durationFromStartEnd(segment.start.utc, segment.end.utc);
      segment.duration.lock = 'soft';
    } else if (hard.start && hard.duration && !hard.end) {
      segment.end.utc = endFromDuration(segment.start.utc, segment.duration.val);
      segment.end.lock = 'soft';
    } else if (hard.end && hard.duration && !hard.start) {
      segment.start.utc = startFromDuration(segment.end.utc, segment.duration.val);
      segment.start.lock = 'soft';
    }
  }
}





function clearButtonHTML(field) {
  return `<button type="button" class="clear-field" data-field="${field}" title="Clear this field">🗑️</button>`;
}

function attachLockButtons(editor, segment) {
  editor.querySelectorAll(".lock-toggle").forEach(btn => {
    btn.addEventListener("click", e => {
      const field = e.currentTarget.dataset.field;
      if (!field) return;

      // Prevent manual toggle of soft locks
      if (segment[field] === "soft") return;

      segment[field] =
        segment[field] === "hard" ? "unlocked" : "hard";

      // Update icon
      e.currentTarget.textContent =
        segment[field] === "hard" ? "🔒" : "🔓";
      e.currentTarget.title =
        segment[field] === "hard"
          ? "Hard locked — click to unlock"
          : "Unlocked — click to hard lock";
    });
  });
}

function attachClearButtons(editor, segment) {
  editor.querySelectorAll(".clear-field").forEach(btn => {
    btn.addEventListener("click", e => {
      const field = e.currentTarget.dataset.field;
      if (!field) return;

      // Clear form field value
      const input = editor.querySelector(`[name="${field}"]`);
      if (input) input.value = "";

      // Remove value from segment but keep logic intact
      segment[field] = "";
      segment[`${field}Lock`] = "unlocked";
    });
  });
}


/* ---------- 2️⃣ Search box ---------- */
function attachSearchBox(editor, segment) {
  /* ---------- Mapbox Search ---------- */
  const searchEl = editor.querySelector(`#searchbox-${segment.id}`);
  if (!searchEl) return;

  try {
    searchEl.accessToken = mapboxgl.accessToken;
  } catch { }
  searchEl.addEventListener('retrieve', async (ev) => {
    const f = ev.detail?.features?.[0];
    if (!f?.geometry) return;

    segment.coordinates = f.geometry.coordinates;

    segment.location_name =
      f.properties?.name || f.properties?.place_formatted || f.place_name || '';

    // Auto-title if blank
    if (
      !segment.name ||
      segment.name.trim() === '' ||
      segment.name === '(untitled)'
    ) {
      segment.name = segment.location_name;
      editor.querySelector('input[name="name"]').value = segment.name;
    }

    // Ensure timezone is attached
    try {
      segment.timeZone = await getTimeZone(segment.coordinates);
    } catch (err) {
      console.warn('Timezone lookup failed:', err);
    }
  });
}


function durationFromStartEnd(startUTC, endUTC) {
  const s = new Date(startUTC),
    e = new Date(endUTC);
  return (e - s) / 3600000; // hours
}

function endFromDuration(startUTC, hours) {
  const s = new Date(startUTC);
  return new Date(s.getTime() + hours * 3600000).toISOString();
}

function startFromDuration(endUTC, hours) {
  const e = new Date(endUTC);
  return new Date(e.getTime() - hours * 3600000).toISOString();
}





