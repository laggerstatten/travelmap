// ===========================================================
// STATE
// ===========================================================

// Global caches for recreation POIs
let recSupabaseRows = [];
let recPointFeatures = [];
let recPolygonFeatures = [];
let recAllGeometry = [];
let recMerged = [];

// ===========================================================
// HELPERS USED BY REC PROVIDER
// ===========================================================

async function rec_loadSupabaseRows() {
  const { data, error } = await supabase
    .from('fedplace_combined')
    .select('*', { count: 'exact' })
    .range(0, 4999);

  if (error) {
    console.error('Rec Supabase error:', error);
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

function rec_mergeByGlobalID(rows, features) {
  const merged = [];

  for (const f of features) {
    const gid = cleanID(f.properties.GlobalID);
    const row = rows.find(
      (r) => cleanID(r.GlobalID) === gid || cleanID(r['GlobalID *']) === gid
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
// RECREATION PROVIDER
// ===========================================================

const RecProvider = {
  name: 'Recreation Sites',
  iconColor: '#00aa44',

  tableColumns: [
    { key: 'Name', label: 'Name', get: (r) => r.UnitLabel },
    { key: 'Name1', label: 'Name1', get: (r) => r.Unit1Label },
    { key: 'Name2', label: 'Name2', get: (r) => r.Unit2Label },
    { key: 'ShortLabel', label: 'ShortLabel', get: (r) => r.ShortLabel },
    { key: 'Agency', label: 'Agency', get: (r) => r.Agency }
  ],

  // ------------------------------------------------------
  // FILTER NEAR A POINT
  // ------------------------------------------------------
  async fetchNearby({ lat, lng }) {
    if (!recSupabaseRows.length) {
      console.warn('Missing Supabase rows');
      return [];
    }

    // Search radius (500 miles)
    const radiusMeters = 500 * 1609.34;

    // Query polygon and point tilesets
    const polyFeatures = await tilequery(
      'ericschall.cmi8i31ua5qx71npejrqno0oc-489b6',
      lng,
      lat,
      radiusMeters
    );
    const pointFeatures = await tilequery(
      'ericschall.cmi95pb28082r1oqn30xsfev5-9vxf6',
      lng,
      lat,
      radiusMeters
    );

    const allFeatures = [...polyFeatures, ...pointFeatures];

    const nearby = [];

    for (const feat of allFeatures) {
      const gid = cleanID(feat.properties?.GlobalID);
      if (!gid) continue;

      const row = recSupabaseRows.find(
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

  // ------------------------------------------------------
  // FILTER NEAR A ROUTE
  // ------------------------------------------------------

  /**
    async fetchRouteNearby({ line }) {
      if (!line || !line.coordinates) return [];
      if (!recSupabaseRows.length) return [];
  
      const coords = line.coordinates;
  
      // --- 1. Compute route centroid ---
      const ls = turf.lineString(coords);
      const centroid = turf.centroid(ls).geometry.coordinates;
  
      // --- 2. Compute max distance from centroid to route ---
      let maxDistMeters = 0;
      for (const c of coords) {
        const d = turf.distance(centroid, c, { units: 'kilometers' }) * 1000;
        if (d > maxDistMeters) maxDistMeters = d;
      }
  
      // --- 3. Add corridor buffer ---
      const corridorMeters = 60 * 1609.34; // 50 miles
      const queryRadius = maxDistMeters;
  
      console.log('Tilequery radius:', (queryRadius / 1609.34).toFixed(1), 'mi');
  
      // --- 4. Single tilequery call for points ---
      const pts = await tilequery(
        'ericschall.cmi95pb28082r1oqn30xsfev5-9vxf6',
        centroid[0],
        centroid[1],
        queryRadius
      );
  
      // --- 5. Single tilequery call for polygons ---
      const polys = await tilequery(
        'ericschall.cmi8i31ua5qx71npejrqno0oc-489b6',
        centroid[0],
        centroid[1],
        queryRadius
      );
  
      // Merge features by GlobalID
      const candidates = [...pts, ...polys];
      console.log('Rec route candidates:', candidates);
      // --- 6. Local filtering on frontend (cheap) ---
      const results = [];
  
      for (const feat of candidates) {
        const gid = cleanID(feat.properties?.GlobalID);
        if (!gid) continue;
  
        const row = recSupabaseRows.find((r) => cleanID(r.GlobalID) === gid);
        if (!row) continue;
  
        // point distance to line corridor
        const distMeters = turf.pointToLineDistance(
          turf.point(feat.geometry.coordinates),
          line,
          { units: 'meters' }
        );
  
        if (distMeters <= corridorMeters) {
          results.push({
            ...row,
            _geometry: feat.geometry,
            _centroid: feat.geometry.coordinates,
            distance_m: distMeters
          });
        }
      }
  
      return results.sort((a, b) => a.distance_m - b.distance_m);
    },
  */

  /**
    async fetchRouteNearby({ line }) {
      if (!line || !line.coordinates) return [];
      if (!recSupabaseRows.length) return [];
  
      const coords = line.coordinates;
      const lineLength = turf.length(
        { type: 'LineString', coordinates: coords },
        { units: 'miles' }
      );
  
      // ------------------------------------------------------
      // SMART SAMPLING: 5 points total
      //   - start, 3 equally spaced interior points, end
      // ------------------------------------------------------
      const sampleCount = 5;
      const samples = [];
  
      for (let i = 0; i < sampleCount; i++) {
        const t = i / (sampleCount - 1);
        const along = turf.along(
          { type: 'LineString', coordinates: coords },
          lineLength * t,
          { units: 'miles' }
        );
        samples.push(along.geometry.coordinates);
      }
  
      console.log('Route sample points:', samples.length);
  
      const searchMiles = 500;
      const searchMeters = searchMiles * 1609.34;
  
      const results = new Map();
  
      // ------------------------------------------------------
      // TILESET IDS (YOUR published tilesets)
      // ------------------------------------------------------
      const POINT_TILESET = 'ericschall.cmi95pb28082r1oqn30xsfev5-9vxf6';
      const POLY_TILESET = 'ericschall.cmi8i31ua5qx71npejrqno0oc-489b6';
  
      // ------------------------------------------------------
      // QUERY LOOP — 10 queries total (5 points × 2 tilesets)
      // ------------------------------------------------------
      for (const [lng, lat] of samples) {
        const pRes = await tilequery(POINT_TILESET, lng, lat, searchMeters);
        const gRes = await tilequery(POLY_TILESET, lng, lat, searchMeters);
  
        for (const feat of [...pRes, ...gRes]) {
          const gid = cleanID(feat.properties?.GlobalID);
          if (!gid) continue;
  
          // Dedup by GlobalID
          if (!results.has(gid)) {
            results.set(gid, feat);
          }
        }
      }






    console.log('Raw tilequery merged features:', results.size);

    // ------------------------------------------------------
    // MERGE WITH SUPABASE ROWS
    // ------------------------------------------------------
    const merged = [];

    for (const feat of results.values()) {
      const gid = cleanID(feat.properties.GlobalID);

      const row = recSupabaseRows.find((r) => cleanID(r.GlobalID) === gid);
      if (!row) continue;

      merged.push({
        ...row,
        _geometry: feat.geometry,
        _centroid:
          feat.geometry.type === 'Point'
            ? feat.geometry.coordinates
            : turf.centroid(feat).geometry.coordinates,
        distance_m: feat.properties.tilequery.distance
      });
    }

    // Sort by distance
    merged.sort((a, b) => a.distance_m - b.distance_m);

    console.log('Final merged POIs:', merged.length);

    return merged;
  },  */

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
    if (!recSupabaseRows.length) return [];

    const coords = line.coordinates;
    const corridorMiles = 120    ; // ← THIS IS YOUR FILTER DISTANCE
    const sampleCount = 5; // ← YOU ALREADY USE THIS
    const samples = downsampleCoordinates(coords, sampleCount);

    console.log('Route sample points:', samples.length);

    const collected = new Map();

    // ============================
    // 5 TILEQUERY CALLS ONLY
    // (You already have the endpoints)
    // ============================
    for (const [lng, lat] of samples) {
      const pts = await tilequery(
        'ericschall.cmi95pb28082r1oqn30xsfev5-9vxf6',
        lng,
        lat,
        corridorMiles * 1609.34 // meters
      );

      const polys = await tilequery(
        'ericschall.cmi8i31ua5qx71npejrqno0oc-489b6',
        lng,
        lat,
        corridorMiles * 1609.34
      );

      for (const feat of [...pts, ...polys]) {
        const gid = cleanID(feat.properties?.GlobalID);
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
      const gid = cleanID(feat.properties.GlobalID);
      const row = recSupabaseRows.find((r) => cleanID(r.GlobalID) === gid);
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
    const miles =
      poi.distance_m != null
        ? (poi.distance_m / 1609.34).toFixed(1) + ' mi'
        : '';

    return `
      <strong>${this.getName(poi)}</strong><br/>
      ${this.getCity(poi)}, ${this.getState(poi)}<br/>
      ${miles}
    `;
  }
};

// ===========================================================
// INIT MUST COME LAST — AFTER RecProvider EXISTS
// ===========================================================

RecProvider.init = async function () {
  console.log('RecProvider: initializing (tileset mode)…');

  // 1. Load Supabase records ONCE (attributes only)
  recSupabaseRows = await rec_loadSupabaseRows();
  console.log('Rec Supabase rows:', recSupabaseRows.length);

  // 2. DO NOT LOAD MAPBOX DATASETS ANYMORE
  //    tilequery loads geometry dynamically based on the user's location/route

  recAllGeometry = []; // legacy datasets disabled
  recMerged = []; // merged only exists for dataset mode

  console.log('RecProvider ready (tileset mode).');
};
