function renderWeek() {
    const cal = document.getElementById("calendar");
    cal.className = "week";
    cal.innerHTML = "";

    /* ---------- Header ---------- */
    const header = document.createElement("div");
    header.className = "week-header";
    header.appendChild(document.createElement("div")); // empty time col

    const ref =
        events.find((e) => parseDate(e.start)) ?.start ||
        new Date().toISOString();
    const weekStart = getWeekStart(new Date(ref));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        const div = document.createElement("div");
        div.textContent = `${DAYS[d.getDay()]} ${d.getMonth() + 1}/${d.getDate()}`;
        header.appendChild(div);
    }
    cal.appendChild(header);

    /* ---------- Body ---------- */
    const body = document.createElement("div");
    body.className = "week-body";
    cal.appendChild(body);

    // Show only 6 AM → 10 PM
    const startHour = 6;
    const endHour = 22;

    for (let h = startHour; h <= endHour; h++) {
        const t = document.createElement("div");
        t.className = "time-cell";
        t.textContent =
            h === 0 ?
            "12 AM" :
            h < 12 ?
            `${h} AM` :
            h === 12 ?
            "12 PM" :
            `${h - 12} PM`;
        body.appendChild(t);

        for (let i = 0; i < 7; i++) {
            const cell = document.createElement("div");
            cell.className = "day-col";
            cell.dataset.day = i;
            body.appendChild(cell);
        }
    }

    /* ---------- Events ---------- */
    const pxPerMin =
        parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue("--hour-row")
        ) / 60 || 56 / 60;

    events.forEach((e) => {
        const start = parseDate(e.start);
        if (!start) return;
        const end = parseDate(e.end) || new Date(start.getTime() + 3600000);
        if (start < weekStart || start >= weekEnd) return;

        const dayIdx = start.getDay();
        const top = (minsSinceMidnight(start) - startHour * 60) * pxPerMin;
        const height = Math.max(
            30,
            (minsSinceMidnight(end) - minsSinceMidnight(start)) * pxPerMin
        );

        const eventEl = document.createElement("div");
        eventEl.className = `week-event ${e.type || "stop"}`;
        eventEl.style.position = "absolute";
        eventEl.style.top = `${top}px`;
        eventEl.style.height = `${height}px`;
        eventEl.style.left = `calc(${(dayIdx + 1) * (100 / 8)}%)`;
        eventEl.style.width = `calc(${100 / 8}% - 8px)`;

        eventEl.innerHTML = `
        <div class="title">${e.name || "(untitled)"}</div>
        <div class="time">${fmtDate(e.start)} → ${fmtDate(e.end)}</div>
      `;
        cal.appendChild(eventEl);
    });

    /* ---------- Auto-scroll to relevant hours ---------- */
    const container = document.querySelector(".week-body");
    if (container) {
        const firstEvent = events
            .map((e) => parseDate(e.start))
            .filter(Boolean)
            .sort((a, b) => a - b)[0];

        const targetHour = firstEvent ? firstEvent.getHours() : 8;
        const rowHeight =
            parseFloat(
                getComputedStyle(document.documentElement).getPropertyValue("--hour-row")
            ) || 56;

        // Scroll so the first event (or 8 AM) is near top
        container.scrollTop = Math.max(0, (targetHour - startHour - 1) * rowHeight);
    }
};