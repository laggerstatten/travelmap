///////////////////////////////////////////////////////////////
// HELPERS
///////////////////////////////////////////////////////////////

function classifyInsolation(dt, lat, lng) {
  const t = SunCalc.getTimes(dt, lat, lng);

  console.log('classifyInsolation()', {
    dt,
    dawn: t.dawn,
    sunrise: t.sunrise,
    sunset: t.sunset,
    dusk: t.dusk
  });

  if (dt < t.dawn || dt > t.dusk) {
    console.log(' → NIGHT');
    return 'night';
  }

  if (dt >= t.sunrise && dt <= t.sunset) {
    console.log(' → DAY');
    return 'day';
  }

  console.log(' → TWILIGHT');
  return 'twilight';
}

function getSunEventsBetween(start, end, lat, lng) {
  console.log('getSunEventsBetween()', { start, end, lat, lng });

  const events = [];
  // include astronomical night start/end so we get a true night slice
  const wanted = ['nightEnd', 'dawn', 'sunrise', 'sunset', 'dusk', 'night'];

  const dayStart = new Date(start);
  dayStart.setHours(0, 0, 0, 0);

  const dayAfter = new Date(dayStart);
  dayAfter.setDate(dayAfter.getDate() + 1);

  const checkDays = [dayStart, dayAfter];

  console.log(' Checking days:', checkDays);

  for (let day of checkDays) {
    const t = SunCalc.getTimes(day, lat, lng);
    console.log(' SunCalc.getTimes', day, t);

    for (let name of wanted) {
      const d = t[name];
      const inRange = d >= start && d <= end;
      console.log(`  event ${name}:`, d, 'in range?', inRange);

      if (inRange) {
        events.push({ name, time: d });
      }
    }
  }

  events.sort((a, b) => a.time - b.time);
  console.log(' → events found:', events);

  return events;
}

function computeSegmentInsolation(seg, lat, lng) {
  const start = new Date(seg.start.utc);
  const end = new Date(seg.end.utc);

  console.log('computeSegmentInsolation()', {
    seg,
    start,
    end,
    duration_hours: (end - start) / 3600000
  });

  // skip multi-day segments
  if (end - start > 24 * 3600 * 1000) {
    console.warn('Segment longer than 24h → skipping');
    return null;
  }

  const events = getSunEventsBetween(start, end, lat, lng);

  console.log(' Events inside segment:', events);

  const slices = [];
  let cursor = start;

  function addSlice(to) {
    const phase = classifyInsolation(cursor, lat, lng);
    console.log(' addSlice', { from: cursor, to, phase });

    slices.push({
      start: cursor,
      end: to,
      phase
    });

    cursor = to;
  }

  for (const ev of events) addSlice(ev.time);
  addSlice(end);

  console.log(' → slices:', slices);
  return slices;
}

///////////////////////////////////////////////////////////////
// MAIN EXPORTED FUNCTION
///////////////////////////////////////////////////////////////

function buildInsolationRailForSegment(seg) {
  console.log('buildInsolationRailForSegment()', seg);

  const rail = document.createElement('div');
  rail.className = 'insolation-rail';

  // --- Extract UTC fields --------------------------------------------
  if (!seg?.start?.utc || !seg?.end?.utc) {
    console.warn('Missing start/end utc → returning empty rail');
    rail.classList.add('empty');
    return rail;
  }

  // --- Extract lat/lng from segment ----------------------------------
  let lat = null;
  let lng = null;

  // CASE 1: stops, trip_start, trip_end
  if (Array.isArray(seg.coordinates)) {
    lng = seg.coordinates[0];
    lat = seg.coordinates[1];
  }

  // CASE 2: drives
  if ((!lat || !lng) && seg.routeGeometry?.coordinates?.length) {
    // take the first point
    const pt = seg.routeGeometry.coordinates[0];
    lng = pt[0];
    lat = pt[1];
  }

  // If still no lat/lng, give up gracefully
  if (!lat || !lng) {
    console.warn('No lat/lng found → returning empty rail');
    rail.classList.add('empty');
    return rail;
  }

  console.log('Using lat/lng:', lat, lng);

  // -----------------------------------------------------
  // Continue as before
  // -----------------------------------------------------
  const slices = computeSegmentInsolation(seg, lat, lng);

  if (!slices) {
    console.warn('No slices computed → empty rail');
    rail.classList.add('empty');
    return rail;
  }

  const total = new Date(seg.end.utc) - new Date(seg.start.utc);

  slices.forEach((s) => {
    const div = document.createElement('div');
    div.className = 'insolation-block ' + s.phase;

    const pct = ((s.end - s.start) / total) * 100;
    div.style.height = pct + '%';

    rail.appendChild(div);
  });

  return rail;
}
