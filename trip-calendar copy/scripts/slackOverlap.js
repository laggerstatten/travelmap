function computeSlackAndOverlap(segments) {
  console.log("computeSlackAndOverlap");

  // Remove existing slack/overlap entries
  for (let i = segments.length - 1; i >= 0; i--) {
    if (segments[i].type === "slack" || segments[i].type === "overlap") {
      segments.splice(i, 1);
    }
  }

  // Build a working copy excluding derived types
  const baseSegments = segments.filter(
    s => s.type !== "slack" && s.type !== "overlap"
  );

  // Insert new derived events directly into the global array
  for (let i = 0; i < baseSegments.length - 1; i++) {
    const cur = baseSegments[i];
    const next = baseSegments[i + 1];
    const curEnd = cur.end ?.utc;
    const nextStart = next.start ?.utc;
    if (!curEnd || !nextStart) continue;

    const startDate = new Date(curEnd);
    const endDate = new Date(nextStart);
    const diffMin = (endDate - startDate) / 60000;

    if (diffMin > 0) {
      const slack = {
        id: crypto.randomUUID(),
        type: "slack",
        name: "Slack",
        a: cur.id,
        b: next.id,
        start: { utc: curEnd },
        end: { utc: nextStart },
        duration: { val: diffMin / 60 },
        minutes: diffMin
      };
      const insertIndex = segments.findIndex(s => s.id === next.id);
      segments.splice(insertIndex, 0, slack);
    } else if (diffMin < 0) {
      const overlapMin = -diffMin;
      const overlap = {
        id: crypto.randomUUID(),
        type: "overlap",
        name: "Overlap",
        a: cur.id,
        b: next.id,
        start: { utc: nextStart },
        end: { utc: curEnd },
        duration: { val: overlapMin / 60 },
        minutes: overlapMin
      };
      const insertIndex = segments.findIndex(s => s.id === next.id);
      segments.splice(insertIndex, 0, overlap);
    }
  }
  console.log("Segments after recompute:", segments);
}