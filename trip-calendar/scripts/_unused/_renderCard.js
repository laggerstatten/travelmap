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
  if (!seg.type === 'stop') card.classList.add('constrained');

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
      title = segLabel(seg, segments);
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
      const hours =
        seg.duration?.val?.toFixed(2) ?? (seg.minutes / 60).toFixed(2);
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
      const hours =
        seg.duration?.val?.toFixed(2) ?? (seg.minutes / 60).toFixed(2);
      const startStr = fmtDate(seg.start?.utc, seg.overlapInfo.tz);
      const endStr = fmtDate(seg.end?.utc, seg.overlapInfo.tz);

      const leftTxt = seg.overlapInfo.leftAnchor
        ? `${seg.overlapInfo.leftAnchor.seg.name || '(unnamed)'} • ${
            seg.overlapInfo.leftAnchor.kind
          } ${lockIcons(seg.overlapInfo.leftAnchor.field)}`
        : '—';
      const rightTxt = seg.overlapInfo.rightAnchor
        ? `${seg.overlapInfo.rightAnchor.seg.name || '(unnamed)'} • ${
            seg.overlapInfo.rightAnchor.kind
          } ${lockIcons(seg.overlapInfo.rightAnchor.field)}`
        : '—';

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

  // --- Overlap indicators ---
  if (Array.isArray(seg.overlapEmitters) && seg.overlapEmitters.length > 0) {
    //console.log('indicators');
    const indicator = document.createElement('div');
    indicator.className = 'overlap-indicator';

    // Summarize emitters (for banner text)
    const details = seg.overlapEmitters
      .map((e) => {
        const mins = e.overlapMinutes?.toFixed?.(0) ?? '?';
        const hrs = (e.overlapMinutes / 60).toFixed(2);
        return `${e.role} (${mins} min / ${hrs} h via ${e.affectedField})`;
      })
      .join(', ');

    // Build base structure
    indicator.innerHTML = `
      <div class="overlap-banner">
        ⚠️ Overlap contributor<br>
        <small>${details}</small>
      </div>
      <div class="overlap-actions"></div>
    `;

    const actionsDiv = indicator.querySelector('.overlap-actions');

    // Collect all dynamic options based on each emitter
    const allOptions = [
      ...seg.overlapEmitters.flatMap((e) =>
        getOverlapResolutionOptions(seg, e.role)
      ),
      ...getUnlockAndQueueOptions(seg)
    ];

    // Render buttons dynamically
    allOptions.forEach((opt) => {
      const btn = document.createElement('button');
      btn.textContent = opt.label;
      btn.classList.add('resolve-btn', `resolve-${opt.action}`);

      if (opt.feasibility === 'unlock') btn.classList.add('needs-unlock');
      btn.addEventListener('click', () => resolveOverlapAction(seg, opt));
      actionsDiv.appendChild(btn);
    });

    card.appendChild(indicator);
  }

  if (seg.openEditor && !card.querySelector('.oncard-editor'))
    buildOnCardEditor(seg, card);
  return card;
}
