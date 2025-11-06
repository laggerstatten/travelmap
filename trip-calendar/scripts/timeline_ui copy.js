/* ===============================
   Timeline Rendering & Interaction
   =============================== */

// --- Main render ---
function renderTimeline() {
    const cal = document.getElementById('calendar');
    cal.className = 'timeline';
    cal.innerHTML = '';

    let lastDay = '';

    for (const seg of segments) {
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
    }

    cal.addEventListener('dragover', handleDragOver);
    cal.addEventListener('drop', e => e.preventDefault());
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