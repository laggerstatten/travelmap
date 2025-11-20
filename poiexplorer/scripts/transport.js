// SOURCES & LAYERS

// Define a function to generate GeoJSON URLs based on specific conditions
function buildGeoJSONUrl(baseURL, conditions) {
    const queryParams = {
        where: conditions.where || '',
        geometryType: 'esriGeometryEnvelope',
        returnGeometry: true,
        maxRecordCountFactor: '',
        f: 'geojson'
    };

    const queryString = Object.entries(queryParams)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&');

    return `${baseURL}?${queryString}`;
}


async function addTransportSourceAndLayer() {

    // Load data from file

    // Base URL for GeoJSON data
    //const baseURL_IPCD = "https://geo.dot.gov/server/rest/services/Hosted/Intermodal_Passenger_Connectivity_Database_IPCD_DS/FeatureServer/0/query";
    const baseURL_IPCD = "https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_Intermodal_Passenger_Connectivity_Database/FeatureServer/0/query";


    // Load data: GeoJSON data from feature service
    const Air_I_geojsonData = buildGeoJSONUrl(baseURL_IPCD, { where: 'i_service=1 AND fac_type=1 AND air_serve=1' });
    const Bus_I_geojsonData = buildGeoJSONUrl(baseURL_IPCD, { where: 'i_service=1 AND fac_type=2 AND (bus_i=1 OR bus_code_s=1 OR bus_supp=1)' });
    const Rail_I_geojsonData = buildGeoJSONUrl(baseURL_IPCD, { where: 'i_service=1 AND fac_type=10 AND rail_i=1' });
    const Ferry_I_geojsonData = buildGeoJSONUrl(baseURL_IPCD, { where: 'i_service=1 AND fac_type=5 AND ferry_i=1' });
    const Rail_C_geojsonData = buildGeoJSONUrl(baseURL_IPCD, { where: 'i_service=0 AND fac_type=11' });
    const RailFerry_T_geojsonData = buildGeoJSONUrl(baseURL_IPCD, { where: 'i_service=0 AND t_service=1 AND (fac_type=6 OR fac_type=8 OR fac_type=9)' });

    // Load data: Transit_Stops -- GeoJSON data from external file
    // Load data: Transit_Routes -- GeoJSON data from external file
    // Load data: Transit_Coverage -- GeoJSON data from external file
    // TODO: perform simple 1mi buffer around transit stops
    // Load data: Roads -- GeoJSON data from external file
    // TODO: determine if road layer necessary
    // Load data: Rails -- GeoJSON data from external file
    // TODO: use national rail network and filter to main active tracks
    // TODO: add layer for airport carrier and emplanement data
    // TODO: add layer for Amtrak routes



    // Add data to map

    // Add data: GeoJSON source with loaded data
    map.addSource('Air_I', { type: 'geojson', data: Air_I_geojsonData });
    map.addSource('Bus_I', { type: 'geojson', data: Bus_I_geojsonData });
    map.addSource('Rail_I', { type: 'geojson', data: Rail_I_geojsonData });
    map.addSource('Ferry_I', { type: 'geojson', data: Ferry_I_geojsonData });
    map.addSource('Rail_C', { type: 'geojson', data: Rail_C_geojsonData });
    map.addSource('RailFerry_T', { type: 'geojson', data: RailFerry_T_geojsonData });
    // Add data: Transit_Stops -- GeoJSON source with loaded data
    // Add data: Transit_Routes -- GeoJSON source with loaded data
    // Add data: Transit_Coverage -- GeoJSON source with loaded data
    // Add data: Roads -- GeoJSON source with loaded data
    // Add data: Rails -- GeoJSON source with loaded data


    // Add symbology / labeling layers
    function addTransportPointLayer(id, source, icon, nameField) {
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
                'text-offset': [0, 1.5]
            },
            paint: {
                'text-color': '#202',
                'text-halo-color': '#fff',
                'text-halo-width': 2
            }
        });
    }

    // Symbology/Labeling for layers
    addTransportPointLayer('Air_I', 'Air_I', `airport`, 'fac_name');
    addTransportPointLayer('Bus_I', 'Bus_I', `bus`, 'fac_name');
    addTransportPointLayer('Rail_I', 'Rail_I', `rail`, 'fac_name');
    addTransportPointLayer('Ferry_I', 'Ferry_I', `ferry`, 'fac_name');

    // Symbology/Labeling for Rail_C layer
    map.addLayer({
        id: 'Rail_C',
        type: 'symbol',
        source: 'Rail_C',
        layout: {
            'icon-image': `rail`,
            'icon-allow-overlap': true,
            'text-field': ['get', 'fac_name'],
            'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
            'text-size': 11,
            'text-letter-spacing': 0.05,
            'text-offset': [0, 1.5]
        },
        paint: {
            'text-color': '#202',
            'text-halo-color': '#fff',
            'text-halo-width': 2
        },
        minzoom: 5
    });

    // Symbology/Labeling for RailFerry_T layer
    map.addLayer({
        id: 'RailFerry_T',
        type: 'symbol',
        source: 'RailFerry_T',
        layout: {
            'icon-image': `zoo`, //TODO: fix non-bus transit symbol
            'icon-allow-overlap': true
        },
        minzoom: 6
    });

    // Symbology/Labeling for Transit_Stops layer
    // Symbology/Labeling for Transit_Routes layer
    // Symbology/Labeling for Transit_Coverage layer
    // Symbology/Labeling for Roads layer
    // Symbology/Labeling for Rails layer

}