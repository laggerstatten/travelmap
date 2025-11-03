async function getRouteInfo(origin, destination) {
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${origin.lon},${origin.lat};${destination.lon},${destination.lat}?geometries=geojson&overview=full&access_token=${mapboxgl.accessToken}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Directions API request failed");
    const data = await res.json();

    const route = data.routes ?.[0];
    if (!route) return null;

    return {
        geometry: route.geometry, // GeoJSON line
        distance_mi: route.distance / 1609.34,
        duration_min: route.duration / 60,
    };
}