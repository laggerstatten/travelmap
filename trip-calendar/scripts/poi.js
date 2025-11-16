// scripts/poi.js

let poiData = null;

async function loadPOI() {
  if (!poiData) {
    const res = await fetch("data/poi.json");
    poiData = await res.json();
  }
  return poiData;
}

// Haversine distance in miles
function haversine(a, b) {
  const R = 3958.8;
  const toRad = x => x * Math.PI / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);

  const h = Math.sin(dLat/2)**2 +
            Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function nearestDistanceToTrip(poiLngLat, segments) {
  let min = Infinity;

  for (let seg of segments) {

    // Trip start/end/stops
    if (seg.type === "trip_start" || seg.type === "trip_end" || seg.type === "stop") {
      if (seg.coordinates) {
        const d = haversine(poiLngLat, seg.coordinates);
        if (d < min) min = d;
      }
    }

    // Drives
    if (seg.type === "drive" && seg.routeGeometry?.coordinates) {
      const line = seg.routeGeometry.coordinates;
      for (let pt of line) {
        const d = haversine(poiLngLat, pt);
        if (d < min) min = d;
      }
    }
  }

  return min;
}

async function renderPOITable(segments) {
  const poi = await loadPOI();
  const tbody = document.querySelector("#poi-table tbody");
  tbody.innerHTML = "";

  const rows = poi.features.map(f => {
    const coords = f.geometry.coordinates;
    const dist = nearestDistanceToTrip(coords, segments);

    return {
      name: f.properties.name,
      coords,
      dist
    };
  });

  // sort by distance
  rows.sort((a,b) => a.dist - b.dist);

  for (let r of rows) {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${r.name}</td>
      <td>${r.dist.toFixed(1)}</td>
      <td>
        <button onclick="insertPOIIntoRoute('${r.name}', ${r.coords[0]}, ${r.coords[1]})">
          Insert in Route
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  }
}
