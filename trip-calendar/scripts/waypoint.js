async function rerouteDrive(seg) {
  // Always load the authoritative segment list
  const list = loadSegments();
  const target = list.find(s => s.id === seg.id);
  if (!target) {
    console.error("rerouteDrive: segment not found", seg.id);
    return;
  }

  // Extract start/end from EXISTING routeGeometry
  const geom = target.routeGeometry;
  if (!geom || !Array.isArray(geom.coordinates) || geom.coordinates.length < 2) {
    console.error("rerouteDrive: missing or invalid routeGeometry", target);
    return;
  }

  const startCoord = geom.coordinates[0];
  const endCoord   = geom.coordinates[geom.coordinates.length - 1];

  // Extract waypoint coords from items[]
  const waypoints = (target.items || [])
    .filter(i => i.type === "waypoint" && Array.isArray(i.coordinates))
    .map(i => i.coordinates);

  // Aggregate coordinates in correct order
  const coords = [
    startCoord,
    ...waypoints,
    endCoord
  ];

  console.log("rerouteDrive coords:", coords);

  // Build URL
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords
      .map(c => c.join(","))
      .join(";")}?geometries=geojson&overview=full&access_token=${mapboxgl.accessToken}`;

  // Fetch route
  const r = await fetch(url);
  const json = await r.json();

  if (!json.routes || !json.routes[0]) {
    console.error("rerouteDrive: no route returned:", json);
    return;
  }

  // Update authoritative geometry
  const newGeom = json.routes[0].geometry;
  target.routeGeometry = newGeom;

  // Save + redraw everything
  saveSegments(list);
  renderTimeline(list);
  renderMap(list);
}

function showToast(message, timeout = 2000) {
  const div = document.createElement('div');
  div.className = 'toast-message';
  div.textContent = message;

  Object.assign(div.style, {
    position: 'fixed',
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(0,0,0,0.75)',
    color: 'white',
    padding: '8px 14px',
    borderRadius: '6px',
    fontSize: '14px',
    zIndex: 9999,
    opacity: 0,
    transition: 'opacity 0.3s'
  });

  document.body.appendChild(div);

  requestAnimationFrame(() => (div.style.opacity = 1));

  setTimeout(() => {
    div.style.opacity = 0;
    setTimeout(() => div.remove(), 300);
  }, timeout);
}
