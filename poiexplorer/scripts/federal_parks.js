// SOURCES & LAYERS

async function addFederalSourceAndLayer() {

    // Load data from file
    // Load data: Federal stamp sites -- GeoJSON data from external file
    const responseStamp = await fetch('https://laggerstatten.github.io/travelmap/geodata/FederalStampSites_selected.geojson');
    const FederalStampSites_geojsonData = await responseStamp.json();

    // Load data: NRHP_pt -- GeoJSON data from external file            
    const NRHP_pt_geojsonData = "https://mapservices.nps.gov/arcgis/rest/services/cultural_resources/nrhp_locations/MapServer/0/query?where=1%3D1&outFields=*&returnGeometry=true&f=geojson";

    // Load data: NRHP_poly -- GeoJSON data from external file
    // const NRHP_poly_geojsonData = "https://mapservices.nps.gov/arcgis/rest/services/cultural_resources/nrhp_locations/MapServer/1/query?where=1%3D1&outFields=*&returnGeometry=true&f=geojson";

    // Load data: NPS_poly -- GeoJSON data from external file
    // Load data: NPS_pt -- GeoJSON data from external file
    // Load data: BLM -- GeoJSON data from external file
    // Load data: USFS -- GeoJSON data from external file
    // Load data: USFWS -- GeoJSON data from external file



    // Add data to map

    // Add data: Federal stamp sites -- GeoJSON source with loaded data
    map.addSource('FederalStampSites', {
        type: 'geojson',
        data: FederalStampSites_geojsonData,
        cluster: true,
        clusterMaxZoom: 14, // Max zoom to cluster points on
        clusterRadius: 50 // Radius of each cluster when clustering points (defaults to 50)
    });

    // Add data: NRHP_pt -- GeoJSON source with loaded data
    map.addSource('NRHP_pt', {
        type: 'geojson',
        data: NRHP_pt_geojsonData
    });

    // Add data: NRHP_poly -- GeoJSON source with loaded data
    /**
        map.addSource('NRHP_poly', {
            type: 'geojson',
            data: NRHP_poly_geojsonData
        });
    */

    // Add data: NPS_poly -- GeoJSON source with loaded data
    // Add data: NPS_pt -- GeoJSON source with loaded data
    // Add data: BLM -- GeoJSON source with loaded data
    // Add data: USFS -- GeoJSON source with loaded data
    // Add data: USFWS -- GeoJSON source with loaded data

    // Add symbology / labeling layers

    // Symbology/Labeling for Federal stamp sites layer
    map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'FederalStampSites',
        filter: ['has', 'point_count'],
        paint: {

            'circle-color': [
                'step', ['get', 'point_count'],
                '#51bbd6',
                10,
                '#f1f075',
                75,
                '#f28cb1'
            ],

            'circle-radius': [
                'step', ['get', 'point_count'],
                20,
                10,
                30,
                75,
                40
            ]
        }
    });

    map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'FederalStampSites',
        filter: ['has', 'point_count'],
        layout: {
            'text-field': ['get', 'point_count_abbreviated'],
            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
            'text-size': 12
        }
    });

    map.addLayer({
        id: 'unclustered-point',
        type: 'symbol',
        source: 'FederalStampSites',
        filter: ['!', ['has', 'point_count']],
        layout: {
            'icon-image': `park`,
            'icon-allow-overlap': true,
            'text-field': ['get', 'Name'],
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


    // Symbology/Labeling for NRHP_pt layer
    map.addLayer({
        id: 'NRHP_pt',
        type: 'symbol',
        source: 'NRHP_pt',
        layout: {
            'icon-image': 'zoo', //TODO: fix NRHP symbol
            'icon-allow-overlap': true,
            'text-field': ['get', 'RESNAME'],
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

    // Symbology/Labeling for NRHP_poly layer
    // Symbology/Labeling for NPS_poly layer
    // Symbology/Labeling for NPS_pt layer
    // Symbology/Labeling for BLM layer
    // Symbology/Labeling for USFS layer
    // Symbology/Labeling for USFWS layer

}