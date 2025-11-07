function buildOnCardEditor(seg, card) {
  console.log(seg, card);
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

/* ---------- 1️⃣ Create form ---------- */
function createEditorForm(seg) {
  const form = document.createElement('form');
  form.className = 'oncard-editor';

  const id = seg.id;

  const localStart = seg.start ?
    utcToLocalInput(seg.start.utc, seg.timeZone) :
    '';
  const localEnd = seg.end ?
    utcToLocalInput(seg.end.utc, seg.timeZone) :
    '';

  let timeFields = '';

  if (seg.type === 'trip_start') {
    timeFields = `<label>Trip Start
        <input type="datetime-local" name="end" value="${localEnd}" />
        ${lockButtonHTML('endLock', seg.end)}
        ${clearButtonHTML('end')}
      </label>`
  }

  if (seg.type === 'trip_end') {
    timeFields = `<label>Trip End
        <input type="datetime-local" name="start" value="${localStart}" />
        ${lockButtonHTML('startLock', seg.start)}
        ${clearButtonHTML('start')}
      </label>`
  }

  if (seg.type === 'stop') {
    timeFields = `<label>Start
        <input type="datetime-local" name="start" value="${localStart}" />
        ${lockButtonHTML('startLock', seg.start)}
        ${clearButtonHTML('start')}
      </label>
      <label>End
        <input type="datetime-local" name="end" value="${localEnd}" />
        ${lockButtonHTML('endLock', seg.end)}
        ${clearButtonHTML('end')}
      </label>
      <label>Duration (hours)
        <input type="number" step="0.25" name="duration" value="${seg.duration?.val ?? ''}" />
        ${lockButtonHTML('durationLock', seg.duration)}
        ${clearButtonHTML('duration')}
      </label>`;
  }

  if (seg.type === 'drive') {  }

  if (seg.type === 'slack') { }

  if (seg.type === 'overlap') { }


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
  return form;
}


function lockButtonHTML(field, timeelement = {}) {
  const lock = timeelement.lock || "";
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

    // Only set hard locks if user explicitly changed the field
    if (newStartUTC && newStartUTC !== prev.start?.utc) {
      seg.start.utc = newStartUTC;
      seg.start.lock = 'hard';
    }
    if (newEndUTC && newEndUTC !== prev.end?.utc) {
      seg.end.utc = newEndUTC;
      seg.end.lock = 'hard';
    }
    if (durVal !== null && durVal !== Number(prev.duration?.val || 0)) {
      seg.duration.val = durVal;
      seg.duration.lock = 'hard';
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
    save();
    renderTimeline();
  });
}

function updateLockConsistency(seg) {
  const hard = {
    start: seg.start.lock === 'hard',
    end: seg.end.lock === 'hard',
    duration: seg.duration.lock === 'hard'
  };

  // Soft-lock logic
  seg.start.lock = hard.start ? 'hard' : 'unlocked';
  seg.end.lock = hard.end ? 'hard' : 'unlocked';
  seg.duration.lock = hard.duration ? 'hard' : 'unlocked';

  const lockedCount = Object.values(hard).filter(Boolean).length;

  // Apply soft locks and derive missing field
  if (lockedCount >= 2) {
    if (hard.start && hard.end && !hard.duration) {
      seg.duration.val = durationFromStartEnd(seg.start.utc, seg.end.utc);
      seg.duration.lock = 'soft';
    } else if (hard.start && hard.duration && !hard.end) {
      seg.end.utc = endFromDuration(seg.start.utc, seg.duration.val);
      seg.end.lock = 'soft';
    } else if (hard.end && hard.duration && !hard.start) {
      seg.start.utc = startFromDuration(seg.end.utc, seg.duration.val);
      seg.start.lock = 'soft';
    }
  }
}





function clearButtonHTML(field) {
  return `<button type="button" class="clear-field" data-field="${field}" title="Clear this field">🗑️</button>`;
}

function attachLockButtons(editor, seg) {
  editor.querySelectorAll(".lock-toggle").forEach(btn => {
    btn.addEventListener("click", e => {
      const field = e.currentTarget.dataset.field;
      if (!field) return;

      // Prevent manual toggle of soft locks
      if (seg[field] === "soft") return;

      seg[field] =
        seg[field] === "hard" ? "unlocked" : "hard";

      // Update icon
      e.currentTarget.textContent =
        seg[field] === "hard" ? "🔒" : "🔓";
      e.currentTarget.title =
        seg[field] === "hard"
          ? "Hard locked — click to unlock"
          : "Unlocked — click to hard lock";
    });
  });
}

function attachClearButtons(editor, seg) {
  editor.querySelectorAll(".clear-field").forEach(btn => {
    btn.addEventListener("click", e => {
      const field = e.currentTarget.dataset.field;
      if (!field) return;

      // Clear form field value
      const input = editor.querySelector(`[name="${field}"]`);
      if (input) input.value = "";

      // Remove value from segment but keep logic intact
      seg[field] = "";
      seg[`${field}Lock`] = "unlocked";
    });
  });
}


/* ---------- Search box ---------- */
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
    if (
      !seg.name ||
      seg.name.trim() === '' ||
      seg.name === '(untitled)'
    ) {
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










