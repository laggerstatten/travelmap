async function identifyLocation(lng, lat) {
  // --- IDENTIFY LOCATION ---

  try {
    const res = await fetch(SUPABASE_IDENTIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        lng,
        lat
      })
    });
    const info = await res.json();
    return info;
  } catch (err) {
    console.error('Identify call failed:', err);
    return null;
  }
}

async function markVisited(aza_id) {
  // --- Mark zoo as visited ---
  try {
    const res = await fetch(UPDATE_AZA_VISIT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
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

function addMarkerPopupAZA(r, destLon, destLat, color) {
  // Add destination marker
  const destMarker = new mapboxgl.Marker({
    color: color
  });
  destMarker.setLngLat([destLon, destLat]);
  destMarker.addTo(map);
  window.destMarker = destMarker;

  // Add popup for destination
  const destPopup = new mapboxgl.Popup({
    offset: 25
  });
  const popupText = `<b>${r.Name}</b><br>
                ${r.City}, ${r.State}<br>
                Drive: ${
                  r.drive_time_min ? r.drive_time_min.toFixed(1) : '?'
                } min (${
    r.drive_distance_mi ? r.drive_distance_mi.toFixed(1) : '?'
  } mi)`;
  destPopup.setLngLat([destLon, destLat]);
  destPopup.setHTML(popupText);
  destPopup.addTo(map);
  window.destPopup = destPopup;
}

let poiData = null;

// Haversine distance in miles
function haversine(a, b) {
  const R = 3958.8;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function nearestDistanceToTrip(poiLngLat, segments) {
  let min = Infinity;

  for (let seg of segments) {
    // Trip start/end/stops
    if (
      seg.type === 'trip_start' ||
      seg.type === 'trip_end' ||
      seg.type === 'stop'
    ) {
      if (seg.coordinates) {
        const d = haversine(poiLngLat, seg.coordinates);
        if (d < min) min = d;
      }
    }

    // Drives
    if (seg.type === 'drive' && seg.routeGeometry?.coordinates) {
      const line = seg.routeGeometry.coordinates;
      for (let pt of line) {
        const d = haversine(poiLngLat, pt);
        if (d < min) min = d;
      }
    }
  }

  return min;
}

// render table
async function updateAZATable(segments) {
  // --- UPDATE TABLE ---
  const poi = await loadPOI();
  const tbody = document.querySelector('#poi-table tbody');
  tbody.innerHTML = '';

  const rows = poi.features.map((f) => {
    const coords = f.geometry.coordinates;
    const dist = nearestDistanceToTrip(coords, segments);

    return {
      name: f.properties.name,
      coords,
      dist
    };
  });

  // sort by distance
  rows.sort((a, b) => a.dist - b.dist);

  for (let r of rows) {
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>${r.name}</td>
      <td>${r.dist.toFixed(1)}</td>
      <td>
        <button onclick="insertPOIIntoRoute('${r.name}', ${r.coords[0]}, ${
      r.coords[1]
    })">
          Insert in Route
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  }
}
