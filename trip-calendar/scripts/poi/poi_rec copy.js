// ===========================================================
// HELPERS USED BY REC PROVIDER
// ===========================================================

function parseNextLink(linkHeader) {
  if (!linkHeader) return null;
  const links = linkHeader.split(',');
  for (const link of links) {
    if (link.includes('rel="next"')) {
      const match = link.match(/<(.*?)>/);
      return match && match[1] ? match[1] : null;
    }
  }
  return null;
}

async function rec_loadDataset(datasetId) {
  let nextUrl = `https://api.mapbox.com/datasets/v1/${USERNAME}/${datasetId}/features?access_token=${MAPBOX_TOKEN}&limit=100&sort=id`;

  let allFeatures = [];

  while (nextUrl) {
    if (!nextUrl.includes('access_token')) {
      const separator = nextUrl.includes('?') ? '&' : '?';

      nextUrl = nextUrl + separator + `access_token=${MAPBOX_TOKEN}`;
    }

    const res = await fetch(nextUrl);

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(
        `Mapbox API error: ${res.status} ${res.statusText}. Response body: ${errorBody}`
      );
    }

    const json = await res.json();
    const newFeatures = json.features || [];

    allFeatures = allFeatures.concat(newFeatures);

    const linkHeader = res.headers.get('Link');

    nextUrl = parseNextLink(linkHeader);

    if (!nextUrl) {
    }
  }

  return allFeatures;
}

function rec_mergeByGlobalID(rows, features) {
  const merged = [];

  for (const f of features) {
    const gid = cleanID(f.properties.GlobalID);
    const row = rows.find(
      (r) => cleanID(r.GlobalID) === gid || cleanID(r['GlobalID *']) === gid
    );
    if (!row) continue;

    f.properties = { ...f.properties, ...row };
    merged.push(f);
  }

  return merged;
}

