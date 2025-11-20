var bbox = [-126.4, 24.4, -66.9, 49.384358];

// these features lack context and cannot be filtered that way
const customData_nocontext = {
  features: [
    {
      type: 'Feature',
      properties: {
        title: 'Honolulu Zoo'
      },
      geometry: {
        coordinates: [-157.82169599999997, 21.271669000000031],
        type: 'Point'
      }
    },
    {
      type: 'Feature',
      properties: {
        title: 'San Diego Zoo'
      },
      geometry: {
        coordinates: [-117.14874299999997, 32.737832000000026],
        type: 'Point'
      }
    },
    {
      type: 'Feature',
      properties: {
        title: 'The Living Desert Zoo and Gardens'
      },
      geometry: {
        coordinates: [-116.37364199999996, 33.70423500000004],
        type: 'Point'
      }
    }
  ],
  type: 'FeatureCollection'
};

// these features have context and can be filtered that way
const customData_context = {
  features: [
    {
      type: 'Feature',
      id: 'poi.1234',
      text: 'Honolulu',
      place_type: ['place'],
      center: [-157.82169599999997, 21.271669000000031],
      geometry: {
        type: 'Point',
        coordinates: [-157.82169599999997, 21.271669000000031]
      },
      properties: {
        title: 'Honolulu Zoo',
        category: 'zoo, aquarium',
        type: 'zoo',
        UA_id: '39889',
        UA_name: 'Honolulu, HI',
        UA_pop: 853252,
        CountyName: 'Honolulu County',
        CountyFIPS: '15003',
        StateName: 'Hawaii',
        StateAbbr: 'HI',
        CBSA_id: '46520',
        CBSA_name: 'Urban Honolulu, HI Metro Area',
        CSA_id: '',
        CSA_name: '',
        DMA_name: '',
        DMA_Rank: 0,
        TZ_name: ''
      },
      context: [
        {
          id: 'country.51',
          text: 'United States'
        },
        {
          id: 'ua.39889',
          text: 'Honolulu, HI'
        },
        {
          id: 'county.15003',
          text: 'Honolulu County'
        },
        {
          id: 'cbsa.46520',
          text: 'Urban Honolulu, HI Metro Area'
        }
      ]
    },
    {
      type: 'Feature',
      id: 'poi.1234',
      text: 'El Paso',
      place_name: 'El Paso, Texas, United States',
      place_type: ['place'],
      bbox: [-97.938382, 30.098659, -97.561488, 30.516863],
      center: [-106.444738, 31.767452000000048],
      geometry: {
        type: 'Point',
        coordinates: [-106.44473799999997, 31.767452000000048]
      },
      properties: {
        title: 'El Paso Zoo',
        category: 'zoo, aquarium',
        type: 'zoo',
        UA_id: '27253',
        UA_name: 'El Paso, TX--NM',
        UA_pop: 854584,
        CountyName: 'El Paso County',
        CountyFIPS: '48141',
        StateName: 'Texas',
        StateAbbr: 'TX',
        CBSA_id: '21340',
        CBSA_name: 'El Paso, TX Metro Area',
        CSA_id: '238',
        CSA_name: 'El Paso-Las Cruces, TX-NM CSA',
        DMA_name: 'El Paso (Las Cruces)',
        DMA_Rank: 85,
        TZ_name: 'Mountain'
      },
      context: [
        {
          id: 'province.293',
          text: 'Texas'
        },
        {
          id: 'country.51',
          text: 'United States'
        },
        {
          id: 'ua.27253',
          text: 'El Paso, TX--NM'
        },
        {
          id: 'county.48141',
          text: 'El Paso County'
        },
        {
          id: 'cbsa.21340',
          text: 'El Paso, TX Metro Area'
        },
        {
          id: 'csa.238',
          text: 'El Paso-Las Cruces, TX-NM CSA'
        },
        {
          id: 'dma.85',
          text: 'El Paso (Las Cruces)'
        },
        {
          id: 'tz.000',
          text: 'Mountain'
        }
      ]
    }
  ],
  type: 'FeatureCollection'
};

// these features have context and can be filtered that way
const customData_context_minimal = {
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [-157.821695, 21.271669]
      },
      properties: {
        title: 'Honolulu Zoo',
        category: 'zoo, aquarium'
      },
      context: [
        {
          id: 'county.15003',
          text: 'Honolulu County'
        }
      ]
    },
    {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [-106.444737, 31.767452]
      },
      properties: {
        title: 'El Paso Zoo',
        category: 'zoo, aquarium'
      },
      context: [
        {
          id: 'county.48141',
          text: 'El Paso County'
        }
      ]
    }
  ],
  type: 'FeatureCollection'
};
