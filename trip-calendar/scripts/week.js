(function () {
  const S = window.TripCal;
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  function getWeekStart(refDate) {
    const d = new Date(refDate);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }

  function minsSinceMidnight(d) {
    return d.getHours() * 60 + d.getMinutes();
  }

  S.renderWeek = function () {
    const cal = document.getElementById("calendar");
    cal.className = "week";
    cal.innerHTML = "";

    /* ---------- Header ---------- */
    const header = document.createElement("div");
    header.className = "week-header";
    header.appendChild(document.createElement("div")); // empty time col

    const ref =
      S.events.find((e) => S.parseDate(e.start))?.start ||
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

    // create 24 rows; for each hour add 1 time cell + 7 day cells
    for (let h = 0; h < 24; h++) {
      const t = document.createElement("div");
      t.className = "time-cell";
      t.textContent =
        h === 0
          ? "12 AM"
          : h < 12
          ? `${h} AM`
          : h === 12
          ? "12 PM"
          : `${h - 12} PM`;
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

    S.events.forEach((e) => {
      const start = S.parseDate(e.start);
      if (!start) return;
      const end = S.parseDate(e.end) || new Date(start.getTime() + 3600000);
      if (start < weekStart || start >= weekEnd) return;

      const dayIdx = start.getDay(); // 0–6
      const top = minsSinceMidnight(start) * pxPerMin;
      const height = Math.max(
        30,
        (minsSinceMidnight(end) - minsSinceMidnight(start)) * pxPerMin
      );

      const dayCells = body.querySelectorAll(`.day-col[data-day="${dayIdx}"]`);
      if (!dayCells.length) return;

      // place event in the first cell for that day
      const container = dayCells[0].parentElement;
      const eventEl = document.createElement("div");
      eventEl.className = `week-event ${e.type || "stop"}`;
      eventEl.style.position = "absolute";
      eventEl.style.top = `${top}px`;
      eventEl.style.height = `${height}px`;
      eventEl.style.left = `calc(${(dayIdx + 1) * (100 / 8)}%)`;
      eventEl.style.width = `calc(${100 / 8}% - 8px)`;

      eventEl.innerHTML = `
        <div class="title">${e.name || "(untitled)"}</div>
        <div class="time">${S.fmtDate(e.start)} → ${S.fmtDate(e.end)}</div>
      `;
      cal.appendChild(eventEl);
    });
  };
})();
