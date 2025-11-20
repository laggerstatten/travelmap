let poiMarkers = [];

function updateStopDropdown(list) {
  const select = document.getElementById('poi-stop-select');
  select.innerHTML = '';
  let segments = [...list];
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

async function runPOISearch() {
  const mode = document.getElementById('poi-source').value;

  await loadVisited(); // needed for visited flags

  if (mode === 'center') {
    const c = mapInstance.getCenter();
    fetchPOI(c.lat, c.lng);
  } else if (mode === 'stop') {
    const stopId = document.getElementById('poi-stop-select').value;
    const seg = loadSegments().find((s) => s.id === stopId);
    fetchPOI(seg.coordinates[1], seg.coordinates[0]);
  } else if (mode === 'route') {
    const fullRoute = getFullRouteLineString(loadSegments());
    fetchPOIRoute(fullRoute);
  }
}

async function loadVisited() {
  if (!USER_ID) {
    console.warn('No logged-in user — skipping loadVisited');
    visitedPOIs = new Set();
    return visitedPOIs;
  }

  try {
    var res = await fetch(GET_USER_VISITS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: USER_ID })
    });

    var json = await res.json();

    if (json && json.success && Array.isArray(json.results)) {
      visitedPOIs = new Set(
        json.results.map(function (r) {
          return r.aza_id; //FIXME confirm field name
        })
      );
    } else {
      console.warn('Unexpected response from get-user-visits:', json);
      visitedPOIs = new Set();
    }

    console.log('Visited POIs:', visitedPOIs);
    return visitedPOIs;
  } catch (err) {
    console.error('Failed to load visited:', err);
    visitedPOIs = new Set();
    return visitedPOIs;
  }
}

async function markVisited(aza_id) {
  // --- Mark zoo as visited ---
  try {
    const res = await fetch(UPDATE_POI_VISIT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ //TODO add more parameters
        user_id: USER_ID,
        aza_id
      })
    });
    const json = await res.json();
    console.log('Updated visit:', json);
  } catch (err) {
    console.error('Failed to update visit:', err);
  }
}

async function fetchPOI(lat, lng) {
  // --- FETCH POI WITHIN 500 MILES ---
  try {
    const res = await fetch(GET_NEAR_POI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ //TODO add more parameters
        lat: lat,
        lng: lng,
        radius_miles: 500
      })
    });
    const json = await res.json();
    const resultList = json.results || [];

    fetchPOIMatrix(resultList, lng, lat);

  } catch (err) {
    console.error('Error retrieving POI or drive times:', err);
  }
}

async function fetchPOIRoute(lineString) {
  // note the smaller search radius
  // --- FETCH POI WITHIN 200 MILES ---
  try {
    const res = await fetch(GET_NEAR_POI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ //TODO add more parameters
        lineString: lineString,
        radius_miles: 200
      })
    });
    const json = await res.json();
    const resultList = json.results || [];

    updateAZATable(resultList);
    addAZAMarkers(resultList);
  } catch (err) {
    console.error('Error retrieving POI or drive times:', err);
  }
}

async function fetchPOIMatrix(resultList, lng, lat) {
  // --- MATRIX API CALL ---
  if (resultList.length > 0) {
    // Define batch size (max 24 destinations per request)
    const batchSize = 5;
    const allResults = [];

    // Split into batches
    for (let i = 0; i < resultList.length; i += batchSize) {
      const batch = resultList.slice(i, i + batchSize);
      const coordsStr = [lng + ',' + lat]
        .concat(batch.map((r) => `${r.CenterPointLong},${r.CenterPointLat}`)) //TODO standardize lat/lon naming
        .join(';');

      const matrixUrl = `https://api.mapbox.com/directions-matrix/v1/mapbox/driving/${coordsStr}?annotations=duration,distance&access_token=${MAPBOX_TOKEN}`;

      try {
        const matrixRes = await fetch(matrixUrl);
        const matrixJson = await matrixRes.json();

        if (matrixJson.durations && matrixJson.durations[0]) {
          const durations = matrixJson.durations[0].slice(1);
          const distances = matrixJson.distances[0].slice(1);

          batch.forEach((r, i) => {
            r.drive_time_min = durations[i] / 60;
            r.drive_distance_mi = distances[i] / 1609.34;
          });
        }

        allResults.push(...batch);

        // (optional) delay between batches to avoid rate limiting
        await new Promise((res) => setTimeout(res, 250)); // 0.25 sec pause
      } catch (err) {
        console.error(`Matrix batch ${i / batchSize + 1} failed:`, err);
      }
    }

    // Combine and sort
    allResults.sort((a, b) => a.drive_time_min - b.drive_time_min);
    updateAZATable(allResults); //FIXME surround with if based on POI type
    addAZAMarkers(allResults); //FIXME surround with if based on POI type
  } else {
    updateAZATable([]); //FIXME surround with if based on POI type
    clearPOIMarkers();
  }
}

// render table
function updateAZATable(rows) { // MAY NEED TO MAKE VERSION FOR EACH POI TYPE
  // --- UPDATE TABLE ---
  const tbody = document.querySelector('#aza-table tbody');
  tbody.innerHTML = '';

  if (!rows || rows.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="6"><i>No AZA attractions found within range.</i></td>`;
    tbody.appendChild(tr);
    return;
  }

  rows.forEach((r) => {
    const tr = document.createElement('tr');
    if (visitedPOIs.has(r.aza_id)) tr.classList.add('visited'); //FIXME confirm field name
    const hours = Math.floor(r.drive_time_min / 60);
    const mins = Math.round(r.drive_time_min % 60);
    const timeLabel = r.drive_time_min != null ? `${hours}h ${mins}m` : '';

    tr.innerHTML = `
    <td><button class="queue-stop-btn">Add Stop</button></td>
    <td>${r.Name}</td>
    <td>${r.City}</td>
    <td>${r.State}</td>
    <td>${timeLabel}</td>
    <td>${r.drive_distance_mi ? r.drive_distance_mi.toFixed(1) : ''}</td>
    <td><button class="visit-btn">${
      visitedPOIs.has(r.aza_id) ? '✓' : 'Mark Visited' //FIXME confirm field name
    }</button></td>
  `;

    // --- Mark Visited ---
    const visitBtn = tr.querySelector('.visit-btn');
    visitBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await markVisited(r.aza_id);
      await loadVisited();
      updateAZATable(rows);
    });

    // Store destination coordinates
    tr.dataset.lon = r.CenterPointLong;
    tr.dataset.lat = r.CenterPointLat;

    tbody.appendChild(tr);

    // --- Add Stop button handler ---
    const addBtn = tr.querySelector('.queue-stop-btn');
    addBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await queueStopFromPOI(r);
    });
  });
}

async function queueStopFromPOI(poi) {
  let segs = loadSegments();

  // Create a new queued stop at index 0
  queueStop(segs);

  // Newly created stop is at segs[0]
  const seg = segs[0];

  // Apply POI attributes to match your structure
  seg.name = poi.Name || '(untitled)';
  seg.location_name = poi.Name || '(untitled)';
  seg.coordinates = [poi.CenterPointLong, poi.CenterPointLat];

  // Make sure items exists
  if (!Array.isArray(seg.items)) seg.items = [];

  try {
    seg.timeZone = await getTimeZone(seg.coordinates);
  } catch (err) {
    console.warn('Timezone lookup failed:', err);
  }

  // Save + re-render
  saveSegments(segs);
  renderTimeline(syncGlobal());
  renderMap(syncGlobal());

  return seg;
}

function getFullRouteLineString(segments, maxPoints = 40) {
  if (!Array.isArray(segments)) return null;

  // Your original logic — keep as-is
  const ordered = segments.slice().sort((a, b) => a.order - b.order);
  const fullCoords = [];

  for (const seg of ordered) {
    if (
      seg.type === 'drive' &&
      seg.routeGeometry &&
      Array.isArray(seg.routeGeometry.coordinates)
    ) {
      const coords = seg.routeGeometry.coordinates;

      // Avoid repeat point
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

  // -------------------------------
  // NEW: Downsample to prevent CPU overload
  /** @type {*} */
  const downsampled = downsampleCoordinates(fullCoords, maxPoints);

  return {
    type: 'LineString',
    coordinates: downsampled
  };
}

// Helper function (efficient)
function downsampleCoordinates(coords, maxPoints) {
  if (coords.length <= maxPoints) return coords;

  const step = Math.max(1, Math.floor(coords.length / maxPoints));
  const result = [];

  for (let i = 0; i < coords.length; i += step) {
    result.push(coords[i]);
  }

  // Ensure last point is present
  const last = coords[coords.length - 1];
  const lastR = result[result.length - 1];
  if (lastR[0] !== last[0] || lastR[1] !== last[1]) {
    result.push(last);
  }

  return result;
}

function clearPOIMarkers() {
  poiMarkers.forEach((m) => m.remove());
  poiMarkers = [];
}

function addAZAMarkers(resultList) { // MAY NEED TO MAKE VERSION FOR EACH POI TYPE
  clearPOIMarkers();

  resultList.forEach((r) => {
    if (!r.CenterPointLat || !r.CenterPointLong) return;

    const marker = new mapboxgl.Marker({ color: '#0088ff' })
      .setLngLat([r.CenterPointLong, r.CenterPointLat])
      .setPopup(
        new mapboxgl.Popup({ offset: 24 }).setHTML(`
          <strong>${r.ZooName || 'AZA Facility'}</strong><br/>
          ${r.City || ''}, ${r.State || ''}<br/>
          ${r.drive_time_min ? `${r.drive_time_min.toFixed(0)} min` : ''}
        `)
      )
      .addTo(mapInstance);

    poiMarkers.push(marker);
  });
}
