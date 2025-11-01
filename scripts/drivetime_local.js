async function fetchLocalUA(info, lat, lng) {
    // --- FETCH LOCAL UAs ---
    if (info && (info.cbsa_metro || info.cbsa_micro || info.csa)) {
        try {
            const res2 = await fetch(SUPABASE_LOCALUA_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    id_csa: info.csa && info.csa.csa ? 'csa.' + info.csa.csa : null,
                    id_cbsa: info.cbsa_metro && info.cbsa_metro.cbsa ?
                        'cbsa.' + info.cbsa_metro.cbsa : info.cbsa_micro && info.cbsa_micro.cbsa ?
                        'cbsa.' + info.cbsa_micro.cbsa : null
                })
            });
            const uaData = await res2.json();
            console.log('Local UAs:', uaData);
            const uaList = uaData.results || [];

            // --- MATRIX API CALL ---
            if (uaList.length > 0) {
                const sliced = uaList.slice(0, 24);
                const coordsStr = [lng + ',' + lat]
                    .concat(sliced.map((r) => `${r.longitude},${r.latitude}`))
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
                    updateLocalUATable(sliced);
                } else {
                    updateLocalUATable(sliced);
                }
            } else {
                updateLocalUATable([]);
            }
        } catch (err) {
            console.error('Error retrieving UAs or drive times:', err);
        }
    }
}


function updateLocalUATable(rows) {
    // --- UPDATE TABLE ---
    const tbody = document.querySelector('#local-ua-table tbody');
    tbody.innerHTML = '';

    if (!rows || rows.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="6"><i>No local urban areas found.</i></td>`;
        tbody.appendChild(tr);
        openDrawer();
        return;
    }

    // ensure origin popup can be restored by clicking its marker again
    if (marker) {
        marker.getElement().addEventListener('click', function() {
            if (popup) popup.addTo(map);
        });
    }

    rows.forEach((r) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${r.text_ua || ''}</td>
            <td>${r.val_pop_ua?.toLocaleString?.() || ''}</td>
            <td>${r.drive_time_min ? r.drive_time_min.toFixed(1) : ''}</td>
            <td>${r.drive_distance_mi ? r.drive_distance_mi.toFixed(1) : ''}</td>
        `;

        openDrawer();

        // Store destination coordinates
        tr.dataset.lon = r.longitude;
        tr.dataset.lat = r.latitude;

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
                color: '#0074D9'
            });
            destMarker.setLngLat([destLon, destLat]);
            destMarker.addTo(map);
            window.destMarker = destMarker;

            // Add popup for destination
            const destPopup = new mapboxgl.Popup({
                offset: 25
            });
            const popupText = `<b>${r.text_ua || 'Urban Area'}</b><br>
                    Pop: ${r.val_pop_ua?.toLocaleString?.() || 'N/A'}<br>
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
                        'line-color': '#0074D9',
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