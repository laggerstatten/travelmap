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

        // Define batch size (max 24 destinations per request)
        const batchSize = 5;
        const allResults = [];

        // Split into batches
        for (let i = 0; i < resultList.length; i += batchSize) {
            const batch = resultList.slice(i, i + batchSize);
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
        updateAZATable(allResults);
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
            removeOldRoute();
            addMarkerPopupAZA(r, destLon, destLat, '#006400');
            drawRoute(originLng, originLat, destLon, destLat, '#228B22');
            closeDrawer();
        });

        tbody.appendChild(tr);
    });
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
                Drive: ${r.drive_time_min ? r.drive_time_min.toFixed(1) : '?'
        } min (${r.drive_distance_mi ? r.drive_distance_mi.toFixed(1) : '?'
        } mi)`;
    destPopup.setLngLat([destLon, destLat]);
    destPopup.setHTML(popupText);
    destPopup.addTo(map);
    window.destPopup = destPopup;
}


/**
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
*/

async function loadVisited() {
    if (!USER_ID) {
        console.warn("No logged-in user — skipping loadVisited");
        visitedAZAs = new Set();
        return visitedAZAs;
    }

    try {
        var res = await fetch(GET_USER_VISITS_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: USER_ID })
        });

        var json = await res.json();

        if (json && json.success && Array.isArray(json.results)) {
            visitedAZAs = new Set(
                json.results.map(function(r) { return r.aza_id; })
            );
        } else {
            console.warn("Unexpected response from get-user-visits:", json);
            visitedAZAs = new Set();
        }

        console.log("Visited zoos:", visitedAZAs);
        return visitedAZAs;
    } catch (err) {
        console.error("Failed to load visited:", err);
        visitedAZAs = new Set();
        return visitedAZAs;
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