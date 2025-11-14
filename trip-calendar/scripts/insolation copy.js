///////////////////////////////////////////////////////////////
// HELPERS
///////////////////////////////////////////////////////////////

function classifyInsolation(dt, lat, lng) {
  const t = SunCalc.getTimes(dt, lat, lng);

  if (dt < t.dawn || dt > t.dusk) return 'night';
  if (dt >= t.sunrise && dt <= t.sunset) return 'day';
  return 'twilight';
}

function getSunEventsBetween(start, end, lat, lng) {
  const events = [];

  const wanted = ['dawn', 'sunrise', 'sunset', 'dusk'];

  // we only check the start day and next day, enough for <24h segments
  const dayStart = new Date(start);
  dayStart.setHours(0, 0, 0, 0);

  const dayAfter = new Date(dayStart);
  dayAfter.setDate(dayAfter.getDate() + 1);

  const checkDays = [dayStart, dayAfter];

  for (let day of checkDays) {
    const t = SunCalc.getTimes(day, lat, lng);

    for (let name of wanted) {
      const d = t[name];
      if (d >= start && d <= end) {
        events.push({ name, time: d });
      }
    }
  }

  events.sort((a, b) => a.time - b.time);
  return events;
}

function computeSegmentInsolation(seg, lat, lng) {
  const start = new Date(seg.start.utc);
  const end = new Date(seg.end.utc);

  // skip multi-day
  if (end - start > 24 * 3600 * 1000) return null;

  const events = getSunEventsBetween(start, end, lat, lng);
  const slices = [];

  let cursor = start;

  function addSlice(to) {
    slices.push({
      start: cursor,
      end: to,
      phase: classifyInsolation(cursor, lat, lng)
    });
    cursor = to;
  }

  for (const ev of events) addSlice(ev.time);
  addSlice(end);

  return slices;
}

///////////////////////////////////////////////////////////////
// MAIN EXPORTED FUNCTION
///////////////////////////////////////////////////////////////

function buildInsolationRailForSegment(seg) {
  const rail = document.createElement('div');
  rail.className = 'insolation-rail';

  // verify data
  if (
    !seg?.start?.utc ||
    !seg?.end?.utc ||
    !seg?.start?.lat ||
    !seg?.start?.lng
  ) {
    rail.classList.add('empty');
    return rail;
  }

  const lat = seg.start.lat;
  const lng = seg.start.lng;

  const slices = computeSegmentInsolation(seg, lat, lng);

  if (!slices) {
    rail.classList.add('empty');
    return rail;
  }

  const total = new Date(seg.end.utc) - new Date(seg.start.utc);

  slices.forEach((s) => {
    const div = document.createElement('div');
    div.className = 'insolation-block ' + s.phase;

    const pct = ((s.end - s.start) / total) * 100;
    div.style.width = pct + '%';

    rail.appendChild(div);
  });

  return rail;
}
