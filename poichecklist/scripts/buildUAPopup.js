async function buildUAPopup(info, lng, lat) {
  // --- BUILD POPUP HTML ---
  const parts = [];
  if (info && info.state && info.state.name)
    parts.push('<b>State:</b> ' + info.state.name);
  if (info && info.county && info.county.name)
    parts.push('<b>County:</b> ' + info.county.name);
  if (info && info.cbsa_metro && info.cbsa_metro.name)
    parts.push('<b>Metro:</b> ' + info.cbsa_metro.name);
  if (info && info.cbsa_micro && info.cbsa_micro.name)
    parts.push('<b>Micro:</b> ' + info.cbsa_micro.name);
  if (info && info.csa && info.csa.name)
    parts.push('<b>CSA:</b> ' + info.csa.name);
  if (info && info.urban_area && info.urban_area.name)
    parts.push('<b>Urban Area:</b> ' + info.urban_area.name);
  if (info && info.ecoregion && info.ecoregion.name)
    parts.push('<b>Ecoregion:</b> ' + info.ecoregion.name);

  const popupHtml =
    parts.length > 0 ? parts.join('<br>') : '<i>No information found</i>';

  if (popup) {
    popup.remove();
  }
  const newPopup = new mapboxgl.Popup({
    offset: 25
  });
  newPopup.setLngLat([lng, lat]);
  newPopup.setHTML(popupHtml);
  newPopup.addTo(map);
  popup = newPopup;
}
