function computeSlackAndOverlap(segments) {
  console.log("computeSlackAndOverlap");
  const slack = [];
  const overlaps = [];


  for (let i = 0; i < segments.length - 1; i++) {
    const cur = segments[i];
    //console.log(cur);
    const next = segments[i + 1];
    //console.log(next);

    const gap = (new Date(next.start) - new Date(cur.end)) / 60000; // minutes
    //console.log(gap);
    if (gap > 0) {
      slack.push({ a: cur, b: next, minutes: gap });
    } else if (gap < 0) {
      overlaps.push({ a: cur, b: next, minutes: -gap });
    }
  }

  return { slack, overlaps };
}
