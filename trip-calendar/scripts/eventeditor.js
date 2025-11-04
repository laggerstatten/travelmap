function buildInlineEditor(event, card) {
    // Prevent duplicates
    card.querySelector('.inline-editor') ?.remove();
    card.classList.add('editing');

    const editor = document.createElement('form');
    editor.className = 'inline-editor';

    const id = event.id;
    const isStart = event.type === "trip_start";
    const isEnd = event.type === "trip_end";

    let timeFields = "";
    if (isStart) {
        timeFields = `
    <label>Trip Start
      <input type="datetime-local" name="start" step="300" value="${event.end || ''}" />
    </label>`;
    } else if (isEnd) {
        timeFields = `
    <label>Trip End
      <input type="datetime-local" name="end" step="300" value="${event.start || ''}" />
    </label>`;
    } else {
        timeFields = `
    <label>Start
      <input type="datetime-local" name="start" step="300" value="${event.start || ''}" />
    </label>
    <label>End
      <input type="datetime-local" name="end" step="300" value="${event.end || ''}" />
    </label>
    <label>Duration (hours)
      <input type="number" step="0.25" name="duration" value="${event.duration || ''}" />
    </label>`;
    }


    editor.innerHTML = `
    <label>Name
      <input name="name" value="${event.name || ''}" />
    </label>
    <label>Type
      <select name="type">
        ${['trip_start', 'stop', 'drive', 'lodging', 'break', 'trip_end']
      .map(t => `<option value="${t}" ${event.type === t ? 'selected' : ''}>${t[0].toUpperCase() + t.slice(1)}</option>`)
      .join('')}
      </select>
    </label>
    <label>Location
      <mapbox-search-box id="searchbox-${id}" value="${event.location_name || ''}"></mapbox-search-box>
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
    try { searchEl.accessToken = mapboxgl.accessToken; } catch { }
    searchEl.addEventListener('retrieve', ev => {
      const f = ev.detail?.features?.[0];
      if (!f?.geometry) return;

      const updated = events.find(x => String(x.id) === String(id));
      if (!updated) return;

      updated.lat = f.geometry.coordinates[1];
      updated.lon = f.geometry.coordinates[0];
      updated.location_name =
        f.properties?.name ||
        f.properties?.place_formatted ||
        f.place_name || '';

      // Auto-title if blank
      if (!updated.name || updated.name.trim() === '' || updated.name === '(untitled)') {
        updated.name = updated.location_name;
        editor.querySelector('input[name="name"]').value = updated.name;
      }

      //save();
    });
  }

  /* ---------- Submit ---------- */
  editor.addEventListener('submit', submitEv => {
    submitEv.preventDefault();

    const targetEvent = event; // capture the trip event safely
    const formData = Object.fromEntries(new FormData(editor).entries());

    // Detect manual edits
    const prev = { ...targetEvent };
    const dur = formData.duration?.trim() ? Number(formData.duration) : null;

    if (formData.start && formData.start !== prev.start) targetEvent.manualStart = true;
    if (formData.end && formData.end !== prev.end) targetEvent.manualEnd = true;
    if (dur !== null && dur !== Number(prev.duration || 0)) targetEvent.manualDuration = true;

    // Update fields
    targetEvent.name = formData.name || '';
    targetEvent.type = formData.type || 'stop';
    targetEvent.start = formData.start || '';
    targetEvent.end = formData.end || '';
    targetEvent.duration = dur ?? '';

    // Derive missing end if duration is set
    if (!targetEvent.end && targetEvent.start && dur !== null) {
      targetEvent.end = endFromDuration(targetEvent.start, dur);
    }

    // Mark edited drives properly
    if (targetEvent.type === 'drive' && targetEvent.autoDrive) {
      targetEvent.manualEdit = true;
      targetEvent.autoDrive = false;
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