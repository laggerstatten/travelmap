function buildInlineEditor(e, card) {
  // Prevent duplicates
  card.querySelector('.inline-editor')?.remove();

  card.classList.add('editing');

  const editor = document.createElement('form');
  editor.className = 'inline-editor';
  editor.innerHTML = `
    <label>Name
      <input name="name" value="${e.name || ''}" />
    </label>
    <label>Type
      <select name="type">
        <option value="stop" ${
          e.type === 'stop' ? 'selected' : ''
        }>Stop</option>
        <option value="drive" ${
          e.type === 'drive' ? 'selected' : ''
        }>Drive</option>
        <option value="lodging" ${
          e.type === 'lodging' ? 'selected' : ''
        }>Lodging</option>
        <option value="break" ${
          e.type === 'break' ? 'selected' : ''
        }>Break</option>
      </select>
    </label>

    <label>Location
      <mapbox-search-box id="searchbox-${e.id}" value="${
    e.location_name || ''
  }"></mapbox-search-box>
    </label>

    <label>Start
      <input type="datetime-local" name="start" value="${e.start || ''}" />
    </label>
    <label>End
      <input type="datetime-local" name="end" value="${e.end || ''}" />
    </label>
    <label>Duration (hours)
      <input type="number" step="0.25" name="duration" value="${
        e.duration || ''
      }" />
    </label>
    <div class="hint">Enter duration to auto-calc end; otherwise set end explicitly.</div>
    <div class="actions">
      <button type="submit" class="small save">Save</button>
      <button type="button" class="small cancel">Cancel</button>
    </div>
  `;

  card.appendChild(editor);

  // --- Mapbox SearchBox (custom element) ---
  // Works with v2.x web.js. Avoids 401 "missing access_token".
  const searchEl = editor.querySelector(`#searchbox-${e.id}`);
  if (searchEl) {
    // global backup already set in index.html; set per-element to be safe:
    try {
      searchEl.accessToken = mapboxgl.accessToken;
    } catch {}
    searchEl.addEventListener('retrieve', (ev) => {
      const f = ev.detail?.features?.[0];
      if (f?.geometry) {
        e.lat = f.geometry.coordinates[1];
        e.lon = f.geometry.coordinates[0];
        e.location_name =
          f.properties?.name ||
          f.properties?.place_formatted ||
          f.place_name ||
          '';

        // if untitled, use the searched name
        if (!e.name || e.name.trim() === '' || e.name === '(untitled)') {
          e.name = e.location_name;
          const nameInput = editor.querySelector('input[name="name"]');
          if (nameInput) nameInput.value = e.name;
        }
      }
    });
  }

  // Submit
  editor.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const data = Object.fromEntries(new FormData(editor).entries());

    if (data.duration && data.start) {
      data.end = endFromDuration(data.start, data.duration);
    }

    // Flip drive badge if an auto drive gets edited
    if (e.type === 'drive' && e.autoDrive) {
      e.manualEdit = true;
      e.autoDrive = false;
    }
    Object.assign(e, data);
    card.removeAttribute('draggable');
    card.classList.remove('editing');
    editor.remove();
    save();
  });

  // Cancel
  editor.querySelector('.cancel').onclick = () => {
    card.classList.remove('editing');
    editor.remove();
  };
}



/* ---------- Sorting (keep undated in place) ---------- */
function sortByDateInPlace(list) {
    const dated = list.filter((e) => parseDate(e.start));
    dated.sort((a, b) => parseDate(a.start) - parseDate(b.start));

    const merged = [];
    let di = 0;
    for (const e of list) {
        if (!parseDate(e.start)) merged.push(e);
        else merged.push(dated[di++]);
    }
    list.splice(0, list.length, ...merged);
};
