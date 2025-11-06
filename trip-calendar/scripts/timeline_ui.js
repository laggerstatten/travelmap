/* ===============================
   Timeline Rendering & Interaction
   =============================== */

// --- Main render ---
function renderTimeline() {
  const cal = document.getElementById('calendar');
  cal.className = 'timeline';
  cal.innerHTML = '';

  let lastDay = '';
  const { slack, overlaps } = computeSlackAndOverlap(segments);

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const day = seg.start ? dayStr(seg.start) : '';
    if (day && day !== lastDay) {
      cal.appendChild(renderDayDivider(day));
      lastDay = day;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'rail-pair';
    wrapper.appendChild(renderRails());
    wrapper.appendChild(renderCard(seg));
    cal.appendChild(wrapper);

    // Draw connectors after each non-last event
    const next = segments[i + 1];
    if (next) {
      const slackConn = slack.find(s => s.a.id === seg.id && s.b.id === next.id);
      const overlapConn = overlaps.find(o => o.a.id === seg.id && o.b.id === next.id);
      if (slackConn) cal.appendChild(renderConnector('slack', slackConn.minutes));
      if (overlapConn) cal.appendChild(renderConnector('overlap', overlapConn.minutes));
    }
  }

  cal.addEventListener('dragover', handleDragOver);
  cal.addEventListener('drop', seg => seg.preventDefault());
}

// --- Build single day divider ---
function renderDayDivider(day) {
  const div = document.createElement('div');
  div.className = 'day-divider';
  div.textContent = day;
  return div;
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