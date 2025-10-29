async function addAttractionsSourceAndLayer() {
    // Dynamically detect base path
    // Works locally (http://localhost...) and on GitHub Pages (/travelmap/)
    const repoBase = window.location.pathname.includes('/travelmap/') ?
        '/travelmap/' :
        '/';

    // Helper to load GeoJSON
    async function loadGeoJSON(file) {
        const url = `${repoBase}geodata/${file}`;
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`Failed to load ${file}:`, response.status, response.statusText);
            return null;
        }
        return await response.json();
    }

    // Load all datasets
    const [
        AZA_geojsonData,
        APGA_geojsonData,
        AAM_geojsonData,
        Stad_geojsonData,
        PLib_geojsonData,
        Light_geojsonData,
    ] = await Promise.all([
        loadGeoJSON('AZA_2405.geojson'),
        loadGeoJSON('APGA_2405.geojson'),
        loadGeoJSON('AAM_2405.geojson'),
        loadGeoJSON('Stadium_2405.geojson'),
        loadGeoJSON('PresidentialLibraries_2405.geojson'),
        loadGeoJSON('Lighthouses_2405.geojson'),
    ]);



    // Load data from file
    // TODO: find data for institutes devoted to the study of space, the ocean, or the poles
    // TODO: find data for modal transportation


    // TODO: geocode Observatory data and process

    // Load data: Capitol -- GeoJSON data from external file
    //const Capitol_geojsonData = "https://services1.arcgis.com/Hp6G80Pky0om7QvQ/arcgis/rest/services/StateCapitolBuildings/FeatureServer/0/query?where=1%3D1&outFields=*&returnGeometry=true&f=pgeojson";

    // Load data: Court -- GeoJSON data from external file
    // TODO: edit courthouse query
    //const Court_geojsonData = "https://carto.nationalmap.gov/arcgis/rest/services/structures/MapServer/40/query?where=1%3D1&geometryType=esriGeometryEnvelope&returnGeometry=true&featureEncoding=esriDefault&f=geojson";





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