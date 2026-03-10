// ===========================================================
// STATE
// ===========================================================
let poiMarkers = [];
let currentPOIProvider = null;

// ===========================================================
// UTILS
// ===========================================================

function cleanID(id) {
  if (!id) return '';
  return id.replace(/[{}]/g, '').trim().toUpperCase();
}

// Downsample a LineString to avoid huge matrix calls
function downsampleCoordinates(coords, maxPoints) {
  console.log(
    `Downsampling ${coords.length} coordinates to max ${maxPoints} points`
  );
  if (!coords || coords.length <= maxPoints) return coords || [];

  const step = Math.max(1, Math.floor(coords.length / maxPoints));
  const result = [];

  for (let i = 0; i < coords.length; i += step) {
    result.push(coords[i]);
  }

  // Ensure last point is present
  const last = coords[coords.length - 1];
  const lastR = result[result.length - 1];
  if (!lastR || lastR[0] !== last[0] || lastR[1] !== last[1]) {
    result.push(last);
  }
  console.log(result);
  return result;
}

// Build a route LineString from drive segments
function getFullRouteLineString(segments, maxPoints = 40) {
  if (!Array.isArray(segments)) return null;

  const ordered = segments
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  const fullCoords = [];

  for (const seg of ordered) {
    if (
      seg.type === 'drive' &&
      seg.routeGeometry &&
      Array.isArray(seg.routeGeometry.coordinates)
    ) {
      const coords = seg.routeGeometry.coordinates;

      if (fullCoords.length > 0) {
        const last = fullCoords[fullCoords.length - 1];
        const firstNext = coords[0];

        if (last[0] === firstNext[0] && last[1] === firstNext[1]) {
          fullCoords.push(...coords.slice(1));
        } else {
          fullCoords.push(...coords);
        }
      } else {
        fullCoords.push(...coords);
      }
    }
  }

  if (fullCoords.length < 2) return null;

  const downsampled = downsampleCoordinates(fullCoords, maxPoints);
  return {
    type: 'LineString',
    coordinates: downsampled
  };
}

// ===========================================================
// STOP DROPDOWN (unchanged logic)
// ===========================================================

function updateStopDropdown(list) {
  const select = document.getElementById('poi-stop-select');
  if (!select) return;

  select.innerHTML = '';
  const segments = [...list];

  segments.forEach((seg) => {
    if (
      seg.type === 'stop' ||
      seg.type === 'trip_start' ||
      seg.type === 'trip_end'
    ) {
      const opt = document.createElement('option');
      opt.value = seg.id;
      opt.textContent = seg.name || 'Stop ' + seg.id;
      select.appendChild(opt);
    }
  });
}

// ===========================================================
// GENERIC PROVIDER INTERFACE
// ===========================================================
/*
  A provider should implement:

  {
    name: "AZA Zoos" | "Recreation" | ...,
    iconColor: "#0088ff",

    // SEARCH
    fetchNearby: async ({ lat, lng }) => [poi, ...],
    fetchRouteNearby: async ({ line }) => [poi, ...],

    // OPTIONAL: compute drive times from origin to POIs
    computeDriveTimes: async ({ lat, lng, pois }) => updatedPois,

    // ACCESSORS
    getLatLng: poi => [lng, lat],
    getName:  poi => string,
    getCity:  poi => string | "",
    getState: poi => string | "",

    // VISITED (optional)
    loadVisited: async () => void,
    isVisited: poi => boolean,
    updateVisited: async (poi) => void,

    // MARKER POPUP
    markerPopupHTML: poi => "<html>",

    // OPTIONAL: used when queueing a stop
    getQueueName: poi => string,
  }
*/

function setPOIProvider(provider) {
  currentPOIProvider = provider;
  console.log('POI provider set to:', provider?.name);
}

// ===========================================================
// GENERIC POI RUN + RENDER
// ===========================================================

async function runPOISearch() {
  const provider = currentPOIProvider;
  if (!provider) {
    console.warn('No POI provider selected');
    return;
  }

  const modeEl = document.getElementById('poi-source');
  const mode = modeEl ? modeEl.value : 'center';

  if (provider?.name == 'Recreation Sites') {
    await RecProvider.init();
  } else if (provider?.name === 'Counties') {
    await CountyProvider.init();
  }

  // optional visited
  if (provider.loadVisited) {
    await provider.loadVisited();
  }

  let results = [];

  try {
    if (mode === 'center') {
      const c = mapInstance.getCenter();
      results = await provider.fetchNearby({ lat: c.lat, lng: c.lng });

      // optional drive times
      if (provider.computeDriveTimes) {
        results = await provider.computeDriveTimes({
          lat: c.lat,
          lng: c.lng,
          pois: results
        });
      }
    } else if (mode === 'stop') {
      const stopId = document.getElementById('poi-stop-select')?.value;
      if (!stopId) {
        console.warn('No stop selected');
        return;
      }

      const seg = loadSegments().find((s) => s.id === stopId);
      if (!seg || !Array.isArray(seg.coordinates)) {
        console.warn('Selected stop has no coordinates');
        return;
      }

      const [lng, lat] = seg.coordinates;
      results = await provider.fetchNearby({ lat, lng });

      if (provider.computeDriveTimes) {
        results = await provider.computeDriveTimes({
          lat,
          lng,
          pois: results
        });
      }
    } else if (mode === 'route') {
      const fullRoute = getFullRouteLineString(loadSegments());
      if (!fullRoute) {
        console.warn('No route geometry found');
        return;
      }

      results = await provider.fetchRouteNearby({ line: fullRoute });
      // NOTE: You *could* call computeDriveTimes here using a representative origin
    }
  } catch (err) {
    console.error('Error in runPOISearch:', err);
    results = [];
  }

  renderPOIResults(provider, results || []);
}

function renderPOIResults(provider, list) {
  updatePOITable(provider, list);
  addPOIMarkers(provider, list);
}

// ===========================================================
// GENERIC TABLE RENDERING
// ===========================================================

function updatePOITable(provider, rows) {
  const tbody = document.querySelector('#poi-table tbody');
  const thead = document.querySelector('#poi-table thead');

  tbody.innerHTML = '';
  thead.innerHTML = '';

  // Build dynamic header row
  const headerRow = document.createElement('tr');

  // Always include “Add Stop”
  const addStopTh = document.createElement('th');
  addStopTh.textContent = '';
  headerRow.appendChild(addStopTh);

  // Provider-defined columns
  provider.tableColumns.forEach((col) => {
    const th = document.createElement('th');
    th.textContent = col.label;
    headerRow.appendChild(th);
  });

  // Optional visited column
  if (provider.enableVisited) {
    const th = document.createElement('th');
    th.textContent = 'Visited';
    headerRow.appendChild(th);
  }

  thead.appendChild(headerRow);

  // Handle empty rows
  if (!rows.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="${provider.tableColumns.length + 2}">
        <i>No POIs found.</i>
      </td>`;
    tbody.appendChild(tr);
    return;
  }

  // Populate rows
  rows.forEach((r) => {
    const tr = document.createElement('tr');

    // Add stop button
    const addTd = document.createElement('td');
    const addBtn = document.createElement('button');
    addBtn.textContent = 'Add Stop';
    addBtn.className = 'queue-stop-btn';
    addBtn.onclick = () => queueStopFromPOI(r, provider);
    addTd.appendChild(addBtn);
    tr.appendChild(addTd);

    // Provider-defined columns
    provider.tableColumns.forEach((col) => {
      const td = document.createElement('td');
      td.textContent = col.get(r) ?? '';
      tr.appendChild(td);
    });

    // Visited column
    if (provider.enableVisited) {
      const td = document.createElement('td');
      const btn = document.createElement('button');
      btn.className = 'visit-btn';
      btn.textContent = provider.isVisited(r) ? '✓' : 'Mark';

      btn.onclick = async (e) => {
        e.stopPropagation();
        await provider.updateVisited(r);
        if (provider.loadVisited) await provider.loadVisited();
        updatePOITable(provider, rows);
      };

      td.appendChild(btn);
      tr.appendChild(td);

      if (provider.isVisited(r)) {
        tr.classList.add('visited');
      }
    }

    tbody.appendChild(tr);
  });
}

// ===========================================================
// GENERIC MARKERS
// ===========================================================

function clearPOIMarkers() {
  poiMarkers.forEach((m) => m.remove());
  poiMarkers = [];
}

function addPOIMarkers(provider, list) {
  clearPOIMarkers();

  if (!Array.isArray(list) || !list.length) return;

  list.forEach((r) => {
    const [lng, lat] = provider.getLatLng(r) || [];
    if (lng == null || lat == null) return;

    const marker = new mapboxgl.Marker({
      color: provider.iconColor || '#0088ff'
    })
      .setLngLat([lng, lat])
      .setPopup(
        new mapboxgl.Popup({ offset: 24 }).setHTML(
          provider.markerPopupHTML
            ? provider.markerPopupHTML(r)
            : `<strong>${provider.getName(r) || 'POI'}</strong>`
        )
      )
      .addTo(mapInstance);

    poiMarkers.push(marker);
  });
}

// ===========================================================
// QUEUE STOP FROM POI (provider-aware)
// ===========================================================

async function queueStopFromPOI(poi, provider = currentPOIProvider) {
  if (!provider) {
    console.warn('No provider for queueStopFromPOI');
    return;
  }

  let segs = loadSegments();
  // create queued stop at index 0 (your existing logic)
  queueStop(segs);
  const seg = segs[0];

  const [lng, lat] = provider.getLatLng(poi) || [];

  seg.name = provider.getQueueName
    ? provider.getQueueName(poi)
    : provider.getName(poi) || '(untitled)';

  seg.location_name = seg.name;
  seg.coordinates = [lng, lat];

  if (!Array.isArray(seg.items)) seg.items = [];

  try {
    seg.timeZone = await getTimeZone(seg.coordinates);
  } catch (err) {
    console.warn('Timezone lookup failed:', err);
  }

  saveSegments(segs);
  renderTimeline(syncGlobal());
  renderMap(syncGlobal());

  return seg;
}

function formatTime(mins) {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${h}h ${m}m`;
}
