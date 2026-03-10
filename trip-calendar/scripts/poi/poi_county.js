// ===========================================================
// STATE
// ===========================================================

// Global caches for county POIs
let countySupabaseRows = [];
let countyPointFeatures = [];
let countyPolygonFeatures = [];
let countyAllGeometry = [];
let countyMerged = [];

// ===========================================================
// HELPERS USED BY COUNTY PROVIDER
// ===========================================================

async function county_loadSupabaseRows() {
  const { data, error } = await supabase
    .from('county_poi')
    .select('*', { count: 'exact' })
    .range(0, 4999);

  if (error) {
    console.error('County Supabase error:', error);
    return [];
  }
  return data;
}

function parseNextLink(linkHeader) {
  if (!linkHeader) return null;
  const links = linkHeader.split(',');
  for (const link of links) {
    if (link.includes('rel="next"')) {
      const match = link.match(/<(.*?)>/);
      return match && match[1] ? match[1] : null;
    }
  }
  return null;
}

async function tilequery(tilesetId, lng, lat, radiusMeters) {
  const url =
    `https://api.mapbox.com/v4/${tilesetId}/tilequery/` +
    `${lng},${lat}.json?` +
    `radius=${radiusMeters}` +
    `&limit=50` +
    `&access_token=${MAPBOX_TOKEN}`;

  const res = await fetch(url);
  const json = await res.json();
  return json.features || [];
}

function county_mergeByGlobalID(rows, features) {
  const merged = [];

  for (const f of features) {
    const gid = cleanID(f.properties.GEOID);
    const row = rows.find(
      (r) => cleanID(r.GEOID) === gid || cleanID(r['GEOID *']) === gid
    );
    if (!row) continue;

    f.properties = { ...f.properties, ...row };
    merged.push(f);
  }

  return merged;
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

// ===========================================================
// COUNTY PROVIDER
// ===========================================================

const CountyProvider = {
  name: 'Counties',
  iconColor: '#00aa44',

  tableColumns: [
    { key: 'Name', label: 'Name', get: (r) => r.NAME },
    { key: 'State', label: 'State', get: (r) => r.STATE_NAME }
  ],

  enableVisited: true, // tells renderer to add visited column

  async loadVisited() {
    if (!USER_ID) {
      console.warn('No logged-in user — skipping COUNTY loadVisited');
      visitedCounty = new Set();
      return visitedCounty;
    }

    try {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        console.warn('No Supabase session/token — skipping COUNTY loadVisited');
        visitedCounty = new Set();
        return visitedCounty;
      }

      const res = await fetch(
        'https://czuldnytepaujjkjpwqi.functions.supabase.co/get-county-visit',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ user_id: USER_ID })
        }
      );

      const json = await res.json();

      if (json && json.success && Array.isArray(json.results)) {
        visitedCounty = new Set(json.results.map((r) => r.GEOID));
      } else {
        console.warn('Unexpected response from get-county-visit:', json);
        visitedCounty = new Set();
      }

      console.log('Visited counties:', visitedCounty);
      return visitedCounty;
    } catch (err) {
      console.error('Failed to load visited:', err);
      visitedCounty = new Set();
      return visitedCounty;
    }
  },

  isVisited(poi) {
    return visitedCounty.has(poi.GEOID);
  },

  async updateVisited(poi) {
    try {
      const res = await fetch(UPDATE_COUNTY_VISIT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: USER_ID,
          county_id: poi.GEOID
        })
      });
      const json = await res.json();
      console.log('Updated visit:', json);
    } catch (err) {
      console.error('Failed to update visit:', err);
    }
  },

  // ------------------------------------------------------
  // FILTER NEAR A POINT
  // ------------------------------------------------------
  async fetchNearby({ lat, lng }) {
    if (!countySupabaseRows.length) {
      console.warn('Missing Supabase rows');
      return [];
    }

    // Search radius (500 miles)
    const radiusMeters = 500 * 1609.34;

    // Query polygon and point tilesets
    const polyFeatures = await tilequery(
      'ericschall.bbplizzd',
      lng,
      lat,
      radiusMeters
    );

    const allFeatures = [...polyFeatures];

    const nearby = [];

    for (const feat of allFeatures) {
      const gid = cleanID(feat.properties?.GlobalID);
      if (!gid) continue;

      const row = countySupabaseRows.find(
        (r) => cleanID(r.GlobalID) === gid || cleanID(r['GlobalID *']) === gid
      );
      if (!row) continue;

      nearby.push({
        ...row,
        _geometry: feat.geometry,
        _centroid: [feat.geometry.coordinates[0], feat.geometry.coordinates[1]],
        distance_m: feat.properties.tilequery.distance
      });
    }

    nearby.sort((a, b) => a.distance_m - b.distance_m);
    return nearby;
  },

  // ===========================================================
  //  DISTANCE HELPERS (same math as your Deno edge function)
  // ===========================================================

  async fetchRouteNearby({ line }) {
    const R_MI = 3958.8;

    function haversine(lat1, lon1, lat2, lon2) {
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const r1 = (lat1 * Math.PI) / 180;
      const r2 = (lat2 * Math.PI) / 180;

      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(r1) * Math.cos(r2) * Math.sin(dLon / 2) ** 2;

      return 2 * R_MI * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function toVec(lat, lon) {
      lat *= Math.PI / 180;
      lon *= Math.PI / 180;
      return [
        Math.cos(lat) * Math.cos(lon),
        Math.cos(lat) * Math.sin(lon),
        Math.sin(lat)
      ];
    }

    function pointToSegmentDistance(lat, lon, A, B) {
      const P = toVec(lat, lon);
      const A3 = toVec(A[1], A[0]);
      const B3 = toVec(B[1], B[0]);

      const AB = [B3[0] - A3[0], B3[1] - A3[1], B3[2] - A3[2]];
      const AP = [P[0] - A3[0], P[1] - A3[1], P[2] - A3[2]];
      const ab2 = AB[0] ** 2 + AB[1] ** 2 + AB[2] ** 2;

      // Segment is a point
      if (ab2 === 0) return haversine(lat, lon, A[1], A[0]);

      const t = Math.max(
        0,
        Math.min(1, (AP[0] * AB[0] + AP[1] * AB[1] + AP[2] * AB[2]) / ab2)
      );

      const C = [A3[0] + AB[0] * t, A3[1] + AB[1] * t, A3[2] + AB[2] * t];

      const hyp = Math.sqrt(C[0] ** 2 + C[1] ** 2);
      const latC = (Math.atan2(C[2], hyp) * 180) / Math.PI;
      const lonC = (Math.atan2(C[1], C[0]) * 180) / Math.PI;

      return haversine(lat, lon, latC, lonC);
    }

    function distanceToLineString(lat, lon, coords) {
      let best = Infinity;
      for (let i = 0; i < coords.length - 1; i++) {
        const d = pointToSegmentDistance(lat, lon, coords[i], coords[i + 1]);
        if (d < best) best = d;
      }
      return best;
    }

    if (!line || !line.coordinates) return [];
    if (!countySupabaseRows.length) return [];

    const coords = line.coordinates;
    const corridorMiles = .1; // ← THIS IS YOUR FILTER DISTANCE
    const sampleCount = 20; // ← YOU ALREADY USE THIS -- this seems too low, as the route has already been downsampled previously -- changing from 5 to 20
    const samples = downsampleCoordinates(coords, sampleCount);

    console.log('Route sample points:', samples.length);

    const collected = new Map();

    // ============================
    // 5 TILEQUERY CALLS ONLY
    // (You already have the endpoints)
    // ============================
    for (const [lng, lat] of samples) {

      const polys = await tilequery(
        'ericschall.bbplizzd',
        lng,
        lat,
        corridorMiles * 1609.34
      );

      for (const feat of [...polys]) {
        const gid = cleanID(feat.properties?.GEOID);
        if (!gid) continue;
        if (!collected.has(gid)) collected.set(gid, feat);
      }
    }

    console.log('Tilequery raw collected:', collected.size);

    // ===========================================================
    // TRUE LINESTRING CORRIDOR FILTERING (same as your Deno logic)
    // ===========================================================
    const final = [];

    for (const feat of collected.values()) {
      if (!feat.geometry) continue;

      let centroid;
      if (feat.geometry.type === 'Point') {
        centroid = feat.geometry.coordinates;
      } else {
        try {
          centroid = turf.centroid(feat).geometry.coordinates;
        } catch {
          continue;
        }
      }

      const [lng, lat] = centroid;

      // Real distance (mile radius)
      const distMiles = distanceToLineString(lat, lng, coords);
      if (distMiles > corridorMiles) continue;

      // match with Supabase row
      const gid = cleanID(feat.properties.GEOID);
      const row = countySupabaseRows.find((r) => cleanID(r.GEOID) === gid);
      if (!row) continue;

      final.push({
        ...row,
        _geometry: feat.geometry,
        _centroid: centroid,
        distance_m: distMiles * 1609.34
      });
    }

    final.sort((a, b) => a.distance_m - b.distance_m);

    console.log('Final route-matched POIs:', final.length);
    return final;
  },

  getLatLng(poi) {
    if (poi._centroid) return poi._centroid;
    return [poi.lng || null, poi.lat || null];
  },

  getName(poi) {
    return poi.NAME || '(County)';
  },

  getQueueName(poi) {
    return this.getName(poi);
  },



  getState(poi) {
    return poi.State || '';
  },

  markerPopupHTML(poi) {
    const miles =
      poi.distance_m != null
        ? (poi.distance_m / 1609.34).toFixed(1) + ' mi'
        : '';

    return `
      <strong>${this.getName(poi)}</strong><br/>
      ${this.getState(poi)}<br/>
      ${miles}
    `;
  }
};

// ===========================================================
// INIT MUST COME LAST — AFTER CountyProvider EXISTS
// ===========================================================

CountyProvider.init = async function () {
  console.log('CountyProvider: initializing (tileset mode)…');

  // 1. Load Supabase records ONCE (attributes only)
  countySupabaseRows = await county_loadSupabaseRows();
  console.log('County Supabase rows:', countySupabaseRows.length);

  // 2. DO NOT LOAD MAPBOX DATASETS ANYMORE
  //    tilequery loads geometry dynamically based on the user's location/route

  countyAllGeometry = []; // legacy datasets disabled
  countyMerged = []; // merged only exists for dataset mode

  console.log('CountyProvider ready (tileset mode).');
};
