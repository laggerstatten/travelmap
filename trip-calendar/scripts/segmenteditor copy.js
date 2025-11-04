function buildOnCardEditor(segment, card) {
  // Prevent duplicates
  card.querySelector('.oncard-editor')?.remove();
  card.classList.add('editing');

  const editor = document.createElement('form');
  editor.className = 'oncard-editor';

  const id = segment.id;
  const isStart = segment.type === 'trip_start';
  const isEnd = segment.type === 'trip_end';

  let timeFields = '';
  if (isStart) {
    timeFields = `
    <label>Trip Start
      <input type="datetime-local" name="start" value="${
        segment.end || ''
      }" />
    </label>`;
  } else if (isEnd) {
    timeFields = `
    <label>Trip End
      <input type="datetime-local" name="end" value="${
        segment.start || ''
      }" />
    </label>`;
  } else {
    timeFields = `
    <label>Start
      <input type="datetime-local" name="start" value="${
        segment.start || ''
      }" />
    </label>
    <label>End
      <input type="datetime-local" name="end" value="${segment.end || ''}" />
    </label>
    <label>Duration (hours)
      <input type="number" step="0.25" name="duration" value="${
        segment.duration || ''
      }" />
    </label>`;
  }

  editor.innerHTML = `
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
    </div>
  `;

  card.appendChild(editor);

  /* ---------- Mapbox Search ---------- */
  const searchEl = editor.querySelector(`#searchbox-${id}`);
  if (searchEl) {
    try {
      searchEl.accessToken = mapboxgl.accessToken;
    } catch {}
    searchEl.addEventListener('retrieve', (ev) => {
      const f = ev.detail?.features?.[0];
      if (!f?.geometry) return;

      const updated = segments.find((x) => String(x.id) === String(id));
      if (!updated) return;

      updated.lat = f.geometry.coordinates[1];
      updated.lon = f.geometry.coordinates[0];
      updated.location_name =
        f.properties?.name ||
        f.properties?.place_formatted ||
        f.place_name ||
        '';

      // Auto-title if blank
      if (
        !updated.name ||
        updated.name.trim() === '' ||
        updated.name === '(untitled)'
      ) {
        updated.name = updated.location_name;
        editor.querySelector('input[name="name"]').value = updated.name;
      }

      //save();
    });
  }

  /* ---------- Submit ---------- */
  editor.addEventListener('submit', (submitEv) => {
    submitEv.preventDefault();

    const targetSegment = segment; // capture the trip event safely
    const formData = Object.fromEntries(new FormData(editor).entries());

    // Detect manual edits
    const prev = { ...targetSegment };
    const dur = formData.duration?.trim() ? Number(formData.duration) : null;

    if (formData.start && formData.start !== prev.start)
      targetSegment.manualStart = true;
    if (formData.end && formData.end !== prev.end)
      targetSegment.manualEnd = true;
    if (dur !== null && dur !== Number(prev.duration || 0))
      targetSegment.manualDuration = true;

    // Update fields
    targetSegment.name = formData.name || '';
    targetSegment.type = formData.type || 'stop';
    targetSegment.start = formData.start || '';
    targetSegment.end = formData.end || '';
    targetSegment.duration = dur ?? '';

    // Derive missing end if duration is set
    if (!targetSegment.end && targetSegment.start && dur !== null) {
      targetSegment.end = endFromDuration(targetSegment.start, dur);
    }

    // Mark edited drives properly
    if (targetSegment.type === 'drive' && targetSegment.autoDrive) {
      targetSegment.manualEdit = true;
      targetSegment.autoDrive = false;
    }

    card.classList.remove('editing');
    editor.remove();
    save();
    renderTimeline();
  });

  /* ---------- Cancel ---------- */
  editor.querySelector('.cancel').onclick = () => {
    card.classList.remove('editing');
    editor.remove();
  };
}
