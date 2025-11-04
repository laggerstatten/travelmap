function buildOnCardEditor(segment, card) {
  // Prevent duplicates
  card.querySelector('.oncard-editor')?.remove();
  card.classList.add('editing');

  const editor = createEditorForm(segment);
  card.appendChild(editor);

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
    ? utcToLocalInput(segment.start, segment.timeZone)
    : '';
  const localEnd = segment.end
    ? utcToLocalInput(segment.end, segment.timeZone)
    : '';

  const timeFields = isStart
    ? `
        <label>Trip Start
          <input type="datetime-local" name="end" value="${localEnd}" />
        </label>`
    : isEnd
    ? `
        <label>Trip End
          <input type="datetime-local" name="start" value="${localStart}" />
        </label>`
    : `
        <label>Start
          <input type="datetime-local" name="start" value="${localStart}" />
        </label>
        <label>End
          <input type="datetime-local" name="end" value="${localEnd}" />
        </label>
        <label>Duration (hours)
          <input type="number" step="0.25" name="duration" value="${
            segment.duration || ''
          }" />
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
              `<option value="${t}" ${segment.type === t ? 'selected' : ''}>${
                t[0].toUpperCase() + t.slice(1)
              }</option>`
          )
          .join('')}
      </select>
    </label>
    <label>Location
      <mapbox-search-box id="searchbox-${id}" value="${
    segment.location_name || ''
  }"></mapbox-search-box>
    </label>
    ${timeFields}

    <div class="actions">
      <button type="submit" class="small save">Save</button>
      <button type="button" class="small cancel">Cancel</button>
    </div>`;
  return form;
}

/* ---------- 2️⃣ Search box ---------- */
function attachSearchBox(editor, segment) {
    /* ---------- Mapbox Search ---------- */
  const searchEl = editor.querySelector(`#searchbox-${segment.id}`);
  if (!searchEl) return;

  try {
    searchEl.accessToken = mapboxgl.accessToken;
  } catch {}
  searchEl.addEventListener('retrieve', async (ev) => {
    const f = ev.detail?.features?.[0];
    if (!f?.geometry) return;

    segment.lat = f.geometry.coordinates[1];
    segment.lon = f.geometry.coordinates[0];
    segment.location_name =
      f.properties?.name || 
      f.properties?.place_formatted || 
      f.place_name || 
      '';

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
      segment.timeZone = await getTimeZone(segment.lat, segment.lon);
    } catch (err) {
      console.warn('Timezone lookup failed:', err);
    }
  });
}

/* ---------- 3️⃣ Submit handler ---------- */
function handleEditorSubmit(editor, segment, card) {
  editor.addEventListener('submit', (e) => {
    e.preventDefault();

    const formData = Object.fromEntries(new FormData(editor).entries());
    const dur = formData.duration?.trim() ? Number(formData.duration) : null;

    // Convert back to UTC for storage
    if (formData.start)
      segment.start = localToUTC(formData.start, segment.timeZone);
    if (formData.end) segment.end = localToUTC(formData.end, segment.timeZone);

    // Basic field updates
    segment.name = formData.name || '';
    segment.type = formData.type || 'stop';
    segment.duration = dur ?? '';

    // Derive missing end if duration is set
    if (!segment.end && segment.start && dur !== null)
      segment.end = endFromDuration(segment.start, dur);

    // Mark edited drives properly
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
