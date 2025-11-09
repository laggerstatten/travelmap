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
  return form;
}

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

function createTimeField(label, name, value, lockField, timeElement) {
  return `
  <label class="time-field">
    <span>${label}</span>
    <div class="time-row">
      <input type="datetime-local" name="${name}" step="900" value="${value}" />
      ${lockButtonHTML(lockField, timeElement)}
      ${clearButtonHTML(name)}
    </div>
  </label>`;
}














