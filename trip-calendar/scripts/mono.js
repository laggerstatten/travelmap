
/* ===============================
   Fill FORWARD (UTC) — Lock-Aware
   =============================== */
function fillForward(fromSegment) {
  const idx = segments.findIndex((ev) => ev.id === fromSegment.id);
  if (idx === -1) return;

  const fromStart = fromSegment.start ?.utc;
  const fromEnd = fromSegment.end ?.utc;
  let cursor = fromEnd || fromStart;
  if (!cursor) return;

  for (let i = idx + 1; i < segments.length; i++) {
    const seg = segments[i];

    // --- normalize nested objects ---
    seg.start ??= { utc: '', lock: 'unlocked' };
    seg.end ??= { utc: '', lock: 'unlocked' };
    seg.duration??= { val: null, lock: 'unlocked' };

    // --- Skip slack / overlap segments ---
    if (seg.type === 'slack' || seg.type === 'overlap') continue;

    // --- Stop if start is hard/soft locked ---
    if (['hard', 'soft'].includes(seg.start.lock)) break;

    // --- Trip end special handling ---
    if (seg.type === 'trip_end') {
      if (!['hard', 'soft'].includes(seg.start.lock)) {
        seg.start.utc = cursor;
        seg.start.lock = 'auto';
      }
      break;
    }

    // --- Propagate start ---
    if (!['hard', 'soft'].includes(seg.start.lock)) {
      seg.start.utc = cursor;
      seg.start.lock = 'auto';
    }

    // --- Propagate end ---
    const durHrs = Number(seg.duration.val) || 0;
    if (!['hard', 'soft'].includes(seg.end.lock)) {
      seg.end.utc = addMinutesUTC(seg.start.utc, durHrs * 60);
      seg.end.lock = 'auto';
    }

    cursor = seg.end.utc || seg.start.utc;
  }

  //save();
  localStorage.setItem('tripSegments', JSON.stringify(segments));
  console.log('save');
  renderTimeline(syncGlobal());
}

/* ===============================
   Fill BACKWARD (UTC) — Lock-Aware
   =============================== */
function fillBackward(fromSegment) {
  const idx = segments.findIndex((ev) => ev.id === fromSegment.id);
  if (idx === -1) return;

  const fromStart = fromSegment.start ?.utc;
  const fromEnd = fromSegment.end ?.utc;
  let cursor = fromStart || fromEnd;
  if (!cursor) return;

  for (let i = idx - 1; i >= 0; i--) {
    const seg = segments[i];

    // --- normalize nested objects ---
    seg.start ??= { utc: '', lock: 'unlocked' };
    seg.end ??= { utc: '', lock: 'unlocked' };
    seg.duration ??= { val: null, lock: 'unlocked' };

    // --- Skip slack / overlap segments ---
    if (seg.type === 'slack' || seg.type === 'overlap') continue;

    // --- Stop if end is hard/soft locked ---
    if (['hard', 'soft'].includes(seg.end.lock)) break;

    // --- Trip start special handling ---
    if (seg.type === 'trip_start') {
      if (!['hard', 'soft'].includes(seg.end.lock)) {
        seg.end.utc = cursor;
        seg.end.lock = 'auto';
      }
      break;
    }

    // --- Propagate end ---
    if (!['hard', 'soft'].includes(seg.end.lock)) {
      seg.end.utc = cursor;
      seg.end.lock = 'auto';
    }

    // --- Propagate start ---
    const durHrs = Number(seg.duration.val) || 0;
    if (!['hard', 'soft'].includes(seg.start.lock)) {
      seg.start.utc = addMinutesUTC(seg.end.utc, -durHrs * 60);
      seg.start.lock = 'auto';
    }

    cursor = seg.start.utc || seg.end.utc;
  }

  save();
  renderTimeline(syncGlobal());
}


function computeSlackAndOverlapPure(inSegments) {
  const segments = structuredClone(inSegments);

  // strip existing derived
  for (let i = segments.length - 1; i >= 0; i--) {
    if (segments[i].type === 'slack' || segments[i].type === 'overlap') {
      segments.splice(i, 1);
    }
  }

  const base = segments.filter(s => s.type !== 'slack' && s.type !== 'overlap');

  for (let i = 0; i < base.length - 1; i++) {
    const cur = base[i], next = base[i + 1];
    const curEnd = cur.end?.utc, nextStart = next.start?.utc;
    if (!curEnd || !nextStart) continue;

    const diffMin = (new Date(nextStart) - new Date(curEnd)) / 60000;
    const insertIndex = segments.findIndex(s => s.id === next.id);

    if (diffMin > 0) {
      segments.splice(insertIndex, 0, {
        id: crypto.randomUUID(),
        type: 'slack',
        name: 'Slack',
        a: cur.id, 
        b: next.id,
        start: { utc: curEnd }, 
        end: { utc: nextStart },
        duration: { val: diffMin / 60 }, 
        minutes: diffMin
      });
    } else if (diffMin < 0) {
      const overlapMin = -diffMin;
      segments.splice(insertIndex, 0, {
        id: crypto.randomUUID(),
        type: 'overlap',
        name: 'Overlap',
        a: cur.id, 
        b: next.id,
        start: { utc: nextStart }, 
        end: { utc: curEnd },
        duration: { val: overlapMin / 60 }, 
        minutes: overlapMin
      });
    }
  }
  return segments;
}
// usage later:
// segs = computeSlackAndOverlapPure(segs);
// saveSegments(segs); renderTimeline(segs);





function deleteSegment(seg, card) {
  const id = seg.id;
  deleteSegmentById(id);
  renderTimeline(syncGlobal());
}

function deleteSegmentById(id) {
  const idx = segments.findIndex((seg) => String(seg.id) === String(id));
  if (idx !== -1) {
    segments.splice(idx, 1);
    save();
  }
}



function computeSlackAndOverlap(segments) {
    console.log('computeSlackAndOverlap');

    // Remove existing slack/overlap entries
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
        const curEnd = cur.end ?.utc  ;
        const nextStart = next.start ?.utc  ;
        if (!curEnd || !nextStart) continue;

        const startDate = new Date(curEnd);
        const endDate = new Date(nextStart);
        const diffMin = (endDate - startDate) / 60000;

        if (diffMin > 0) {
            const slack = {
                id: crypto.randomUUID(),
                type: 'slack',
                name: 'Slack',
                a: cur.id,
                b: next.id,
                start: { utc: curEnd },
                end: { utc: nextStart },
                duration: { val: diffMin / 60 },
                minutes: diffMin
            };
            const insertIndex = segments.findIndex((s) => s.id === next.id);
            segments.splice(insertIndex, 0, slack);
        } else if (diffMin < 0) {
            const overlapMin = -diffMin;
            const overlap = {
                id: crypto.randomUUID(),
                type: 'overlap',
                name: 'Overlap',
                a: cur.id,
                b: next.id,
                start: { utc: nextStart },
                end: { utc: curEnd },
                duration: { val: overlapMin / 60 },
                minutes: overlapMin
            };
            const insertIndex = segments.findIndex((s) => s.id === next.id);
            segments.splice(insertIndex, 0, overlap);
        }
    }
    console.log('Segments after recompute:', segments);
}

