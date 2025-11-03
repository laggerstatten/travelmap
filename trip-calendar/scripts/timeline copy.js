(function () {
  const S = window.TripCal;

  function dayStr(iso) {
    if (!iso) return '';
    return new Date(iso).toDateString();
  }

  function cardBadgeClass(e) {
    if (e.type !== 'drive') return '';
    if (e.autoDrive && !e.manualEdit) return 'auto';
    if (e.manualEdit) return 'edited';
    return 'manual';
  }

  function buildInlineEditor(e, card) {
    const editor = document.createElement('div');
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
        <button class="small save">Save</button>
        <button class="small cancel">Cancel</button>
      </div>
    `;

    // disable drag while editing
    card.setAttribute('draggable', 'false');

    editor.querySelector('.save').onclick = () => {
      const data = {
        name: editor.querySelector('[name="name"]').value.trim(),
        type: editor.querySelector('[name="type"]').value,
        start: editor.querySelector('[name="start"]').value,
        end: editor.querySelector('[name="end"]').value,
        duration: editor.querySelector('[name="duration"]').value
      };
      if (data.duration && data.start) {
        data.end = S.endFromDuration(data.start, data.duration);
      }
      if (e.type === 'drive' && e.autoDrive) {
        e.manualEdit = true;
        e.autoDrive = false;
      }
      Object.assign(e, data);
      card.removeAttribute('draggable');
      S.save();
    };
    
    // Cancel
    editor.querySelector('.cancel').onclick = () => {
      card.classList.remove('editing');
      card.removeAttribute('draggable');
      editor.remove();
    };

    return editor;
  }

  S.renderTimeline = function () {
    const cal = document.getElementById('calendar');
    cal.className = 'timeline';
    cal.innerHTML = '';
    S.sortByDateInPlace(S.events);

    let lastDay = '';
    S.events.forEach((e) => {
      const dStr = e.start ? dayStr(e.start) : '';
      if (dStr && dStr !== lastDay) {
        const div = document.createElement('div');
        div.className = 'day-divider';
        div.textContent = dStr;
        cal.appendChild(div);
        lastDay = dStr;
      }

      // rails + card container
      const wrapper = document.createElement('div');
      wrapper.className = 'rail-pair';

      const rails = document.createElement('div');
      rails.className = 'rails';
      rails.innerHTML = `
        <div class="insolation-rail"></div>
        <div class="weather-rail"></div>
      `;
      wrapper.appendChild(rails);

      const card = document.createElement('div');
      card.className = `event timeline-card ${
        e.type || 'stop'
      } ${cardBadgeClass(e)}`;
      card.dataset.id = e.id;
      card.innerHTML = `
        <div class="title">${e.name || '(untitled)'}</div>
        <div class="subtitle">${e.type || 'stop'}</div>
        <div class="meta">${
          e.start || e.end
            ? `${S.fmtDate(e.start)}${e.end ? ' → ' + S.fmtDate(e.end) : ''}`
            : 'No date set'
        }</div>
        <div class="card-footer">
          <button class="edit-btn">Edit</button>
          <button class="del-btn">Delete</button>
        </div>
      `;
      wrapper.appendChild(card);
      cal.appendChild(wrapper);

      // Button handlers
      card.querySelector('.edit-btn').onclick = (ev) => {
        ev.stopPropagation();
        if (card.classList.contains('editing')) return;
        card.classList.add('editing');
        const editor = buildInlineEditor(e, card);
        card.appendChild(editor);
      };

      card.querySelector('.del-btn').onclick = (ev) => {
        ev.stopPropagation();
        S.events = S.events.filter((x) => x.id !== e.id);
        S.save();
      };

      // Drag logic
      card.draggable = true;
      card.addEventListener('dragstart', (ev) => {
        if (card.classList.contains('editing')) {
          ev.preventDefault();
          return;
        }
        card.classList.add('dragging');
        ev.dataTransfer.effectAllowed = 'move';
        ev.dataTransfer.setData('text/plain', e.id);
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        reorderFromDOM(cal);
      });
    });

    cal.addEventListener('dragover', handleDragOver);
    cal.addEventListener('drop', (e) => e.preventDefault());
  };

  function handleDragOver(e) {
    e.preventDefault();
    const cal = e.currentTarget;
    const dragging = cal.querySelector('.event.dragging');
    if (!dragging) return;
    const after = getDragAfterElement(cal, e.clientY);
    if (!after) cal.appendChild(dragging);
    else cal.insertBefore(dragging, after);
  }

  function getDragAfterElement(container, y) {
    const cards = [
      ...container.querySelectorAll('.timeline-card:not(.dragging)')
    ];
    return cards.reduce(
      (closest, el) => {
        const box = el.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        return offset < 0 && offset > closest.offset
          ? { offset, element: el }
          : closest;
      },
      { offset: Number.NEGATIVE_INFINITY, element: null }
    ).element;
  }

  function reorderFromDOM(container) {
    const ids = [...container.querySelectorAll('.timeline-card')].map(
      (el) => el.dataset.id
    );
    S.events.sort(
      (a, b) => ids.indexOf(String(a.id)) - ids.indexOf(String(b.id))
    );
    S.save();
  }
})();
