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

        updateAZATable(resultList || []);

    } catch (err) {
        console.error('Failed to fetch AZAs:', err);
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
          <td>${r.distance_mi?.toFixed?.(1) ?? ''}</td>
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

        // Add click handler to plot route + marker + popup
        tr.addEventListener('click', async function() {
            // Add popup for destination
            const destPopup = new mapboxgl.Popup({
                offset: 25
            });
            const popupText = `<b>${r.Name}</b><br>${r.City}, ${r.State}`;
            destPopup.setLngLat([r.CenterPointLong, r.CenterPointLat]);
            destPopup.setHTML(popupText);
            destPopup.addTo(map);


            map.flyTo({
                center: [r.CenterPointLong, r.CenterPointLat],
                zoom: 9
            });
        });

        tbody.appendChild(tr);
    });
    resultPanel.classList.add('open');
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