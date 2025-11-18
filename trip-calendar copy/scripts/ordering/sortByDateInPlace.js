/**
  function sortByDateInPlace(list = []) {
    const dated = list.filter((seg) => parseDate(seg?.start?.utc));
    dated.sort((a, b) => parseDate(a?.start?.utc) - parseDate(b?.start?.utc));
  
    const merged = [];
    let di = 0;
    for (const seg of list) {
      if (!parseDate(seg?.start?.utc)) merged.push(seg);
      else merged.push(dated[di++]);
    }
    list.splice(0, list.length, ...merged);
    return list;
  }
*/
