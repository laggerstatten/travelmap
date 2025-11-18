
//let mapReady = false; //moving to index.html
//let pendingSegments = null;

function initMap() {
  mapInstance = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [-98.5, 39.8],
    zoom: 3
  });

  mapInstance.addControl(new mapboxgl.NavigationControl(), 'top-left');

  mapInstance.on('load', () => {
    mapInstance.addSource('stops', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });

    mapInstance.addLayer({
      id: 'stops-layer',
      type: 'circle',
      source: 'stops',
      paint: {
        'circle-radius': 6,
        'circle-color': '#e63946',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff'
      }
    });

    mapInstance.addSource('drives', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });

    mapInstance.addLayer({
      id: 'drives-layer',
      type: 'line',
      source: 'drives',
      paint: {
        'line-width': 4,
        'line-color': '#457b9d'
      }
    });

    mapReady = true;

    if (pendingSegments) { // this seems to be a global
      renderMap(pendingSegments);
      pendingSegments = null;
    }
  });
}

function renderMap(segs) {
  if (!mapInstance || !mapReady) {
    pendingSegments = segs; // not sure where this gets used
    return;
  }

  const stopFeatures = [];
  const driveFeatures = [];

  for (let seg of segs) {
    if (
      seg.type === 'trip_start' ||
      seg.type === 'trip_end' ||
      seg.type === 'stop'
    ) {
      if (Array.isArray(seg.coordinates)) {
        stopFeatures.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: seg.coordinates },
          properties: { id: seg.id, name: seg.name }
        });
      }
    }

    if (seg.type === 'drive') {
      const geom = seg.routeGeometry;
      if (geom?.type === 'LineString' && Array.isArray(geom.coordinates)) {
        driveFeatures.push({
          type: 'Feature',
          geometry: geom,
          properties: { id: seg.id }
        });
      }
    }
  }

  mapInstance.getSource('stops').setData({
    type: 'FeatureCollection',
    features: stopFeatures
  });

  mapInstance.getSource('drives').setData({
    type: 'FeatureCollection',
    features: driveFeatures
  });

  const all = [...stopFeatures, ...driveFeatures];
  /**
    if (all.length > 0) {
      const bbox = turf.bbox({ type: 'FeatureCollection', features: all });
      if (bbox[0] !== bbox[2] || bbox[1] !== bbox[3]) {
        mapInstance.fitBounds(bbox, { padding: 40, maxZoom: 12, duration: 0 }); // may need to increase this
      }
    }
  */

  if (all.length > 0) {
    const fc = { type: 'FeatureCollection', features: all };

    // e.g. 100 km buffer around everything
    const buffered = turf.buffer(fc, 100, { units: 'kilometers' });
    const bbox = turf.bbox(buffered);

    if (bbox[0] !== bbox[2] || bbox[1] !== bbox[3]) {
      mapInstance.fitBounds(bbox, {
        padding: 40,      // now just a little visual cushion
        maxZoom: 12,
        duration: 0,
      });
    }
  }

}
