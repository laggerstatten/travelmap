/* ===============================
   Timeline Rendering & Interaction
   =============================== */

// --- Main render ---
function renderTimeline(segments) {
  const cal = document.getElementById('calendar');
  cal.className = 'timeline';
  cal.innerHTML = '';

  let lastDay = '';
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const day = seg.start?.utc ? dayStr(seg.start.utc) : '';
    if (day && day !== lastDay) {
      cal.appendChild(renderDayDivider(day));
      lastDay = day;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'rail-pair';
    wrapper.appendChild(renderRails());
    wrapper.appendChild(renderCard(seg, segments));
    cal.appendChild(wrapper);
  }

  cal.addEventListener('dragover', handleDragOver);
  cal.addEventListener('drop', (e) => e.preventDefault());
}

// --- Build decorative rails ---
function renderRails() {
  const rails = document.createElement('div');
  rails.className = 'rails';
  rails.innerHTML = `
    <div class="insolation-rail"></div>
    <div class="weather-rail"></div>`;
  return rails;
}

// --- Build a card ---
function renderCard(seg, segments) {
  const card = document.createElement('div');
  const type = seg.type || 'stop';
  card.className = `segment timeline-card ${type} ${cardBadgeClass(seg)}`;
  card.dataset.id = seg.id;

  // add constrained attribute
  const lockedCount = ['start', 'end', 'duration']
    .map((k) => seg[k]?.lock === 'hard')
    .filter(Boolean).length;
  if (lockedCount >= 2) card.classList.add('constrained');
  if (!seg.type === 'stop')
    card.classList.add('constrained');

  let title = seg.name || '(untitled)';
  let meta = '';
  let buttons = [];

  const showDate = (utc, tz) => (utc ? fmtDate(utc, tz) : '');

  switch (type) {
    // ───────────────────────────────
    // Trip start
    // ───────────────────────────────
    case 'trip_start':
      meta = `  ${showDate(seg.end?.utc, seg.timeZone)} ${lockIcons(seg.end)}`;

      card.innerHTML = `
        <div class="title">${title}</div>
        <div class="subtitle">
        Trip Start${seg.name ? ' • ' + seg.name : ''}
        </div>
        <div class="meta">${meta || 'No date set'}</div>
        <div class="card-footer"></div>`;
      buttons = [
        {
          cls: 'fill-forward-btn',
          label: '⏩ Fill Forward',
          onClick: () => {
            fillForward(seg);
            renderTimeline(syncGlobal());
          }
        }
      ];
      break;

    case 'trip_end':
      // ───────────────────────────────
      // Trip end
      // ───────────────────────────────
      meta = `  ${showDate(seg.start?.utc, seg.timeZone)} ${lockIcons(
        seg.start
      )}`;
      card.innerHTML = `
        <div class="title">${title}</div>
        <div class="subtitle">
        Trip End${seg.name ? ' • ' + seg.name : ''}
        </div>
        <div class="meta">${meta || 'No date set'}</div>
        <div class="card-footer"></div>`;
      buttons = [
        {
          cls: 'fill-backward-btn',
          label: '⏪ Fill Backward',
          onClick: () => {
            fillBackward(seg);
            renderTimeline(syncGlobal());
          }
        }
      ];
      break;

    case 'stop':
      // ───────────────────────────────
      // Stop
      // ───────────────────────────────
      let durTextHr = seg.duration.val
        ? formatDurationHr(seg.duration.val)
        : '';
      meta = `
      ${showDate(seg.start?.utc, seg.timeZone)} ${lockIcons(seg.start)}<br>
      ${durTextHr} ${lockIcons(seg.duration)}<br>
      ${showDate(seg.end?.utc, seg.timeZone)} ${lockIcons(seg.end)}
    `;
      card.innerHTML = `
        <div class="title">${title}</div>
        <div class="subtitle">
        ${type}${seg.name ? ' • ' + seg.name : ''}
        </div>
        <div class="meta">${meta}</div>
        <div class="card-footer"></div>`;
      if (seg.isQueued) {
        buttons = [
          {
            cls: 'insert-btn',
            label: 'Insert into Route',
            onClick: () => insertQueuedSegment(seg, card)
          }
        ];
      } else {
        buttons = [
          {
            cls: 'fill-forward-btn',
            label: '⏩ Fill Forward',
            onClick: () => {
              fillForward(seg);
              renderTimeline(syncGlobal());
            }
          },
          {
            cls: 'fill-backward-btn',
            label: '⏪ Fill Backward',
            onClick: () => {
              fillBackward(seg);
              renderTimeline(syncGlobal());
            }
          }
        ];
      }

      if (!card.classList.contains('constrained')) attachCardDragHandlers(card);

      break;

    case 'drive':
      // ───────────────────────────────
      // Drive
      // ───────────────────────────────
      const startStr = showDate(seg.start?.utc, seg.originTz);
      const endStr = showDate(seg.end?.utc, seg.destinationTz);      
      title = segLabel(seg, segments)
      let durText = seg.durationMin ? formatDurationMin(seg.durationMin) : '';
      meta = `${startStr}<br>${seg.distanceMi} mi • ${durText}<br>${endStr}`;
      card.innerHTML = `
        <div class="title">${title}</div>
        <div class="subtitle">
        Drive${seg.name ? ' • ' + seg.name : ''}
        </div>
        <div class="meta">${meta}</div>
        <div class="card-footer"></div>`;
      break;

    case 'slack': {
      const hours = seg.duration?.val?.toFixed(2) ?? (seg.minutes / 60).toFixed(2);
      const startStr = fmtDate(seg.start?.utc, seg.slackInfo.tz);
      const endStr = fmtDate(seg.end?.utc, seg.slackInfo.tz);

      card.innerHTML = `
        <div class="title">Slack (${hours}h)</div>
        <div class="subtitle">Gap between ${seg.slackInfo.aLabel} → ${seg.slackInfo.bLabel}</div>
        <div class="meta">${startStr}<br>${endStr}</div>
      `;
      break;
    }

    case 'overlap': {
      const hours = seg.duration?.val?.toFixed(2) ?? (seg.minutes / 60).toFixed(2);
      const startStr = fmtDate(seg.start?.utc, seg.overlapInfo.tz);
      const endStr   = fmtDate(seg.end?.utc, seg.overlapInfo.tz);

      const leftTxt  = seg.overlapInfo.leftAnchor  ? `${seg.overlapInfo.leftAnchor.seg.name || '(unnamed)'} • ${seg.overlapInfo.leftAnchor.kind} ${lockIcons(seg.overlapInfo.leftAnchor.field)}` : '—';
      const rightTxt = seg.overlapInfo.rightAnchor ? `${seg.overlapInfo.rightAnchor.seg.name || '(unnamed)'} • ${seg.overlapInfo.rightAnchor.kind} ${lockIcons(seg.overlapInfo.rightAnchor.field)}`: '—';

      card.innerHTML = `
        <div class="title">Overlap (${hours}h)</div>
        <div class="subtitle">Conflict between ${seg.overlapInfo.aLabel} ↔ ${seg.overlapInfo.bLabel}</div>
        <div class="meta">${startStr}<br>${endStr}</div>
        <div class="details">
          <div><strong>Left anchor:</strong> ${leftTxt}</div>
          <div><strong>Right anchor:</strong> ${rightTxt}</div>
        </div>
      `;
      break;
    }

  }

  if (card.querySelector('.card-footer')) {
    attachButtons(card, buildFooter(seg, buttons));
  }

  if (seg.openEditor && !card.querySelector('.oncard-editor'))
    buildOnCardEditor(seg, card);
  return card;
}

function cardBadgeClass(seg) {
  if (seg.type !== 'drive') return '';
  if (seg.autoDrive && !seg.manualEdit) return 'auto';
  if (seg.manualEdit) return 'edited';
  return 'manual';
}

// --- Build single day divider ---
function renderDayDivider(day) {
  const div = document.createElement('div');
  div.className = 'day-divider';
  div.textContent = day;
  return div;
}

function buildFooter(seg, buttons) {
  const base = [
    { cls: 'edit-btn', label: 'Edit', onClick: (c) => editSegment(seg, c) },
    {
      cls: 'del-btn',
      label: 'Delete',
      onClick: (c) => {
        deleteSegment(seg, c);
        renderTimeline(syncGlobal());
      }
    }
  ];
  return [...buttons, ...base];
}

function attachButtons(card, buttons) {
  let footer = card.querySelector('.card-footer');

  footer.innerHTML = buttons
    .map((b) => `<button class="${b.cls}">${b.label}</button>`)
    .join('');

  buttons.forEach((b) => {
    const btn = card.querySelector(`.${b.cls}`);
    if (btn) btn.onclick = () => b.onClick(card);
  });
}

function lockIcons(field) {
  if (!field) return '';
  const { lock, emitsBackward, emitsForward } = field;

  let faIcon;
  if (lock === 'hard') faIcon = 'fa-lock';
  else if (lock === 'soft') faIcon = 'fa-gear';
  else faIcon = 'fa-unlock';

  const up = emitsBackward ? '<i class="fa-solid fa-arrow-up"></i>' : '';
  const down = emitsForward ? '<i class="fa-solid fa-arrow-down"></i>' : '';

  return `<span class="lock-icons">
    <i class="fa-solid ${faIcon}"></i>${up}${down}
  </span>`;
}

function segLabel(seg, segments) {
  if (!seg) return '(unknown)';
  if (seg.name) return seg.name;
  if (seg.type === 'drive') {
    const origin = segments.find(s => s.id === seg.originId);
    const dest   = segments.find(s => s.id === seg.destinationId);
    return `Drive: ${origin?.name || '?'} → ${dest?.name || '?'}`;
  }
  return seg.id;
}
