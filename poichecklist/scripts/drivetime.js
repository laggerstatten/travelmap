function removeOldRoute() {
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
}

function addMarkerPopup(r, destLon, destLat, color) {
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
    const popupText = `<b>${r.text_ua || 'Urban Area'}</b><br>
                        Pop: ${r.val_pop_ua?.toLocaleString?.() || 'N/A'}<br>
                        Drive: ${r.drive_time_min ? r.drive_time_min.toFixed(1) : '?'
        } min (${r.drive_distance_mi ? r.drive_distance_mi.toFixed(1) : '?'
        } mi)`;
    destPopup.setLngLat([destLon, destLat]);
    destPopup.setHTML(popupText);
    destPopup.addTo(map);
    window.destPopup = destPopup;
}


async function drawRoute(originLng, originLat, destLon, destLat, color) {
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
                'line-color': color,
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
}