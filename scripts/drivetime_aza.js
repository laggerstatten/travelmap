async function fetchAZA(lat, lng) {
    // --- FETCH AZA WITHIN 500 MILES ---
    try {
        const res = await fetch(GET_NEAR_AZA_URL, {
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
        console.log('AZA within 500 miles:', json);
        const resultList = json.results || [];

        fetchAZAMatrix(resultList, lng, lat);

        //updateAZATable(resultList || []);

    } catch (err) {
        console.error('Error retrieving AZA or drive times:', err);
    }
}

async function fetchAZAMatrix(resultList, lng, lat) {
    // --- MATRIX API CALL ---
    if (resultList.length > 0) {
        const sliced = resultList.slice(0, 24);
        const coordsStr = [lng + ',' + lat]
            .concat(sliced.map((r) => `${r.CenterPointLong},${r.CenterPointLat}`))
            .join(';');

        const matrixUrl = `https://api.mapbox.com/directions-matrix/v1/mapbox/driving/${coordsStr}?annotations=duration,distance&access_token=${MAPBOX_TOKEN}`;
        const matrixRes = await fetch(matrixUrl);
        const matrixJson = await matrixRes.json();

        if (matrixJson.durations && matrixJson.durations[0]) {
            const durations = matrixJson.durations[0].slice(1);
            const distances = matrixJson.distances[0].slice(1);

            sliced.forEach((r, i) => {
                r.drive_time_min = durations[i] / 60;
                r.drive_distance_mi = distances[i] / 1609.34;
            });

            sliced.sort((a, b) => a.drive_time_min - b.drive_time_min);
            updateAZATable(sliced);
        } else {
            updateAZATable(sliced);
        }
    } else {
        updateAZATable([]);
    }
}


function updateAZATable(rows) {
    // --- UPDATE TABLE ---
    const tbody = document.querySelector('#aza-table tbody');
    tbody.innerHTML = '';

    if (!rows || rows.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="6"><i>No AZA attractions found within range.</i></td>`;
        tbody.appendChild(tr);
        openDrawer();
        return;
    }

    rows.forEach((r) => {
        const tr = document.createElement('tr');
        if (visitedAZAs.has(r.aza_id)) tr.classList.add('visited');

        tr.innerHTML = `
            <td>${r.Name}</td>
            <td>${r.City}</td>
            <td>${r.State}</td>
            <td>${r.drive_time_min ? r.drive_time_min.toFixed(1) : ''}</td>
            <td>${r.drive_distance_mi ? r.drive_distance_mi.toFixed(1) : ''}</td>
            <td><button>${visitedAZAs.has(r.aza_id) ? '✓' : 'Mark Visited'
            }</button></td>
    `;

        // handle visit attractionToggle
        const btn = tr.querySelector('button');
        btn.addEventListener('click', async(e) => {
            e.stopPropagation();
            await markVisited(r.aza_id);
            await loadVisited();
            updateAZATable(rows);
        });

        // Store destination coordinates
        tr.dataset.lon = r.CenterPointLong;
        tr.dataset.lat = r.CenterPointLat;

        // Add click handler to plot route + marker + popup
        tr.addEventListener('click', async function() {
            const destLon = parseFloat(this.dataset.lon);
            const destLat = parseFloat(this.dataset.lat);
            if (!destLon || !destLat) return;

            // Remove old route and destination markers/popups
            if (map.getLayer(routeLayerId)) map.removeLayer(routeLayerId);
            if (map.getSource(routeLayerId)) map.removeSource(routeLayerId);
            if (window.destMarker) {
                window.destMarker.remove();
                window.destMarker = null;
            }
            if (window.destPopup) {
                window.destPopup.remove();
                window.destPopup = null;
            }

            // Add destination marker
            const destMarker = new mapboxgl.Marker({
                color: '#006400'
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
            Drive: ${r.drive_time_min ? r.drive_time_min.toFixed(1) : '?'
                } min (${r.drive_distance_mi ? r.drive_distance_mi.toFixed(1) : '?'
                } mi)`;
            destPopup.setLngLat([destLon, destLat]);
            destPopup.setHTML(popupText);
            destPopup.addTo(map);
            window.destPopup = destPopup;

            // Draw route
            const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${originLng},${originLat};${destLon},${destLat}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;

            try {
                const res = await fetch(url);
                const json = await res.json();
                if (!json.routes || !json.routes.length) return;
                const route = json.routes[0].geometry;

                map.addSource(routeLayerId, {
                    type: 'geojson',
                    data: {
                        type: 'Feature',
                        geometry: route
                    }
                });

                map.addLayer({
                    id: routeLayerId,
                    type: 'line',
                    source: routeLayerId,
                    layout: {
                        'line-join': 'round',
                        'line-cap': 'round'
                    },
                    paint: {
                        'line-color': '#228B22',
                        'line-width': 4,
                        'line-opacity': 0.8
                    }
                });

                // Adjust bounds with extra southern padding
                const bounds = new mapboxgl.LngLatBounds();
                route.coordinates.forEach((c) => bounds.extend(c));
                map.fitBounds(bounds, {
                    padding: {
                        top: 50,
                        bottom: 180,
                        left: 50,
                        right: 50
                    }
                });
            } catch (err) {
                console.error('Directions API failed:', err);
            }
            closeDrawer();
        });

        tbody.appendChild(tr);
    });
}

async function loadVisited() {
    // --- Fetch visited zoos for user ---

    try {
        const res = await fetch(GET_USER_VISITS_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id: USER_ID
            })
        });
        const json = await res.json();
        if (json && json.success && Array.isArray(json.results)) {
            visitedAZAs = new Set(json.results.map((r) => r.aza_id));
        } else {
            console.warn('Unexpected response from get-aza-visit:', json);
            visitedAZAs = new Set();
        }

        console.log('Visited zoos:', visitedAZAs);
    } catch (err) {
        console.error('Failed to load visited:', err);
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