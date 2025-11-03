function renderTimeline() {
    const cal = document.getElementById('calendar');
    cal.className = 'timeline';
    cal.innerHTML = '';
    sortByDateInPlace(events);

    let lastDay = '';
    events.forEach((e) => {
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
                card.className = `event timeline-card ${e.type || 'stop'} ${cardBadgeClass(
      e
    )}`;
                card.dataset.id = e.id;
                card.innerHTML = `
  <div class="title">${e.name || '(untitled)'}</div>
  <div class="subtitle">
    ${e.type || 'stop'}
    ${e.location_name ? ' • ' + e.location_name : ''}
    ${e.lat && e.lon ? `<span class="coord-pill">📍</span>` : ''}
    ${e.nextDistanceKm
        ? `<div class="drive-info">🚗 ${e.nextDistanceKm} km • ${e.nextDurationMin} min</div>`
        : ''
      }
    ${e.type === 'drive' && e.distanceKm
        ? `<div class="drive-info">🚗 ${e.distanceKm} km • ${e.durationMin} min</div>`
        : ''
      }


  </div>
  <div class="meta">${e.start || e.end
        ? `${fmtDate(e.start)}${e.end ? ' → ' + fmtDate(e.end) : ''}`
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
      //card.appendChild(editor);
    };

    card.querySelector('.del-btn').onclick = (ev) => {
      ev.stopPropagation();
      events = events.filter((x) => x.id !== e.id);
      save();
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
}

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
  events.sort((a, b) => ids.indexOf(String(a.id)) - ids.indexOf(String(b.id)));
  save();
}


function cardBadgeClass(e) {
    if (e.type !== 'drive') return '';
    if (e.autoDrive && !e.manualEdit) return 'auto';
    if (e.manualEdit) return 'edited';
    return 'manual';
}