// Convert stored UTC → local input string for display
function utcToLocalInput(utcString, timeZone) {
  if (!utcString) return ''; // cleared field
  const d = new Date(utcString);
  if (isNaN(d)) return ''; // invalid date

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(d);

  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
}

// Convert local time (entered in a specific timezone) → UTC ISO string
function localToUTC(localDateTimeStr, timeZone) {
  // Parse as if it's in that timezone, then convert to UTC
  const [datePart, timePart] = localDateTimeStr.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);

  // Use Intl to find offset at that local time
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const parts = fmt.formatToParts(
    new Date(Date.UTC(year, month - 1, day, hour, minute))
  );
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute);

  // Calculate offset difference (in minutes) for that date in that zone
  const local = new Date(utcGuess);
  const tzOffset =
    local.getTimezoneOffset() - getTimezoneOffsetFor(timeZone, local);
  return new Date(utcGuess + tzOffset * 60 * 1000).toISOString();
}

function getTimezoneOffsetFor(timeZone, date) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
  const parts = f.formatToParts(date);
  const rebuilt = new Date(
    `${parts.find((p) => p.type === 'year').value}-${
      parts.find((p) => p.type === 'month').value
    }-${parts.find((p) => p.type === 'day').value}T${
      parts.find((p) => p.type === 'hour').value
    }:${parts.find((p) => p.type === 'minute').value}:00`
  );
  return (rebuilt - date) / 60000; // offset in minutes
}

function fmtDate(dateStr, timeZone) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const opts = {
    timeZone: timeZone || 'UTC',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
    hour12: true
  };
  return new Intl.DateTimeFormat('en-US', opts).format(d);
}

function formatDurationMin(min) {
  if (!min && min !== 0) return '';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}h ${m}m` : `${m} min`;
}

function formatDurationHr(hr) {
  if (!hr && hr !== 0) return '';
  const totalMin = hr * 60;
  const h = Math.floor(totalMin / 60);
  const m = Math.round(totalMin % 60);
  return h ? `${h}h ${m}m` : `${m} min`;
}


function durationFromStartEnd(startUTC, endUTC) {
  const s = new Date(startUTC),
    e = new Date(endUTC);
  return (e - s) / 3600000; // hours
}

function endFromDuration(startUTC, hours) {
  const s = new Date(startUTC);
  return new Date(s.getTime() + hours * 3600000).toISOString();
}

function startFromDuration(endUTC, hours) {
  const e = new Date(endUTC);
  return new Date(e.getTime() - hours * 3600000).toISOString();
}

function addMinutesUTC(utcString, minutes) {
  const date = new Date(utcString);
  const newDate = new Date(date.getTime() + minutes * 60000);
  return newDate.toISOString();
}

function dayStr(iso) {
  if (!iso) return '';
  return new Date(iso).toDateString();
}

function parseDate(v) {
  const d = new Date(v);
  return isNaN(d) ? null : d;
}


function segDurationMinutes(seg) {
  if (!seg) return 0;

  if (seg.type === 'drive') {
    //if (seg.durationMin) return Number(seg.durationMin);
    if (seg.duration?.val) return Math.round(Number(seg.duration.val) * 60);
  }
  if (seg.durationMin) return Number(seg.durationMin);
  if (seg.duration?.minutes) return Number(seg.duration.minutes);
  if (seg.duration?.val) return Math.round(Number(seg.duration.val) * 60);

  return 0;
}

function addMinutes(isoUtc, minutes) {

  const t = new Date(isoUtc).getTime() + minutes * 60000;
  return new Date(t).toISOString();
}


