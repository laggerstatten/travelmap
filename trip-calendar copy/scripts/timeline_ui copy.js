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
    const day = seg.start?.utc ? dayStr(seg.start.utc) : '';
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


function computeSlackAndOverlap(segments) {
  console.log("computeSlackAndOverlap");
  const slack = [];
  const overlaps = [];

  for (let i = 0; i < segments.length - 1; i++) {
    const cur = segments[i];
    const next = segments[i + 1];

    const curEnd = cur.end?.utc;
    const nextStart = next.start?.utc;
    if (!curEnd || !nextStart) continue; // skip incomplete

    const startDate = new Date(curEnd);
    const endDate = new Date(nextStart);
    const diffMin = (endDate - startDate) / 60000;

    if (diffMin > 0) {
      slack.push({
        type: "slack",
        a: cur.id,
        b: next.id,
        start: { utc: curEnd },
        end: { utc: nextStart },
        duration: { val: diffMin / 60 }, // hours
        minutes: diffMin,
      });
    } else if (diffMin < 0) {
      const overlapStart = nextStart;
      const overlapEnd = curEnd;
      const overlapMin = -diffMin;
      overlaps.push({
        type: "overlap",
        a: cur.id,
        b: next.id,
        start: { utc: overlapStart },
        end: { utc: overlapEnd },
        duration: { val: overlapMin / 60 },
        minutes: overlapMin,
      });
    }
  }

  return { slack, overlaps };
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