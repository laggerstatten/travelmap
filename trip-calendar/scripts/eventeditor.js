function buildInlineEditor(event, card) {
    // Prevent duplicates
    card.querySelector('.inline-editor') ?.remove();
    card.classList.add('editing');

    const editor = document.createElement('form');
    editor.className = 'inline-editor';

    const id = event.id;

    editor.innerHTML = `
    <label>Name
      <input name="name" value="${event.name || ''}" />
    </label>

    <label>Type
      <select name="type">
        ${['trip_start','stop', 'drive', 'lodging', 'break','trip_end']
      .map(t => `<option value="${t}" ${event.type === t ? 'selected' : ''}>${t[0].toUpperCase() + t.slice(1)}</option>`)
      .join('')}
      </select>
    </label>

    <label>Location
      <mapbox-search-box id="searchbox-${id}" value="${event.location_name || ''}"></mapbox-search-box>
    </label>

    <label>Start
      <input type="datetime-local" name="start" value="${event.start || ''}" />
    </label>

    <label>End
      <input type="datetime-local" name="end" value="${event.end || ''}" />
    </label>

    <label>Duration (hours)
      <input type="number" step="0.25" name="duration" value="${event.duration || ''}" />
    </label>

    <div class="hint">Enter duration to auto-calc end; otherwise set end explicitly.</div>

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
  editor.addEventListener('submit', ev => {
    ev.preventDefault();
    const formData = Object.fromEntries(new FormData(editor).entries());

    if (formData.duration && formData.start) {
      formData.end = endFromDuration(formData.start, formData.duration);
    }

    const e = events.find(x => String(x.id) === String(id));
    if (!e) return;

    // Convert numeric fields
    if (formData.duration) formData.duration = parseFloat(formData.duration);

    // Flip drive badge if an auto-drive gets edited
    if (e.type === 'drive' && e.autoDrive) {
      e.manualEdit = true;
      e.autoDrive = false;
    }

    Object.assign(e, formData);
    save();
    renderTimeline();
  });

  /* ---------- Cancel ---------- */
  editor.querySelector('.cancel').onclick = () => {
    card.classList.remove('editing');
    editor.remove();
  };
}