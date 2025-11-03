const S = window.TripCal;
const calendar = document.getElementById('calendar');

S.renderTimeline = function () {
  calendar.className = 'timeline';
  calendar.innerHTML = '';

  // sort by date
  const withDate = S.events.filter((e) => S.parseDate(e.start));
  const noDate = S.events.filter((e) => !S.parseDate(e.start));
  withDate.sort((a, b) => S.parseDate(a.start) - S.parseDate(b.start));
  const allEvents = [...withDate, ...noDate];

  let lastDay = '';
  allEvents.forEach((e) => {
    const d = S.parseDate(e.start);
    const day = d ? d.toDateString() : '';
    if (day && day !== lastDay) {
      const divider = document.createElement('div');
      divider.className = 'day-divider';
      divider.textContent = day;
      calendar.appendChild(divider);
      lastDay = day;
    }

    const card = document.createElement('div');
    card.className = `event timeline-card ${e.type || 'stop'}`;
    card.dataset.id = e.id;

    const dateLine =
      e.start || e.end
        ? `${S.fmtDate(e.start)}${e.end ? ' → ' + S.fmtDate(e.end) : ''}`
        : 'No date set';

    card.innerHTML = `
      <div class="rails">
        <div class="insolation-rail"></div>
        <div class="weather-rail"></div>
      </div>
      <div class="details">
        <strong>${e.name || '(untitled)'}</strong>
        <div class="subtitle">
          ${e.type || 'stop'}${e.location_name ? ' • ' + e.location_name : ''}
        </div>
        <div class="meta">${dateLine}</div>
      </div>
      <div class="tools">
        <button class="edit-btn">✏️</button>
        <button class="del-btn">🗑️</button>
      </div>
    `;

    card.querySelector('.edit-btn').onclick = (ev) => {
      ev.stopPropagation();
      openEditor(e, card);
    };

    card.querySelector('.del-btn').onclick = (ev) => {
      ev.stopPropagation();
      S.events = S.events.filter((x) => x.id !== e.id);
      S.save();
    };

    calendar.appendChild(card);
  });
};

/* ---------- Inline Editor ---------- */
function openEditor(e, card) {
  card.classList.add('editing');
  card.setAttribute('draggable', 'false');
  card.querySelector('.inline-editor')?.remove();

  const form = document.createElement('form');
  form.className = 'inline-editor';
  form.innerHTML = `
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
    <div class="actions">
      <button type="submit" class="small save">Save</button>
      <button type="button" class="small cancel">Cancel</button>
    </div>
  `;

  card.appendChild(form);

  // initialize mapbox searchbox
  const searchEl = form.querySelector(`#searchbox-${e.id}`);
  if (searchEl) {
    searchEl.accessToken = mapboxgl.accessToken;
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
      }
    });
  }

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    if (data.duration && data.start) {
      data.end = S.endFromDuration(data.start, data.duration);
      if (e.type === 'drive' && e.autoDrive) {
        e.manualEdit = true;
        e.autoDrive = false;
      }
    }
    Object.assign(e, data);
    card.classList.remove('editing');
    card.removeAttribute('draggable');
    form.remove();
    S.save();
  });

  form.querySelector('.cancel').onclick = () => {
    card.classList.remove('editing');
    card.removeAttribute('draggable');
    form.remove();
  };
}

/* ---------- Toolbar ---------- */
document.getElementById('mode-timeline').onclick = () => S.renderTimeline();
document.getElementById('mode-week').onclick = () => S.renderWeek();
document.getElementById('add-event').onclick = () => {
  const e = { id: Date.now(), name: '', type: 'stop' };
  S.events.push(e);
  S.save();
  S.renderTimeline();
};
