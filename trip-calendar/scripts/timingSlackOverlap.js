function computeSlackAndOverlap(list) {
  //console.log('computeSlackAndOverlap');
  let segments = [...list];

  for (const s of segments) {
    delete s.overlapEmitters;
  }

  // Remove existing slack/overlap entries
  // is this a function somewhere else?
  for (let i = segments.length - 1; i >= 0; i--) {
    if (segments[i].type === 'slack' || segments[i].type === 'overlap') {
      segments.splice(i, 1);
    }
  }

  // Build a working copy excluding derived types
  const baseSegments = segments.filter(
    (s) => s.type !== 'slack' && s.type !== 'overlap'
  );

  // Insert new derived events directly into the global array
  for (let i = 0; i < baseSegments.length - 1; i++) {
    const cur = baseSegments[i];
    const next = baseSegments[i + 1];
    const curEnd = cur.end?.utc;
    const nextStart = next.start?.utc;
    if (!curEnd || !nextStart) continue;

    const startDate = new Date(curEnd);
    const endDate = new Date(nextStart);
    const diffMin = (endDate - startDate) / 60000;

    if (diffMin > 0) {
      // Lookup related segments
      const tz =
        cur?.timeZone ||
        (cur?.type === 'drive' &&
          baseSegments.find((s) => s.id === cur.destinationId)?.timeZone) ||
        (next?.type === 'drive' &&
          baseSegments.find((s) => s.id === next.originId)?.timeZone) ||
        next?.timeZone;
      const aLabel = segLabel(cur, segments);
      const bLabel = segLabel(next, segments);

      const slack = {
        id: newId(),
        type: 'slack',
        name: 'Slack',
        a: cur.id,
        b: next.id,
        start: { utc: curEnd },
        end: { utc: nextStart },
        duration: { val: diffMin / 60 },
        minutes: diffMin,
        slackInfo: {
          tz,
          aLabel,
          bLabel
        }
      };
      const insertIndex = segments.findIndex((s) => s.id === next.id);
      segments.splice(insertIndex, 0, slack);
    } else if (diffMin < 0) {
      const overlapMin = -diffMin;

      // Lookup related segments
      //const idx = segments.findIndex(s => s.id === cur.id);
      const leftAnchor = findNearestEmitterLeft(i, baseSegments);
      const rightAnchor = findNearestEmitterRight(i, baseSegments);
      const tz =
        leftAnchor?.seg?.timeZone || rightAnchor?.seg?.timeZone || cur.timeZone;
      const aLabel = segLabel(cur, segments);
      const bLabel = segLabel(next, segments);

      for (const [anchor, role] of [
        [leftAnchor, 'left'],
        [rightAnchor, 'right']
      ]) {
        if (anchor?.seg?.id) {
          const s = segments.find((x) => x.id === anchor.seg.id);
          if (s) {
            s.overlapEmitters = s.overlapEmitters || [];

            // Add role if not already present
            if (
              !s.overlapEmitters.some(
                (e) => e.role === role && e.overlapId === overlap?.id
              )
            ) {
              s.overlapEmitters.push({
                role,
                overlapId: null, // fill in once overlap is created
                overlapMinutes: overlapMin,
                overlapHours: (overlapMin / 60).toFixed(2),
                affectedField: anchor.kind // "start", "end", "duration"
              });
            }
          }
        }
      }

      const overlap = {
        id: newId(),
        type: 'overlap',
        name: 'Overlap',
        a: cur.id,
        b: next.id,
        start: { utc: nextStart },
        end: { utc: curEnd },
        duration: { val: overlapMin / 60 },
        minutes: overlapMin,
        overlapInfo: {
          tz,
          aLabel,
          bLabel,
          leftAnchor,
          rightAnchor
        }
      };

      // backfill overlapId into emitters
      for (const role of ['left', 'right']) {
        const anchor = role === 'left' ? leftAnchor : rightAnchor;
        if (anchor?.seg?.id) {
          const s = segments.find((x) => x.id === anchor.seg.id);
          if (s?.overlapEmitters) {
            s.overlapEmitters.forEach((e) => {
              if (e.role === role && e.overlapId === null)
                e.overlapId = overlap.id;
            });
          }
        }
      }

      const insertIndex = segments.findIndex((s) => s.id === next.id);
      segments.splice(insertIndex, 0, overlap);
    }
  }
  //console.log('Segments after recompute:', segments);
  return segments;
}

function removeSlackAndOverlap(list) {
  //console.log('removeSlackAndOverlap');
  let segments = [...list];

  // Build a working copy excluding derived types
  const baseSegments = segments.filter(
    (s) => s.type !== 'slack' && s.type !== 'overlap'
  );

  //console.log('Segments after recompute:', baseSegments);
  return baseSegments;
}













