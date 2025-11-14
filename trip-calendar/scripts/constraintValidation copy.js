// Parse "YYYY-MM-DD to YYYY-MM-DD"
function parseFlatpickrRange(str) {
  if (!str || typeof str !== 'string') return null;
  if (!str.includes('to')) return null;

  const [start, end] = str.split('to').map((s) => s.trim());
  if (!start || !end) return null;

  return { startDate: start, endDate: end };
}

// Parse "YYYY-MM-DD, YYYY-MM-DD, ... "
function parseFlatpickrMulti(str) {
  if (!str || typeof str !== 'string') return [];
  return str
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function validateTrip(segments) {
  const results = [];

  for (const seg of segments) {
    if (!Array.isArray(seg.constraints)) continue;

    for (const c of seg.constraints) {
      const validator = constraintValidators[c.type];
      if (!validator) continue;

      const r = validator(seg, segments, c);
      if (Array.isArray(r)) results.push(...r);
      else if (r) results.push(r);
    }
  }

  return results;
}

function verror(seg, c, msg) {
  return {
    segmentId: seg.id,
    constraint: c,
    severity: 'error',
    message: msg
  };
}

function vwarn(seg, c, msg) {
  return {
    segmentId: seg.id,
    constraint: c,
    severity: 'warning',
    message: msg
  };
}

function vok(seg, c, msg) {
  return {
    segmentId: seg.id,
    constraint: c,
    severity: 'ok',
    message: msg
  };
}

const constraintValidators = {
  visit: validate_visit,
  duration: validate_duration,
  arrival: validate_arrival,
  departure: validate_departure,
  daysOfWeek: validate_daysOfWeek,
  blackout: validate_blackout

  /**
      holidays: validate_holidays,
      businessHours: validate_businessHours,
      visitInsideBusinessHours: validate_visitInsideBusinessHours,
      minAfterOpen: validate_minAfterOpen,
      maxBeforeClose: validate_maxBeforeClose,
      avoidTimes: validate_avoidTimes,
      mustPrecede: validate_mustPrecede,
      mustFollow: validate_mustFollow
    */
};

function fmtLocalTime(utc, tz) {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: tz
  }).format(new Date(utc));
}

function validate_visit(seg, segments, c) {
  const { mode, params } = c;

  if (!seg.start?.utc) return vwarn(seg, c, 'Segment missing start time');

  const start = new Date(seg.start.utc);
  const dateOnly = seg.start.utc.slice(0, 10);

  // DATE RANGE (YYYY-MM-DD to YYYY-MM-DD)
  if (mode === 'dateRange') {
    const r = parseFlatpickrRange(params.ranges);
    if (!r) return vwarn(seg, c, 'Date range not fully specified');

    const { startDate, endDate } = r;

    if (dateOnly < startDate || dateOnly > endDate)
      return verror(seg, c, `Visit must be between ${startDate}–${endDate}`);

    return vok(seg, c, 'Visit date is within allowed range');
  }

  // MULTIPLE DATES
  if (mode === 'dates') {
    const arr = parseFlatpickrMulti(params.dates);

    if (arr.length === 0) return vwarn(seg, c, 'No dates provided');

    if (!arr.includes(dateOnly))
      return verror(seg, c, `Visit date ${dateOnly} is not in allowed dates`);

    return vok(seg, c, 'Visit date is in allowed date list');
  }

  // TIME RANGE
  if (mode === 'timeRange') {
    const { startTime, endTime } = params;
    if (!startTime || !endTime)
      return vwarn(seg, c, 'Time range not fully specified');

    const localTime = fmtLocalTime(seg.start.utc, seg.timeZone);

    if (localTime < startTime || localTime > endTime)
      return verror(seg, c, `Visit must be between ${startTime}–${endTime}`);

    return vok(seg, c, 'Visit satisfies timeRange');
  }

  // DATETIME RANGE
  if (mode === 'dateTimeRange') {
    const s = new Date(params.startDateTime);
    const e = new Date(params.endDateTime);

    if (start < s || start > e)
      return verror(
        seg,
        c,
        `Visit must be between ${params.startDateTime}–${params.endDateTime}`
      );

    return vok(seg, c, 'Visit satisfies datetime range');
  }

  return vwarn(seg, c, 'Unknown visit mode');
}

function validate_duration(seg, segments, c) {
  const { mode, params } = c;

  if (!seg.duration?.val) return vwarn(seg, c, 'Segment has no duration');

  const dur = seg.duration.val;

  // RANGE
  if (mode === 'range') {
    const { minHours, maxHours } = params;

    if (minHours && dur < Number(minHours))
      return verror(seg, c, `Duration ${dur}h < minimum ${minHours}h`);

    if (maxHours && dur > Number(maxHours))
      return verror(seg, c, `Duration ${dur}h > maximum ${maxHours}h`);

    return vok(seg, c, 'Duration satisfies range');
  }

  // COMPARE
  if (mode === 'compare') {
    const { operator, hours } = params;
    const h = Number(hours);

    if (!operator || !hours)
      return vwarn(seg, c, 'Comparison operator or hours missing');

    if (operator === '<' && !(dur < h))
      return verror(seg, c, `Duration must be < ${h}h`);

    if (operator === '>' && !(dur > h))
      return verror(seg, c, `Duration must be > ${h}h`);

    return vok(seg, c, 'Duration satisfies comparison');
  }

  return vwarn(seg, c, 'Unknown duration mode');
}

function validate_arrival(seg, segments, c) {
  if (!seg.start?.utc) return vwarn(seg, c, 'Arrival missing start time');

  const start = new Date(seg.start.utc);
  const { mode, params } = c;

  const localTime = fmtLocalTime(seg.start.utc, seg.timeZone);
  const dateOnly = seg.start.utc.slice(0, 10);

  // TIME RANGE
  if (mode === 'timeRange') {
    const { startTime, endTime } = params;
    if (!startTime || !endTime) return vwarn(seg, c, 'Time range missing');

    if (localTime < startTime || localTime > endTime)
      return verror(seg, c, `Arrival must be between ${startTime}–${endTime}`);

    return vok(seg, c, 'Arrival time satisfies timeRange');
  }

  // DATETIME RANGE
  if (mode === 'dateTimeRange') {
    const s = new Date(params.startDateTime);
    const e = new Date(params.endDateTime);

    if (start < s || start > e)
      return verror(
        seg,
        c,
        `Arrival must be between ${params.startDateTime}–${params.endDateTime}`
      );

    return vok(seg, c, 'Arrival satisfies datetime range');
  }

  // DATE ONLY RANGE
  if (mode === 'dateRange') {
    const r = parseFlatpickrRange(params.ranges);
    if (!r) return vwarn(seg, c, 'Date range missing');

    const { startDate, endDate } = r;

    if (dateOnly < r.startDate || dateOnly > r.endDate)
      return verror(
        seg,
        c,
        `Arrival must be between ${r.startDate}–${r.endDate}`
      );

    return vok(seg, c, 'Arrival date satisfies dateRange');
  }

  // COMPARE LOCAL TIME
  if (mode === 'compareTime') {
    const { operator, time } = params;

    if (operator === '<' && !(localTime < time))
      return verror(seg, c, `Arrival must be before ${time}`);

    if (operator === '>' && !(localTime > time))
      return verror(seg, c, `Arrival must be after ${time}`);

    return vok(seg, c, 'Arrival satisfies time comparison');
  }

  // COMPARE DATETIME
  if (mode === 'compareDateTime') {
    const dt = new Date(params.dateTime);
    const { operator } = params;

    if (operator === '<' && !(start < dt))
      return verror(seg, c, `Arrival must be before ${params.dateTime}`);

    if (operator === '>' && !(start > dt))
      return verror(seg, c, `Arrival must be after ${params.dateTime}`);

    return vok(seg, c, 'Arrival satisfies datetime comparison');
  }

  return vwarn(seg, c, 'Unknown arrival mode');
}

function validate_departure(seg, segments, c) {
  if (!seg.end?.utc) return vwarn(seg, c, 'Departure missing end time');

  const end = new Date(seg.end.utc);
  const { mode, params } = c;

  const localTime = fmtLocalTime(seg.end.utc, seg.timeZone);
  const dateOnly = seg.end.utc.slice(0, 10);

  // TIME RANGE
  if (mode === 'timeRange') {
    const { startTime, endTime } = params;
    if (!startTime || !endTime) return vwarn(seg, c, 'Time range missing');

    if (localTime < startTime || localTime > endTime)
      return verror(
        seg,
        c,
        `Departure must be between ${startTime}–${endTime}`
      );

    return vok(seg, c, 'Departure time satisfies timeRange');
  }

  // DATETIME RANGE
  if (mode === 'dateTimeRange') {
    const s = new Date(params.startDateTime);
    const e = new Date(params.endDateTime);

    if (end < s || end > e)
      return verror(
        seg,
        c,
        `Departure must be between ${params.startDateTime}–${params.endDateTime}`
      );

    return vok(seg, c, 'Departure satisfies datetime range');
  }

  // DATE ONLY RANGE
  if (mode === 'dateRange') {
    const r = parseFlatpickrRange(params.ranges);
    if (!r) return vwarn(seg, c, 'Date range missing');

    const { startDate, endDate } = r;

    if (dateOnly < r.startDate || dateOnly > r.endDate)
      return verror(
        seg,
        c,
        `Departure must be between ${r.startDate}–${r.endDate}`
      );

    return vok(seg, c, 'Departure date satisfies dateRange');
  }

  // COMPARE LOCAL TIME
  if (mode === 'compareTime') {
    const { operator, time } = params;

    if (operator === '<' && !(localTime < time))
      return verror(seg, c, `Departure must be before ${time}`);

    if (operator === '>' && !(localTime > time))
      return verror(seg, c, `Departure must be after ${time}`);

    return vok(seg, c, 'Departure satisfies time comparison');
  }

  // COMPARE DATETIME
  if (mode === 'compareDateTime') {
    const dt = new Date(params.dateTime);
    const { operator } = params;

    if (operator === '<' && !(end < dt))
      return verror(seg, c, `Departure must be before ${params.dateTime}`);

    if (operator === '>' && !(end > dt))
      return verror(seg, c, `Departure must be after ${params.dateTime}`);

    return vok(seg, c, 'Departure satisfies datetime comparison');
  }

  return vwarn(seg, c, 'Unknown departure mode');
}

function validate_daysOfWeek(seg, segments, c) {
  const { days } = c.params;
  if (!Array.isArray(days) || days.length === 0)
    return vwarn(seg, c, 'No days provided');

  if (!seg.start?.utc) return vwarn(seg, c, 'Segment missing date');

  const d = new Date(seg.start.utc);
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });

  if (!days.includes(weekday))
    return verror(seg, c, `Allowed: ${days.join(', ')}; got ${weekday}`);

  return vok(seg, c, 'Day of week is permitted');
}

function validate_blackout(seg, segments, c) {
  const { mode, params } = c;

  const startDate = seg.start?.utc?.slice(0, 10);
  const endDate = seg.end?.utc?.slice(0, 10);

  if (!startDate && !endDate)
    return vwarn(seg, c, 'Segment has no dates to compare');

  // Checker for a single date
  const checkDate = (date) => {
    if (!date) return false;

    // MULTIPLE DATES
    if (mode === 'dates') {
      const arr = parseFlatpickrMulti(params.dates);
      return arr.includes(date);
    }

    // DATE RANGE
    if (mode === 'dateRange') {
      const r = parseFlatpickrRange(params.ranges);
      if (!r) return false;
      return date >= r.startDate && date <= r.endDate;
    }

    return false;
  };

  const startHit = checkDate(startDate);
  const endHit = checkDate(endDate);

  if (startHit && endHit)
    return verror(
      seg,
      c,
      `Segment ${startDate}–${endDate} is entirely blacked out`
    );

  if (startHit) return verror(seg, c, `Start date ${startDate} is blacked out`);

  if (endHit) return verror(seg, c, `End date ${endDate} is blacked out`);

  return vok(seg, c, 'Segment avoids all blackout dates');
}
