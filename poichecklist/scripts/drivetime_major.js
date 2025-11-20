async function fetchMajorUA(lat, lng) {
  // --- FETCH MAJOR UAs WITHIN 500 MILES ---
  try {
    const res = await fetch(SUPABASE_MAJORUA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        lat: lat,
        lng: lng,
        radius_miles: 500
      })
    });
    const json = await res.json();
    console.log('Major UAs within 500 miles:', json);
    const resultList = json.results || [];

    fetchMajorUAMatrix(resultList, lng, lat);
  } catch (err) {
    console.error('Error retrieving UAs or drive times:', err);
  }
}

async function fetchMajorUAMatrix(resultList, lng, lat) {
  // --- MATRIX API CALL ---
  if (resultList.length > 0) {
    // Take top 24 most populous for drive-time comparison
    resultList = resultList
      .sort((a, b) => (b.val_pop_ua || 0) - (a.val_pop_ua || 0))
      .slice(0, 24);

    // Define batch size (max 24 destinations per request)
    const batchSize = 5;
    const allResults = [];

    // Split into batches
    for (let i = 0; i < resultList.length; i += batchSize) {
      const batch = resultList.slice(i, i + batchSize);
      const coordsStr = [lng + ',' + lat]
        .concat(batch.map((r) => `${r.longitude},${r.latitude}`))
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
    updateMajorUATable(allResults);
  } else {
    updateMajorUATable([]);
  }
}

function updateMajorUATable(rows) {
  // --- UPDATE TABLE ---
  const tbody = document.querySelector('#major-ua-table tbody');
  tbody.innerHTML = '';

  if (!rows || rows.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="6"><i>No major urban areas found within range.</i></td>`;
    tbody.appendChild(tr);
    openDrawer();
    return;
  }

  rows.forEach((r) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.text_ua || ''}</td>
      <td>${r.val_pop_ua?.toLocaleString?.() || ''}</td>
      <td>${r.drive_time_min ? r.drive_time_min.toFixed(1) : ''}</td>
      <td>${r.drive_distance_mi ? r.drive_distance_mi.toFixed(1) : ''}</td>
    `;

    // Store destination coordinates
    tr.dataset.lon = r.longitude;
    tr.dataset.lat = r.latitude;

    // Add click handler to plot route + marker + popup
    tr.addEventListener('click', async function () {
      const destLon = parseFloat(this.dataset.lon);
      const destLat = parseFloat(this.dataset.lat);
      if (!destLon || !destLat) return;
      removeOldRoute();
      addMarkerPopup(r, destLon, destLat, '#006400');
      drawRoute(originLng, originLat, destLon, destLat, '#228B22');
      closeDrawer();
    });

    tbody.appendChild(tr);
  });
}
