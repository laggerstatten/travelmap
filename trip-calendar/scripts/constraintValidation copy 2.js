function validateTrip(segments) {
  const results = [];

  for (const seg of segments) {
    if (!Array.isArray(seg.constraints)) continue;

    for (const c of seg.constraints) {
      const constraintType = constraintTypes[c.type];
      if (!constraintType) continue;

      const validator = constraintValidators[c.type];
      //console.log(validator);
      if (!validator) {
        console.warn('No validator for constraint type', c.type);
        continue;
      }

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
  const local = (d) =>
    new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: seg.timeZone
    }).format(d);

  if (mode === 'timeRange') {
    const tl = params.startTime; // "09:00"
    const tr = params.endTime; // "15:00"
    if (!tl || !tr) return null;

    const segTimeNum = start.getHours() * 60 + start.getMinutes();
    const minNum = Number(tl.slice(0, 2)) * 60 + Number(tl.slice(3, 5));
    const maxNum = Number(tr.slice(0, 2)) * 60 + Number(tr.slice(3, 5));

    if (segTimeNum < minNum || segTimeNum > maxNum) {
      return verror(
        seg,
        c,
        `Visit must be between ${tl}–${tr}, but starts at ${start.toISOString()}`
      );
    }
  }

  if (mode === 'dateTimeRange') {
    const s = new Date(params.startDateTime);
    const e = new Date(params.endDateTime);
    if (start < s || start > e) {
      return verror(
        seg,
        c,
        `Visit must be between ${params.startDateTime}–${params.endDateTime}`
      );
    }
  }

  if (mode === 'dateRange') {
    const { startDate, endDate } = params.ranges || {};
    if (!startDate || !endDate) return null;

    const segDate = seg.start.utc.slice(0, 10);
    if (segDate < startDate || segDate > endDate) {
      return verror(seg, c, `Visit must be between ${startDate}–${endDate}`);
    }
  }

  return null;
}

function validate_duration(seg, segments, c) {
  const { mode, params } = c;

  if (!seg.duration?.val) return vwarn(seg, c, 'Segment has no duration');

  const dur = seg.duration.val; // hours float

  if (mode === 'range') {
    const { minHours, maxHours } = params;
    if (!minHours && !maxHours) return null;

    if (minHours && dur < Number(minHours)) {
      return verror(
        seg,
        c,
        `Duration ${dur}h is less than minimum ${minHours}h`
      );
    }
    if (maxHours && dur > Number(maxHours)) {
      return verror(seg, c, `Duration ${dur}h exceeds maximum ${maxHours}h`);
    }
    return null;
  }

  if (mode === 'compare') {
    const { operator, hours } = params;
    if (!operator || !hours) return null;

    const h = Number(hours);

    if (operator === '<' && !(dur < h))
      return verror(seg, c, `Duration must be < ${h}h but is ${dur}h`);

    if (operator === '>' && !(dur > h))
      return verror(seg, c, `Duration must be > ${h}h but is ${dur}h`);

    return null;
  }

  return null;
}

function validate_arrival(seg, segments, c) {
  if (!seg.start?.utc) return vwarn(seg, c, 'Arrival time missing');

  const start = new Date(seg.start.utc);
  const { mode, params } = c;

  const localTime = fmtLocalTime(seg.start.utc, seg.timeZone);
  const dateOnly = seg.start.utc.slice(0, 10);

  // TIME WINDOW
  if (mode === 'timeRange') {
    const { startTime, endTime } = params;
    if (!startTime || !endTime) return null;

    if (localTime < startTime || localTime > endTime) {
      return verror(seg, c, `Arrival must be between ${startTime}–${endTime}`);
    }
    return null;
  }

  // DATETIME WINDOW
  if (mode === 'dateTimeRange') {
    const s = new Date(params.startDateTime);
    const e = new Date(params.endDateTime);

    if (start < s || start > e) {
      return verror(
        seg,
        c,
        `Arrival must be between ${params.startDateTime}–${params.endDateTime}`
      );
    }
    return null;
  }

  // DATE ONLY RANGE
  if (mode === 'dateRange') {
    const r = params.ranges;
    if (!r?.startDate || !r?.endDate) return null;

    if (dateOnly < r.startDate || dateOnly > r.endDate) {
      return verror(
        seg,
        c,
        `Arrival must be between ${r.startDate}–${r.endDate}`
      );
    }
    return null;
  }

  // COMPARE LOCAL TIME
  if (mode === 'compareTime') {
    const { operator, time } = params;
    if (!operator || !time) return null;

    if (operator === '<' && !(localTime < time))
      return verror(seg, c, `Arrival must be before ${time}`);
    if (operator === '>' && !(localTime > time))
      return verror(seg, c, `Arrival must be after ${time}`);

    return null;
  }

  // COMPARE DATETIME
  if (mode === 'compareDateTime') {
    const { operator, dateTime } = params;
    if (!operator || !dateTime) return null;

    const dt = new Date(dateTime);

    if (operator === '<' && !(start < dt))
      return verror(seg, c, `Arrival must be before ${dateTime}`);
    if (operator === '>' && !(start > dt))
      return verror(seg, c, `Arrival must be after ${dateTime}`);

    return null;
  }

  return null;
}

function validate_departure(seg, segments, c) {
  if (!seg.end?.utc) return vwarn(seg, c, 'Departure time missing');

  const end = new Date(seg.end.utc);
  const { mode, params } = c;

  const localTime = fmtLocalTime(seg.end.utc, seg.timeZone);
  const dateOnly = seg.end.utc.slice(0, 10);

  // TIME WINDOW
  if (mode === 'timeRange') {
    const { startTime, endTime } = params;
    if (!startTime || !endTime) return null;

    if (localTime < startTime || localTime > endTime) {
      return verror(
        seg,
        c,
        `Departure must be between ${startTime}–${endTime}`
      );
    }
    return null;
  }

  // DATETIME WINDOW
  if (mode === 'dateTimeRange') {
    const s = new Date(params.startDateTime);
    const e = new Date(params.endDateTime);

    if (end < s || end > e) {
      return verror(
        seg,
        c,
        `Departure must be between ${params.startDateTime}–${params.endDateTime}`
      );
    }
    return null;
  }

  // DATE ONLY RANGE
  if (mode === 'dateRange') {
    const r = params.ranges;
    if (!r?.startDate || !r?.endDate) return null;

    if (dateOnly < r.startDate || dateOnly > r.endDate) {
      return verror(
        seg,
        c,
        `Departure must be between ${r.startDate}–${r.endDate}`
      );
    }
    return null;
  }

  // COMPARE LOCAL TIME
  if (mode === 'compareTime') {
    const { operator, time } = params;
    if (!operator || !time) return null;

    if (operator === '<' && !(localTime < time))
      return verror(seg, c, `Departure must be before ${time}`);

    if (operator === '>' && !(localTime > time))
      return verror(seg, c, `Departure must be after ${time}`);

    return null;
  }

  // COMPARE DATETIME
  if (mode === 'compareDateTime') {
    const { operator, dateTime } = params;
    if (!operator || !dateTime) return null;

    const dt = new Date(dateTime);

    if (operator === '<' && !(end < dt))
      return verror(seg, c, `Departure must be before ${dateTime}`);
    
    if (operator === '>' && !(end > dt))
      return verror(seg, c, `Departure must be after ${dateTime}`);

    return null;
  }

  return null;
}

function validate_daysOfWeek(seg, segments, c) {
  const { days } = c.params;
  if (!Array.isArray(days) || days.length === 0) return null;

  if (!seg.start?.utc) return vwarn(seg, c, 'Segment has no date');

  const d = new Date(seg.start.utc);
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });

  if (!days.includes(weekday)) {
    return verror(
      seg,
      c,
      `Allowed days: ${days.join(', ')}, but this is ${weekday}`
    );
  }

  return null;
}

function validate_blackout(seg, segments, c) {
  const { mode, params } = c;

  const startDate = seg.start?.utc?.slice(0, 10);
  const endDate = seg.end?.utc?.slice(0, 10);

  if (!startDate && !endDate)
    return vwarn(seg, c, 'Segment has no dates to compare');

  const check = (date) => {
    if (!date) return false;

    // MODE: specific dates
    if (mode === 'dates') {
      const list = params.dates || [];
      return list.includes(date);
    }

    // MODE: single range (startDate/endDate)
    if (mode === 'ranges') {
      const s = params.startDate;
      const e = params.endDate;
      if (!s || !e) return false;
      return date >= s && date <= e;
    }

    return false;
  };

  const startHit = check(startDate);
  const endHit = check(endDate);

  if (!startHit && !endHit) return null;

  if (startHit && endHit) {
    return verror(
      seg,
      c,
      `Segment (${startDate}–${endDate}) falls entirely within blackout`
    );
  }

  if (startHit) {
    return verror(seg, c, `Start date ${startDate} is blacked out`);
  }

  if (endHit) {
    return verror(seg, c, `End date ${endDate} is blacked out`);
  }

  return null;
}
