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

async function rec_loadDataset(datasetId) {
  // 1. Initial URL setup (includes token and sort)
  let nextUrl = `https://api.mapbox.com/datasets/v1/${USERNAME}/${datasetId}/features?access_token=${MAPBOX_TOKEN}&limit=100&sort=id`;

  let allFeatures = [];

  while (nextUrl) {
    // *** CRITICAL STEP: Re-inject the token if the URL is from the Link header ***
    if (!nextUrl.includes('access_token')) {
      // Check if URL already has query parameters (uses ? or &)
      const separator = nextUrl.includes('?') ? '&' : '?';

      // Re-inject the token and username into the URL
      nextUrl = nextUrl + separator + `access_token=${MAPBOX_TOKEN}`;
    }

    console.log(`Fetching features from: ${nextUrl}`);

    const res = await fetch(nextUrl);

    if (!res.ok) {
      // Include the response body for better debugging in case of 401/403 errors
      const errorBody = await res.text();
      throw new Error(
        `Mapbox API error: ${res.status} ${res.statusText}. Response body: ${errorBody}`
      );
    }

    const json = await res.json();
    const newFeatures = json.features || [];

    allFeatures = allFeatures.concat(newFeatures);

    // 1. Get the Link header
    const linkHeader = res.headers.get('Link');

    // 2. Parse the header to find the next URL
    nextUrl = parseNextLink(linkHeader);

    if (!nextUrl) {
      console.log(
        `Total collected features: ${allFeatures.length}. End of collection.`
      );
    }
  }

  return allFeatures;
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
    console.log(recAllGeometry);
    //console.log(recSupabaseRows);
    if (!recAllGeometry.length || !recSupabaseRows.length) {
      console.warn('RecProvider: missing geometry or rows');
      return [];
    }

    const origin = [lng, lat];
    const maxMeters = 500 * 1609.34;
    const nearby = [];

    for (const feat of recAllGeometry) {
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

      const d = turf.distance(origin, centroid, { units: 'kilometers' }) * 1000;
      if (d > maxMeters) continue;

      const gid = cleanID(feat.properties?.GlobalID);
      if (!gid) continue;

      const row = recSupabaseRows.find(
        (r) => cleanID(r.GlobalID) === gid || cleanID(r['GlobalID *']) === gid
      );

      if (!row) {
        const partial = recSupabaseRows.filter((r) =>
          cleanID(r.GlobalID || '').includes(gid.slice(0, 6))
        );

        const raw = recSupabaseRows.find((r) =>
          (r.GlobalID || '').includes('00F55BA0')
        );

        continue;
      }

      if (!row) continue;

      nearby.push({
        ...row,
        _geometry: feat.geometry,
        _centroid: centroid,
        distance_m: d
      });
    }

    nearby.sort((a, b) => (a.distance_m || 0) - (b.distance_m || 0));
    return nearby;
  },

  // ------------------------------------------------------
  // FILTER NEAR A ROUTE
  // ------------------------------------------------------
  async fetchRouteNearby({ line }) {
    if (!line || !line.coordinates) return [];
    if (!recAllGeometry.length || !recSupabaseRows.length) return [];

    const results = [];
    const maxMeters = 50 * 1609.34;

    for (const feat of recAllGeometry) {
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

      const distMeters = turf.pointToLineDistance(turf.point(centroid), line, {
        units: 'meters'
      });

      if (distMeters > maxMeters) continue;

      const gid = cleanID(feat.properties?.GlobalID);
      if (!gid) continue;

      const row = recSupabaseRows.find(
        (r) => cleanID(r.GlobalID) === gid || cleanID(r['GlobalID *']) === gid
      );
      if (!row) continue;

      results.push({
        ...row,
        _geometry: feat.geometry,
        _centroid: centroid,
        distance_m: distMeters
      });
    }

    results.sort((a, b) => (a.distance_m || 0) - (b.distance_m || 0));
    return results;
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
  console.log('RecProvider: initializing...');
  recSupabaseRows = await rec_loadSupabaseRows();

  recPointFeatures = await rec_loadDataset(DATASET_POINTS);
  recPolygonFeatures = await rec_loadDataset(DATASET_POLYGONS);

  const target = '00F55BA0-B9E8-4706-91A5-885F8DCBB392';

  const found = recSupabaseRows.find((r) => cleanID(r.GlobalID) === target);

  console.log(
    'CHECK SUPABASE FOR TARGET:',
    target,
    '→',
    found ? 'FOUND' : 'NOT FOUND'
  );

  if (found) {
    console.log('SUPABASE ROW:', found);
  }

  recAllGeometry = [...recPointFeatures, ...recPolygonFeatures];

  const foundFeat = recAllGeometry.find(
    (f) => cleanID(f.properties?.GlobalID) === target
  );

  console.log(
    'CHECK MAPBOX FOR TARGET:',
    target,
    '→',
    foundFeat ? 'FOUND' : 'NOT FOUND'
  );

  if (foundFeat) {
    console.log('MAPBOX FEATURE:', foundFeat);
  }

  const TARGET = 'B9E8';

  console.log('=== CHECKING FOR TARGET IN MAPBOX ===');
  recAllGeometry.forEach((f, i) => {
    const raw = f.properties?.GlobalID;
    const cleaned = cleanID(raw);

    if (
      raw?.includes(TARGET) ||
      cleaned === TARGET ||
      cleaned.includes(TARGET) ||
      raw?.replace(/[{}]/g, '') === TARGET
    ) {
      console.log('FOUND in recAllGeometry index:', i, {
        raw,
        cleaned,
        feature: f
      });
    }
  });

  console.log('=== END MAPBOX TARGET CHECK ===');

  recMerged = rec_mergeByGlobalID(recSupabaseRows, recAllGeometry);

  console.log('Rec merged:', recMerged.length);
};
