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
      break;

    case 'drive':
      // ───────────────────────────────
      // Drive
      // ───────────────────────────────
      const origin = segments.find((s) => s.id === seg.originId);
      const dest = segments.find((s) => s.id === seg.destinationId);
      const startStr = showDate(seg.start?.utc, origin?.timeZone);
      const endStr = showDate(seg.end?.utc, dest?.timeZone);
      title = `Drive: ${origin?.name || '?'} → ${dest?.name || '?'}`;
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
      const label = type === 'slack' ? 'Gap' : 'Conflict';
      const hours =
        seg.duration?.val?.toFixed(2) ?? (seg.minutes / 60).toFixed(2);

      // Find the preceding segment in the list (the one before this slack/overlap)
      const idx = segments.findIndex((s) => s.id === seg.id);
      const prev = idx > 0 ? segments[idx - 1] : null;
      const tz = prev?.timeZone || seg.timeZone;

      const startStr = fmtDate(seg.start?.utc, tz);
      const endStr = fmtDate(seg.end?.utc, tz);

      card.innerHTML = `
        <div class="title">${
          type === 'slack' ? 'Slack' : 'Overlap'
        } (${hours}h)</div>
        <div class="subtitle">${label} between ${seg.a} → ${seg.b}</div>
        <div class="meta">${startStr}<br>${endStr}</div>
      `;
      break;
      }

    case 'overlap': {
      const idx = segments.findIndex(s => s.id === seg.id);
      const left  = findNearestEmitterLeft(idx, segments);
      const right = findNearestEmitterRight(idx, segments);

      const tz = (left?.seg?.timeZone) || (right?.seg?.timeZone) || seg.timeZone;
      const hours = seg.duration?.val?.toFixed(2) ?? (seg.minutes / 60).toFixed(2);

      const startStr = fmtDate(seg.start?.utc, tz);
      const endStr   = fmtDate(seg.end?.utc, tz);

      const leftTxt  = left  ? `${left.seg.name || '(unnamed)'} • ${left.kind} ${lockIcons(left.field)}` : '—';
      const rightTxt = right ? `${right.seg.name || '(unnamed)'} • ${right.kind} ${lockIcons(right.field)}`: '—';

      card.innerHTML = `
        <div class="title">Overlap (${hours}h)</div>
        <div class="subtitle">Conflict between ${seg.a} ↔ ${seg.b}</div>
        <div class="meta">${startStr}<br>${endStr}</div>
        <div class="details">
          <div><strong>Left anchor:</strong> ${leftTxt}</div>
          <div><strong>Right anchor:</strong> ${rightTxt}</div>
        </div>
        <div class="card-footer"></div>
      `;
      break;
    }

  }

  if (!card.classList.contains('constrained')) attachCardDragHandlers(card);
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





function boundaryLocked(f) { return !!(f && f.lock && f.lock !== 'unlocked'); }
function isEmitter(f, dir) {
  if (!boundaryLocked(f)) return false;
  return dir === 'forward' ? !!f.emitsForward : !!f.emitsBackward;
}

function findNearestEmitterLeft(idx, segments) {
  for (let i = idx - 1; i >= 0; i--) {
    const s = segments[i];
    if (isEmitter(s.end, 'forward'))     return { seg: s, kind: 'end',   field: s.end };
    if (isEmitter(s.start, 'forward'))   return { seg: s, kind: 'start', field: s.start };
    if (isEmitter(s.duration, 'forward'))return { seg: s, kind: 'duration', field: s.duration };
  }
  return null;
}

function findNearestEmitterRight(idx, segments) {
  for (let i = idx + 1; i < segments.length; i++) {
    const s = segments[i];
    if (isEmitter(s.start, 'backward'))    return { seg: s, kind: 'start', field: s.start };
    if (isEmitter(s.end, 'backward'))      return { seg: s, kind: 'end',   field: s.end };
    if (isEmitter(s.duration, 'backward')) return { seg: s, kind: 'duration', field: s.duration };
  }
  return null;
}





