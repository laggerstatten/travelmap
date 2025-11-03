(function() {
    const S = window.TripCal;

    const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    function dayKey(d) { return d.toISOString().slice(0, 10); } // YYYY-MM-DD

    function getWeekStart(refDate) {
        const d = new Date(refDate);
        d.setHours(0, 0, 0, 0);
        const delta = d.getDay(); // 0=Sun
        d.setDate(d.getDate() - delta);
        return d;
    }

    function minsSinceMidnight(d) {
        return d.getHours() * 60 + d.getMinutes();
    }

    S.renderWeek = function() {
        const cal = document.getElementById("calendar");
        cal.className = "week";
        cal.innerHTML = "";

        // header
        const header = document.createElement("div");
        header.className = "week-header";
        header.appendChild(document.createElement("div")); // time col blank

        // choose reference (today or first dated event)
        const ref = S.events.find(e => S.parseDate(e.start)) ?.start || new Date().toISOString();
        const weekStart = getWeekStart(new Date(ref));

        // header labels
        for (let i = 0; i < 7; i++) {
            const d = new Date(weekStart);
            d.setDate(weekStart.getDate() + i);
            const div = document.createElement("div");
            div.textContent = `${DAYS[d.getDay()]} ${d.getMonth() + 1}/${d.getDate()}`;
            header.appendChild(div);
        }
        cal.appendChild(header);

        // body grid
        const body = document.createElement("div");
        body.className = "week-body";

        // left time labels
        for (let h = 0; h < 24; h++) {
            const t = document.createElement("div");
            t.className = "time-cell";
            t.textContent = h === 0 ? "12 AM" : (h < 12 ? `${h} AM` : (h === 12 ? "12 PM" : `${h - 12} PM`));
            body.appendChild(t);
            // add after row placeholder cells for columns will be added as absolutely positioned children
            for (let i = 0; i < 7; i++) {
                // grid cells themselves aren't needed; we'll overlay absolute events inside per-day container rows
                const blank = document.createElement("div");
                blank.className = "day-col";
                body.appendChild(blank);
            }
        }
        cal.appendChild(body);

        // Create day columns as absolute containers (overlay)
        const colContainers = [];
        for (let i = 0; i < 7; i++) {
            const col = document.createElement("div");
            col.style.gridColumn = `${i + 2} / ${i + 3}`; // skip time col
            col.style.gridRow = `1 / span ${24}`;
            col.className = "day-col";
            col.style.position = "relative";
            cal.appendChild(col);
            colContainers.push(col);

            // hour guidelines
            for (let h = 0; h < 24; h++) {
                const line = document.createElement("div");
                line.className = "hour-guideline";
                line.style.top = `calc(${h} * var(--hour-row))`;
                col.appendChild(line);
            }
        }

        // place events with start/end inside week
        const pxPerMin = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hour-row')) / 60 || (56 / 60);
        S.events.forEach(e => {
            const start = S.parseDate(e.start);
            const end = S.parseDate(e.end);
            if (!start || !end) return;

            const dayIdx = ((start.getDay() - 0) + 7) % 7; // 0=Sun
            const container = colContainers[dayIdx];
            if (!container) return;

            const top = minsSinceMidnight(start) * pxPerMin;
            const height = Math.max(28, (minsSinceMidnight(end) - minsSinceMidnight(start)) * pxPerMin);

            const ev = document.createElement("div");
            ev.className = `week-event ${e.type || "stop"}`;
            ev.style.top = `${top}px`;
            ev.style.height = `${height}px`;
            ev.innerHTML = `
        <div class="title">${e.name || "(untitled)"}</div>
        <div class="time">${S.fmtDate(e.start)} → ${S.fmtDate(e.end)}</div>
      `;
            container.appendChild(ev);
        });
    };
})();