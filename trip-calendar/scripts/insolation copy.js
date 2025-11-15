///////////////////////////////////////////////////////////////
// PHASE CLASSIFICATION
///////////////////////////////////////////////////////////////

function phaseFromEventName(name) {
  // STRICT NIGHT
  const NIGHT_EVENTS = ['night', 'nadir'];

  // ALL TWILIGHT TYPES
  const TWILIGHT_EVENTS = [
    'nightEnd',
    'nauticalDawn',
    'nauticalDusk',
    'dawn',
    'sunrise',
    'sunset',
    'dusk'
  ];

  // DAY EVENTS
  const DAY_EVENTS = [
    'sunriseEnd',
    'goldenHourEnd',
    'solarNoon',
    'goldenHour',
    'sunsetStart'
  ];

  if (NIGHT_EVENTS.includes(name)) return 'night';
  if (DAY_EVENTS.includes(name)) return 'day';
  if (TWILIGHT_EVENTS.includes(name)) return 'twilight';

  // Fallback if we ever see something unexpected
  return 'day';
}

///////////////////////////////////////////////////////////////
// COLLECT ALL EVENTS ACROSS DAYS — ROBUST, MULTI-DAY SAFE
///////////////////////////////////////////////////////////////

function getSunEventsAroundWindow(start, end, lat, lng) {
  console.log('getSunEventsAroundWindow()', { start, end, lat, lng });

  const EVENT_NAMES = [
    'nightEnd',
    'nauticalDawn',
    'dawn',
    'sunrise',
    'sunriseEnd',
    'goldenHourEnd',
    'solarNoon',
    'goldenHour',
    'sunsetStart',
    'sunset',
    'dusk',
    'nauticalDusk',
    'night',
    'nadir'
  ];

  const allEvents = [];

  // from startDay-1
  const fromDay = new Date(start);
  fromDay.setHours(0, 0, 0, 0);
  fromDay.setDate(fromDay.getDate() - 1);

  // to endDay+1
  const toDay = new Date(end);
  toDay.setHours(0, 0, 0, 0);
  toDay.setDate(toDay.getDate() + 1);

  console.log('  day range:', { fromDay, toDay });

  for (let d = new Date(fromDay); d <= toDay; d.setDate(d.getDate() + 1)) {
    const times = SunCalc.getTimes(d, lat, lng);
    console.log('  SunCalc.getTimes for day:', d, times);

    EVENT_NAMES.forEach((name) => {
      const t = times[name];
      if (t instanceof Date && !isNaN(t)) {
        allEvents.push({ name, time: t });
      }
    });
  }

  // Sort in ascending absolute time
  allEvents.sort((a, b) => a.time - b.time);
  console.log('  allEvents (sorted):', allEvents);

  // Identify the last event BEFORE start, and all events within window
  let priorEvent = null;
  const inWindow = [];

  for (const ev of allEvents) {
    if (ev.time < start) {
      priorEvent = ev;
      continue;
    }
    if (ev.time > end) break;
    inWindow.push(ev);
  }

  console.log('  priorEvent:', priorEvent);
  console.log('  inWindow:', inWindow);

  return { priorEvent, events: inWindow };
}

///////////////////////////////////////////////////////////////
// MAIN SLICER (multi-day safe)
///////////////////////////////////////////////////////////////

function computeSegmentInsolation(seg, lat, lng) {
  const start = new Date(seg.start.utc);
  const end = new Date(seg.end.utc);

  console.log('computeSegmentInsolation()', {
    seg,
    start,
    end,
    duration_hours: (end - start) / 3600000
  });


  const { priorEvent, events } = getSunEventsAroundWindow(start, end, lat, lng);

  const slices = [];
  let cursor = start;
  let lastEvent = priorEvent;

  function currentPhase() {
    if (!lastEvent) return 'day';
    return phaseFromEventName(lastEvent.name);
  }

  function addSlice(to) {
    if (to <= cursor) return;
    const phase = currentPhase();
    console.log('  addSlice', { from: cursor, to, phase, lastEvent });
    slices.push({ 
      start: cursor, 
      end: to, 
      phase });
    cursor = to;
  }

  // Each event splits the segment
  for (const ev of events) {
    addSlice(ev.time);
    lastEvent = ev;
  }

  // Final tail
  addSlice(end);

  console.log('  → slices:', slices);
  return slices;
}

///////////////////////////////////////////////////////////////
// MAIN API FUNCTION — RETURNS DOM ELEMENT
///////////////////////////////////////////////////////////////

function buildInsolationRailForSegment(seg) {
  console.log('buildInsolationRailForSegment()', seg);

  const rail = document.createElement('div');
  rail.className = 'insolation-rail';

  // --- SUPPRESS FOR NON-STOPS & NON-DRIVES ---
  if (seg.type !== "stop" && seg.type !== "drive") {
    rail.classList.add("empty");
    return rail;
  }

  // --- Extract UTC fields --------------------------------------------
  if (!seg?.start?.utc || !seg?.end?.utc) {
    console.warn('Missing start/end utc → returning empty rail');
    rail.classList.add('empty');
    return rail;
  }

  // Extract coordinates
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
  
  // Build vertical bar with proportional-height blocks
  for (const s of slices) {
    const div = document.createElement('div');
    div.className = 'insolation-block ' + s.phase;

    const pct = ((s.end - s.start) / total) * 100;
    div.style.height = pct + '%';

    rail.appendChild(div);
  }

  return rail;
}
