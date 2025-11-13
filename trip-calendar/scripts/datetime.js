// ---------- Core Conversions ----------


// Local → UTC ISO
function localToUTC(localStr, timeZone) {
  if (!localStr) return '';

  // Split local input (YYYY-MM-DDTHH:mm)
  const [datePart, timePart] = localStr.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = timePart.split(':').map(Number);

  // Treat that wall-clock time as occurring in `timeZone`
  const localGuess = new Date(Date.UTC(y, m - 1, d, hh, mm));

  // Find what offset that zone has at that instant
  const offsetMin = getTimezoneOffsetFor(timeZone, localGuess);

  // Convert to true UTC (subtract local offset)
  return new Date(localGuess.getTime() - offsetMin * 60000).toISOString();
}

// UTC → Local ISO (for <input type="datetime-local">)
function utcToLocalInput(utcString, timeZone) {
  if (!utcString) return '';
  const d = new Date(utcString);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(d);
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
}

// Offset in minutes for given zone/date
function getTimezoneOffsetFor(timeZone, date) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });

  const parts = Object.fromEntries(fmt.formatToParts(date).map(p => [p.type, p.value]));
  // Interpret the formatted local time as if it were UTC
  const asUTC = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );

  // offset = UTC - local  (in minutes)
  return Math.round((asUTC - date.getTime()) / 60000);
}

// ---------- Display ----------

function fmtDate(utc, tz) {
  if (!utc) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz || 'UTC',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
    hour12: true
  }).format(new Date(utc));
}

function fmtDay(utcString, timeZone) {
  if (!utcString) return '';
  const opts = {
    timeZone: timeZone || 'UTC',
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  };
  return new Intl.DateTimeFormat('en-US', opts).format(new Date(utcString));
}


// ---------- Arithmetic ----------

const addMinutes = (utc, minutes) =>
  new Date(new Date(utc).getTime() + minutes * 60000).toISOString();

const addHours = (utc, hours) =>
  addMinutes(utc, hours * 60);

const durationHours = (startUTC, endUTC) =>
  (new Date(endUTC) - new Date(startUTC)) / 3600000;

const endFromDuration = (startUTC, hours) =>
  addHours(startUTC, hours);

const startFromDuration = (endUTC, hours) =>
  addHours(endUTC, -hours);

// ---------- Duration Formatting ----------

function formatDurationMin(min) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}h ${m}m` : `${m} min`;
}

function formatDurationHr(hr) {
  return formatDurationMin(hr * 60);
}

