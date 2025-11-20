// MAP FILTERING AND VIEWS

function basemapSwitcher() {
  // basemap switcher function
  const layerList = document.getElementById('basemapmenu');
  const inputs = layerList.getElementsByTagName('input');

  for (const input of inputs) {
    input.onclick = (layer) => {
      const layerId = layer.target.id;
      map.setStyle('mapbox://styles/ericschall/' + layerId);
    };
  }
}

function setupBBOXClickEvents() {
  document.getElementById('fit_L48').addEventListener('click', () => {
    map.fitBounds([
      [-130, 23], // [lng, lat] - southwestern corner of the bounds
      [-60, 50] // [lng, lat] - northeastern corner of the bounds
    ]);
  });

  document.getElementById('fit_PRVI').addEventListener('click', () => {
    map.fitBounds([
      [-68, 17], // [lng, lat] - southwestern corner of the bounds
      [-63, 20] // [lng, lat] - northeastern corner of the bounds
    ]);
  });

  document.getElementById('fit_AS').addEventListener('click', () => {
    map.fitBounds([
      [-172, -17], // [lng, lat] - southwestern corner of the bounds
      // 14.609610°S 171.004135°W
      [-167, -12] // [lng, lat] - northeastern corner of the bounds
      // 13.870446°S 168.936952°W
    ]);
  });

  document.getElementById('fit_GNMI').addEventListener('click', () => {
    map.fitBounds([
      [143, 9], // [lng, lat] - southwestern corner of the bounds
      // 12.625256°N 143.475848°E
      [147, 25] // [lng, lat] - northeastern corner of the bounds
      // 21.979231°N 146.740162°E
    ]);
  });

  document.getElementById('fit_HIM').addEventListener('click', () => {
    map.fitBounds([
      [-185, 17], // [lng, lat] - southwestern corner of the bounds
      // 17.513299°N 179.024204°W
      [-149, 32] // [lng, lat] - northeastern corner of the bounds
      // 29.222557°N 149.534328°W
    ]);
  });

  document.getElementById('fit_USMOI').addEventListener('click', () => {
    map.fitBounds([
      [-200, -10], // [lng, lat] - southwestern corner of the bounds
      //
      [-155, 24] // [lng, lat] - northeastern corner of the bounds
      //
    ]);
  });

  document.getElementById('fit_IP').addEventListener('click', () => {
    map.fitBounds([
      [-153, 47], // [lng, lat] - southwestern corner of the bounds
      // 47.068206°N 153.007181°W
      [-120, 63] // [lng, lat] - northeastern corner of the bounds
      // 62.468016°N 121.070678°W
    ]);
  });

  document.getElementById('fit_ALEU').addEventListener('click', () => {
    map.fitBounds([
      [-190, 50], // [lng, lat] - southwestern corner of the bounds
      // 49.983003°N 169.975018°E
      [-145, 63] // [lng, lat] - northeastern corner of the bounds
      // 62.855194°N 146.922470°W
    ]);
  });

  document.getElementById('fit_AK').addEventListener('click', () => {
    map.fitBounds([
      [-170, 55], // [lng, lat] - southwestern corner of the bounds
      // 55.137022°N 169.605716°W
      [-138, 73] // [lng, lat] - northeastern corner of the bounds
      // 73.058967°N 138.007036°W
    ]);
  });
}

// LAYER TOGGLE
function layerToggle(toggleableLayerIdsArray) {
  let toggleableLayerIds = toggleableLayerIdsArray;

  for (const id of toggleableLayerIds) {
    if (!document.getElementById(id)) {
      const link = document.createElement('a');
      link.id = id;
      link.href = '#';
      link.textContent = id;
      link.className = 'active';

      // Show or hide layer when the toggle is clicked.
      link.onclick = function (e) {
        const clickedLayer = this.textContent;
        e.preventDefault();
        e.stopPropagation();

        const visibility = map.getLayoutProperty(clickedLayer, 'visibility');

        // Toggle layer visibility by changing the layout object's visibility property.
        if (visibility === 'visible') {
          map.setLayoutProperty(clickedLayer, 'visibility', 'none');
          this.className = '';
        } else {
          this.className = 'active';
          map.setLayoutProperty(clickedLayer, 'visibility', 'visible');
        }
      };

      const layertogglemenu = document.getElementById('layertogglemenu');
      layertogglemenu.appendChild(link);
    }
  }
}

// LAYER TOGGLE
function roadLabelToggle() {
  // Enumerate ids of the layers.
  const toggleableLayerIds = ['road-labels'];

  for (const id of toggleableLayerIds) {
    if (!document.getElementById(id)) {
      const link = document.createElement('a');
      link.id = id;
      link.href = '#';
      link.textContent = 'Road Signage';
      link.className = 'active';

      // Show or hide layer when the toggle is clicked.
      link.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();

        const visibility = map.getLayoutProperty(
          'road-label-navigation',
          'visibility'
        );

        // Toggle layer visibility by changing the layout object's visibility property.
        if (visibility === 'visible') {
          map.setLayoutProperty('road-intersection', 'visibility', 'none');
          map.setLayoutProperty('road-label-navigation', 'visibility', 'none');
          map.setLayoutProperty(
            'road-number-shield-navigation',
            'visibility',
            'none'
          );
          map.setLayoutProperty(
            'road-exit-shield-navigation',
            'visibility',
            'none'
          );
          this.className = '';
        } else {
          this.className = 'active';
          map.setLayoutProperty('road-intersection', 'visibility', 'visible');
          map.setLayoutProperty(
            'road-label-navigation',
            'visibility',
            'visible'
          );
          map.setLayoutProperty(
            'road-number-shield-navigation',
            'visibility',
            'visible'
          );
          map.setLayoutProperty(
            'road-exit-shield-navigation',
            'visibility',
            'visible'
          );
        }
      };

      const layertogglemenu = document.getElementById('layertogglemenu');
      layertogglemenu.appendChild(link);
    }
  }
}
