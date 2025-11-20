// SOURCES & LAYERS

async function addMarketSourceAndLayer() {

    // Load data from file

    // Load data: DMA -- GeoJSON data from external file
    const response_DMA = await fetch('DMA.geojson');
    const DMA_geojsonData = await response_DMA.json();

    const TimeZone_geojsonData = await fetch('geodata/timezones-now.geojson/combined-now.json').then(response => response.json());

    const Stad_geojsonData = await fetch('geodata/Stadium_2405.geojson').then(response => response.json());

    // Add data to map

    // Add data: DMA -- GeoJSON source with loaded data
    map.addSource('DMA', { type: 'geojson', data: DMA_geojsonData });
    map.addSource('TimeZone', { type: 'geojson', data: TimeZone_geojsonData });

    map.addSource('Stad', { type: 'geojson', data: Stad_geojsonData });


    // Add symbology / labeling layers
    function addAttractionPointLayer(id, source, icon, nameField) {
        map.addLayer({
            id: id,
            type: 'symbol',
            source: source,
            layout: {
                'icon-image': icon,
                'icon-allow-overlap': true,
                'text-field': ['get', nameField],
                'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
                'text-size': 11,
                'text-letter-spacing': 0.05,
                'text-offset': [0, 1.25],
                'text-anchor': 'top'
            },
            paint: {
                'text-color': '#202',
                'text-halo-color': '#fff',
                'text-halo-width': 2
            }
        });
    }

    // Symbology/Labeling for DMA layer
    map.addLayer({
        id: 'DMA',
        type: 'symbol',
        source: 'DMA',
        layout: {
            'icon-image': 'custom-marker',
            'text-field': ['get', 'Name'],
            'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
            'text-offset': [0, 1.25],
            'text-anchor': 'top'
        }
    });





    // Symbology/Labeling for TimeZone layer
    map.addLayer({
        id: 'TimeZone',
        type: 'line',
        source: 'TimeZone',
        layout: {},
        paint: {
            'line-color': '#800080',
            'line-width': 2,
        }
    });

    // Symbology/Labeling for Stad layer
    addAttractionPointLayer('Stad', 'Stad', `stadium`, 'Venue_tab_NAME');




}