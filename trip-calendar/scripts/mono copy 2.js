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
    timeFields = `<label>Trip Start
        <input type="datetime-local" name="end" value="${localEnd}" />
        ${lockButtonHTML('end.lock', seg.end)}
        ${clearButtonHTML('end')}
      </label>`;
  }

  if (seg.type === 'trip_end') {
    timeFields = `<label>Trip End
        <input type="datetime-local" name="start" value="${localStart}" />
        ${lockButtonHTML('start.lock', seg.start)}
        ${clearButtonHTML('start')}
      </label>`;
  }

  if (seg.type === 'stop') {
    timeFields = `<label>Start
        <input type="datetime-local" name="start" value="${localStart}" />
        ${lockButtonHTML('start.lock', seg.start)}
        ${clearButtonHTML('start')}
      </label>
      <label>End
        <input type="datetime-local" name="end" value="${localEnd}" />
        ${lockButtonHTML('end.lock', seg.end)}
        ${clearButtonHTML('end')}
      </label>
      <label>Duration (hours)
        <input type="number" step="0.25" name="duration" value="${seg.duration?.val ?? ''
      }" />
        ${lockButtonHTML('duration.lock', seg.duration)}
        ${clearButtonHTML('duration')}
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
  const lock = timeelement.lock || '';
  const icon = lock === 'hard' ? '🔒' : lock === 'soft' ? '🟡' : '🔓';
  const title =
    lock === 'hard'
      ? 'Hard locked — click to unlock'
      : lock === 'soft'
        ? 'Soft locked (derived)'
        : 'Unlocked — click to hard lock';
  const disabled = lock === 'soft' ? 'disabled' : '';
  return `<button type="button" class="lock-toggle" data-field="${field}" ${disabled} title="${title}">${icon}</button>`;
}

function clearButtonHTML(field) {
  return `<button type="button" class="clear-field" data-field="${field}" title="Clear this field">🗑️</button>`;
}

