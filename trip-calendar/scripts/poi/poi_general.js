// ===========================================================
// STATE
// ===========================================================
let poiMarkers = [];
let currentPOIProvider = null;

// These are used by the AZA provider; harmless for others.
let visitedAZAs = new Set();

// Optional shared caches for rec sites etc.
let recSupabaseRows = []; // attributes
let recAllGeometry = []; // geometry from Mapbox (joined by GlobalID)

// ===========================================================
// UTILS
// ===========================================================

function cleanID(id) {
  if (!id) return '';
  return id.replace(/[{}]/g, '').trim().toUpperCase();
}

// Downsample a LineString to avoid huge matrix calls
function downsampleCoordinates(coords, maxPoints) {
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
  if (!tbody) {
    console.warn('No #poi-table tbody found');
    return;
  }
  tbody.innerHTML = '';

  if (!rows || rows.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="7"><i>No POIs found within range.</i></td>`;
    tbody.appendChild(tr);
    return;
  }

  rows.forEach((r) => {
    const tr = document.createElement('tr');

    // row class for visited if provider supports it
    if (provider.isVisited && provider.isVisited(r)) {
      tr.classList.add('visited');
    }

    const driveTimeMin = r.drive_time_min ?? null;
    const hours = driveTimeMin != null ? Math.floor(driveTimeMin / 60) : null;
    const mins = driveTimeMin != null ? Math.round(driveTimeMin % 60) : null;
    const timeLabel = driveTimeMin != null ? `${hours}h ${mins}m` : '';

    const distanceLabel =
      r.drive_distance_mi != null ? r.drive_distance_mi.toFixed(1) : '';

    tr.innerHTML = `
      <td><button class="queue-stop-btn">Add Stop</button></td>
      <td>${provider.getName(r) || '(unnamed POI)'}</td>
      <td>${provider.getCity ? provider.getCity(r) : ''}</td>
      <td>${provider.getState ? provider.getState(r) : ''}</td>
      <td>${timeLabel}</td>
      <td>${distanceLabel}</td>
      <td>
        ${
          provider.updateVisited
            ? `<button class="visit-btn">${
                provider.isVisited && provider.isVisited(r)
                  ? '✓'
                  : 'Mark Visited'
              }</button>`
            : ''
        }
      </td>
    `;

    // queue stop from POI
    const addBtn = tr.querySelector('.queue-stop-btn');
    addBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await queueStopFromPOI(r, provider);
    });

    // visited handling
    if (provider.updateVisited) {
      const visitBtn = tr.querySelector('.visit-btn');
      visitBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await provider.updateVisited(r);
        // reload visited state if needed
        if (provider.loadVisited) await provider.loadVisited();
        updatePOITable(provider, rows);
      });
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

// ===========================================================
// AZA PROVIDER (uses your existing edges + schema)
// ===========================================================

const AZAProvider = {
  name: 'AZA Zoos',
  iconColor: '#0088ff',

  async loadVisited() {
    if (!USER_ID) {
      console.warn('No logged-in user — skipping AZA loadVisited');
      visitedAZAs = new Set();
      return visitedAZAs;
    }

    try {
      const res = await fetch(GET_USER_VISITS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: USER_ID })
      });

      const json = await res.json();

      if (json && json.success && Array.isArray(json.results)) {
        visitedAZAs = new Set(json.results.map((r) => r.aza_id));
      } else {
        console.warn('Unexpected response from get-user-visits:', json);
        visitedAZAs = new Set();
      }

      console.log('Visited zoos:', visitedAZAs);
      return visitedAZAs;
    } catch (err) {
      console.error('Failed to load visited:', err);
      visitedAZAs = new Set();
      return visitedAZAs;
    }
  },

  isVisited(poi) {
    return visitedAZAs.has(poi.aza_id);
  },

  async updateVisited(poi) {
    try {
      const res = await fetch(UPDATE_AZA_VISIT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: USER_ID,
          aza_id: poi.aza_id
        })
      });
      const json = await res.json();
      console.log('Updated visit:', json);
    } catch (err) {
      console.error('Failed to update visit:', err);
    }
  },

  async fetchNearby({ lat, lng }) {
    try {
      const res = await fetch(GET_NEAR_AZA_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          lat,
          lng,
          radius_miles: 500
        })
      });
      const json = await res.json();
      const list = json.results || [];
      console.log('AZA within 500 miles:', list.length);
      return list;
    } catch (err) {
      console.error('Error retrieving AZA:', err);
      return [];
    }
  },

  async fetchRouteNearby({ line }) {
    try {
      const res = await fetch(GET_NEAR_AZA_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          lineString: line,
          radius_miles: 200
        })
      });
      const json = await res.json();
      const list = json.results || [];
      console.log('AZA within 200 miles of route:', list.length);
      return list;
    } catch (err) {
      console.error('Error retrieving AZA along route:', err);
      return [];
    }
  },

  async computeDriveTimes({ lat, lng, pois }) {
    if (!pois.length) return pois;

    const batchSize = 5;
    const allResults = [];

    for (let i = 0; i < pois.length; i += batchSize) {
      const batch = pois.slice(i, i + batchSize);
      const coordsStr = [lng + ',' + lat]
        .concat(batch.map((r) => `${r.CenterPointLong},${r.CenterPointLat}`))
        .join(';');

      const matrixUrl = `https://api.mapbox.com/directions-matrix/v1/mapbox/driving/${coordsStr}?annotations=duration,distance&access_token=${MAPBOX_TOKEN}`;

      try {
        const matrixRes = await fetch(matrixUrl);
        const matrixJson = await matrixRes.json();

        if (matrixJson.durations && matrixJson.durations[0]) {
          const durations = matrixJson.durations[0].slice(1);
          const distances = matrixJson.distances[0].slice(1);

          batch.forEach((r, idx) => {
            r.drive_time_min = durations[idx] / 60;
            r.drive_distance_mi = distances[idx] / 1609.34;
          });
        }

        allResults.push(...batch);
        
        await new Promise((res) => setTimeout(res, 250));
      } catch (err) {
        console.error(`AZA matrix batch ${i / batchSize + 1} failed:`, err);
      }
    }

    allResults.sort(
      (a, b) => (a.drive_time_min || 0) - (b.drive_time_min || 0)
    );
    return allResults;
  },

  getLatLng(poi) {
    if (poi.CenterPointLong != null && poi.CenterPointLat != null) {
      return [poi.CenterPointLong, poi.CenterPointLat];
    }
    return [null, null];
  },

  getName(poi) {
    return poi.ZooName || poi.Name || '(AZA Facility)';
  },

  getQueueName(poi) {
    return this.getName(poi);
  },

  getCity(poi) {
    return poi.City || '';
  },

  getState(poi) {
    return poi.State || '';
  },

  markerPopupHTML(poi) {
    return `
      <strong>${this.getName(poi)}</strong><br/>
      ${this.getCity(poi)}, ${this.getState(poi)}<br/>
      ${poi.drive_time_min ? `${poi.drive_time_min.toFixed(0)} min` : ''}
    `;
  }
};

// ===========================================================
// RECREATION PROVIDER (example stub for non-geometry-in-Supabase case)
// ===========================================================
//
// This assumes you have a backend/edge function that returns
// POIs with geometry, OR that you've already joined Supabase
// + Mapbox and have recSupabaseRows/recAllGeometry populated.
// Adjust as needed.
//

const RecProvider = {
  name: 'Recreation Sites',
  iconColor: '#00aa44',

  // If you're using Supabase+Mapbox join, you may not need
  // remote fetch here; you can filter recSupabaseRows and
  // merge with recAllGeometry client-side.

  async fetchNearby({ lat, lng }) {
    // TODO: implement your rec-site logic
    // For now, just return empty to avoid breaking things.
    console.warn('RecProvider.fetchNearby not implemented yet');
    return [];
  },

  async fetchRouteNearby({ line }) {
    console.warn('RecProvider.fetchRouteNearby not implemented yet');
    return [];
  },

  getLatLng(poi) {
    // If your joined rec POIs have geometry attached:
    // return poi._coordinates || [lng, lat]
    return [poi.lng || null, poi.lat || null];
  },

  getName(poi) {
    return poi.Name || poi.UnitLabel || '(Recreation Site)';
  },

  getQueueName(poi) {
    return this.getName(poi);
  },

  getCity(poi) {
    return poi.City || '';
  },

  getState(poi) {
    return poi.State || '';
  },

  markerPopupHTML(poi) {
    return `
      <strong>${this.getName(poi)}</strong><br/>
      ${this.getCity(poi)}, ${this.getState(poi)}
    `;
  }
};

// ===========================================================
// INIT: choose a default provider
// ===========================================================

// For now, default to AZA; you can switch via UI later:
setPOIProvider(AZAProvider);

// Example: if you add a provider dropdown in UI,
// you can call setPOIProvider(AZAProvider) or setPOIProvider(RecProvider)
// based on user choice.
