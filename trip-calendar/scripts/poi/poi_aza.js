// ===========================================================
// STATE
// ===========================================================

// These are used by the AZA provider; harmless for others.
let visitedAZAs = new Set();

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

// ===========================================================
// AZA PROVIDER (uses your existing edges + schema)
// ===========================================================

const AZAProvider = {
  name: 'AZA Zoos',
  iconColor: '#0088ff',

  tableColumns: [
    { key: 'Name', label: 'Name', get: (r) => r.ZooName || r.Name },
    { key: 'City', label: 'City', get: (r) => r.City },
    { key: 'State', label: 'State', get: (r) => r.State },
    {
      key: 'Time',
      label: 'Drive Time',
      get: (r) => (r.drive_time_min ? formatTime(r.drive_time_min) : '')
    },
    {
      key: 'Dist',
      label: 'Distance',
      get: (r) => (r.drive_distance_mi ? r.drive_distance_mi.toFixed(1) : '')
    }
  ],

  enableVisited: true, // tells renderer to add visited column

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
          radius_miles: 60
        })
      });
      const json = await res.json();
      const list = json.results || [];
      console.log('AZA within 60 miles of route:', list.length);
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
