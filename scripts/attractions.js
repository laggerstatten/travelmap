async function addAttractionsSourceAndLayer() {

    // Load data from file
    // TODO: find data for institutes devoted to the study of space, the ocean, or the poles
    // TODO: find data for modal transportation

    // Load data: GeoJSON data from external file
    const AZA_geojsonData = await fetch('https://laggerstatten.github.io/travelmap/geodata/AZA_2405.geojson').then(response => response.json());
    const APGA_geojsonData = await fetch('https://laggerstatten.github.io/travelmap/geodata/APGA_2405.geojson').then(response => response.json());
    const AAM_geojsonData = await fetch('https://laggerstatten.github.io/travelmap/geodata/AAM_2405.geojson').then(response => response.json());
    const Stad_geojsonData = await fetch('https://laggerstatten.github.io/travelmap/geodata/Stadium_2405.geojson').then(response => response.json());
    const PLib_geojsonData = await fetch('https://laggerstatten.github.io/travelmap/geodata/PresidentialLibraries_2405.geojson').then(response => response.json());
    const Light_geojsonData = await fetch('https://laggerstatten.github.io/travelmap/geodata/Lighthouses_2405.geojson').then(response => response.json());


    // TODO: geocode Observatory data and process

    // Load data: Capitol -- GeoJSON data from external file
    //const Capitol_geojsonData = "https://services1.arcgis.com/Hp6G80Pky0om7QvQ/arcgis/rest/services/StateCapitolBuildings/FeatureServer/0/query?where=1%3D1&outFields=*&returnGeometry=true&f=pgeojson";

    // Load data: Court -- GeoJSON data from external file
    // TODO: edit courthouse query
    //const Court_geojsonData = "https://carto.nationalmap.gov/arcgis/rest/services/structures/MapServer/40/query?where=1%3D1&geometryType=esriGeometryEnvelope&returnGeometry=true&featureEncoding=esriDefault&f=geojson";


    // Add data to map

    // Add data: GeoJSON source with loaded data
    map.addSource('AZA', { type: 'geojson', data: AZA_geojsonData });
    map.addSource('APGA', { type: 'geojson', data: APGA_geojsonData });
    map.addSource('AAM', { type: 'geojson', data: AAM_geojsonData });
    // map.addSource('Obs', { 'type': 'geojson', 'data': Obs_geojsonData });
    map.addSource('Stad', { type: 'geojson', data: Stad_geojsonData });
    //map.addSource('Capitol', { type: 'geojson', data: Capitol_geojsonData });
    // map.addSource('Court', { type: 'geojson', data: Court_geojsonData });
    map.addSource('PLib', { type: 'geojson', data: PLib_geojsonData });
    map.addSource('Light', { type: 'geojson', data: Light_geojsonData });


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

    // Symbology/Labeling for layers
    addAttractionPointLayer('AZA', 'AZA', `zoo`, 'Name');
    addAttractionPointLayer('APGA', 'APGA', `garden`, 'name');
    addAttractionPointLayer('AAM', 'AAM', `museum`, 'USER_Name');
    addAttractionPointLayer('Stad', 'Stad', `stadium`, 'Venue_tab_NAME');
    //addAttractionPointLayer('Capitol', 'Capitol', `embassy`, 'NAME');
    addAttractionPointLayer('PLib', 'PLib', `library`, 'SiteName');
    addAttractionPointLayer('Light', 'Light', `lighthouse`, 'SiteName');

}