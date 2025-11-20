// SOURCES & LAYERS

async function addGeogSourceAndLayer() {

    // Load data from file
    // TODO: compress data for UAs, Counties, CBSAs, DMAs

    // Load data: GeoJSON data from external file
    //const UA_cent_geojsonData = await fetch('geodata/UA_cent.geojson').then(response => response.json());
    //const County_cent_geojsonData = await fetch('geodata/County_cent.geojson').then(response => response.json());
    // Load data: CBSA_cent -- GeoJSON data from external file
    //const DMA_cent_geojsonData = await fetch('geodata/DMA_cent.geojson').then(response => response.json());
    const TimeZone_geojsonData = await fetch('geodata/timezones-now.geojson/combined-now.json').then(response => response.json());
    // Load data: Capitol -- GeoJSON data from external file
    const Capitol_geojsonData = "https://services1.arcgis.com/Hp6G80Pky0om7QvQ/arcgis/rest/services/StateCapitolBuildings/FeatureServer/0/query?where=1%3D1&outFields=*&returnGeometry=true&f=pgeojson";

    // Load data: Court -- GeoJSON data from external file
    const Stad_geojsonData = await fetch('geodata/Stadium_2405.geojson').then(response => response.json());
    const CSA_bbox_geojsonData = await fetch('geodata/geo_CSA_bbox_2405.geojson').then(response => response.json());
    const CSA_geojsonData = await fetch('geodata/geo_CSA_2405.geojson').then(response => response.json());



    // Add data to map

    // Add data: GeoJSON source with loaded data
    //map.addSource('UA_cent', { type: 'geojson', data: UA_cent_geojsonData });
    //map.addSource('CBSA_cent', { type: 'geojson', data: CBSA_cent_geojsonData });
    //map.addSource('DMA_cent', { type: 'geojson', data: DMA_cent_geojsonData });
    //map.addSource('County_cent', { type: 'geojson', data: County_cent_geojsonData });
    map.addSource('TimeZone', { type: 'geojson', data: TimeZone_geojsonData });
    map.addSource('Capitol', { type: 'geojson', data: Capitol_geojsonData });
    // Add data: Court -- GeoJSON source with loaded data
    map.addSource('Stad', { type: 'geojson', data: Stad_geojsonData });
    // Add data: CSA_bbox-- GeoJSON source with loaded data
    map.addSource('CSA_bbox', { type: 'geojson', data: CSA_bbox_geojsonData });
    map.addSource('CSA', { type: 'geojson', data: CSA_geojsonData });

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

    // Symbology/Labeling for UA_cent layer
    // Symbology/Labeling for CBSA_cent layer
    // Symbology/Labeling for DMA_cent layer
    // Symbology/Labeling for County_cent layer



    // Symbology/Labeling for CSA_bbox layer
    map.addLayer({
        id: 'CSA_bbox',
        type: 'fill',
        source: 'CSA_bbox',
        layout: {},
        paint: {
            'fill-color': 'rgba(200, 100, 240, 0.4)',
            'fill-outline-color': 'rgba(200, 100, 240, 1)'
        }
    });

    map.addLayer({
        id: 'CSA',
        type: 'fill',
        source: 'CSA',
        layout: {},
        paint: {
            'fill-color': 'rgba(200, 100, 240, 0.4)',
            'fill-outline-color': 'rgba(200, 100, 240, 1)'
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

    // Symbology/Labeling for Capitol layer
    addAttractionPointLayer('Capitol', 'Capitol', `embassy`, 'NAME');

    // Symbology/Labeling for Court layer
    // Symbology/Labeling for Stad layer
    addAttractionPointLayer('Stad', 'Stad', `stadium`, 'Venue_tab_NAME');




}