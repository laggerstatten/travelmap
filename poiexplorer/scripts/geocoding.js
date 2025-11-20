// GEOCODING

function initGeogDropdowns() {
  // Update selectedGeographyType and selectedGeographyValue on dropdown change
  let selectedGeographyType = document.getElementById('geographyType').value;
  let selectedGeographyValue = document.getElementById('geographyValue').value;
}

function updateGeogDropdowns() {
  // Update selectedGeographyType and selectedGeographyValue on dropdown change
  document
    .getElementById('geographyType')
    .addEventListener('change', function () {
      selectedGeographyType = this.value;
      console.log(selectedGeographyType);
    });

  document
    .getElementById('geographyValue')
    .addEventListener('change', function () {
      selectedGeographyValue = this.value;
      console.log(selectedGeographyValue);
    });
}

function forwardGeocoder(query, local_carmen_data) {
  const matchingFeatures = [];
  for (const feature of local_carmen_data.features) {
    // Handle queries with different capitalization
    // than the source data by calling toLowerCase().
    const title = feature.properties.title.toLowerCase();
    const category = feature.properties.category
      ? feature.properties.category.toLowerCase()
      : null;

    if (
      title.includes(query.toLowerCase()) ||
      (category && category.includes(query.toLowerCase()))
    ) {
      // data results using carmen geojson format:
      // https://github.com/mapbox/carmen/blob/master/carmen-geojson.md
      feature['place_name'] = `${feature.properties.title}`; // this is the field searched by the geocoder
      feature['place_type'] = 'poi';
      feature['center'] = feature.geometry.coordinates;
      console.log(feature);
      matchingFeatures.push(feature);
    }
  }
  return matchingFeatures;
}

var customFilter = function (item) {
  return item.context.some((i) => {
    return (
      i.id.split('.').shift() === selectedGeographyType &&
      i.text === selectedGeographyValue
    );
  });
};

function addlocalGeocoding(local_carmen_data, bbox = null, filter = null) {
  // Create options object with default values
  const options = {
    accessToken: mapboxgl.accessToken,
    localGeocoder: (query) => forwardGeocoder(query, local_carmen_data),
    autocomplete: false,
    localGeocoderOnly: true,
    zoom: 14,
    //types:"",
    placeholder: 'Enter search e.g. San Diego Zoo',
    mapboxgl: mapboxgl
  };

  // Add bbox and filter to options if provided
  if (bbox) {
    options.bbox = bbox;
  }
  if (filter) {
    options.filter = filter;
  }

  // Add the control to the map with the constructed options
  map.addControl(new MapboxGeocoder(options));
}
