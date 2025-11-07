function computeSlackAndOverlap(segments) {
  console.log("computeSlackAndOverlap");
  const slack = [];
  const overlaps = [];


  for (let i = 0; i < segments.length - 1; i++) {
    const cur = segments[i];
    const next = segments[i + 1];

    if (!cur.end?.utc || !next.start?.utc) {
      continue; // skip incomplete segments
    }

    const gap = (new Date(next.start.utc) - new Date(cur.end.utc)) / 60000; // minutes
    //console.log(gap);
    if (gap > 0) {
      slack.push({ a: cur, b: next, minutes: gap });
    } else if (gap < 0) {
      overlaps.push({ a: cur, b: next, minutes: -gap });
    }
  }

  return { slack, overlaps };
}
