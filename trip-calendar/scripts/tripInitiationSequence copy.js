/* ===============================
   Trip Initialization (Async)
   =============================== */
async function initTrip() {
  console.log('Initializing trip...');

  let segs = loadSegments();

  // queue anchors in-memory, then persist once
  queueTripOrigin(segs);
  queueTripDestination(segs);
  saveSegments(segs);
  renderTimeline(segs);
  console.log('Waiting for trip anchors...');
  await waitForTripAnchorsReady();

  segs = loadSegments();
  segs = await validateAndRepair(segs);
  saveSegments(segs);
  renderTimeline(segs);

  segs = annotateEmitters(segs);
  segs = determineEmitterDirections(segs, { priority: PLANNING_DIRECTION }); 
  segs = propagateTimes(segs);
  saveSegments(segs);
  renderTimeline(segs);

  // Compute slack/overlap on the same canonical array
  segs = computeSlackAndOverlap(segs);
  saveSegments(segs);
  renderTimeline(segs);

  console.log('Trip initialization complete.');
}

/* ===============================
   Queue Trip Origin / Destination
   =============================== */
function queueTripOrigin(segments) {
  const seg = {
    id: newId(),
    name: '(untitled)',
    type: 'trip_start',
    isAnchorStart: true,
    start: { lock: 'undefined', utc: '' },
    end: { lock: 'hard', utc: '' },
    isQueued: true,
    openEditor: true
  };

  segments.unshift(seg);
}

function queueTripDestination(segments) {
  const seg = {
    id: newId(),
    name: '(untitled)',
    type: 'trip_end',
    isAnchorEnd: true,
    start: { lock: 'hard', utc: '' },
    end: { lock: 'undefined', utc: '' },
    isQueued: true,
    openEditor: true
  };

  segments.push(seg);
}

/* ===============================
   Helper: Wait for Anchors Ready
   =============================== */
function waitForTripAnchorsReady() {
  return new Promise((resolve) => {
    const check = () => {
      const segs = loadSegments();
      const startReady = segs.some(s => s.type === 'trip_start' && !s.isQueued);
      const endReady   = segs.some(s => s.type === 'trip_end'   && !s.isQueued);
      if (startReady && endReady) resolve();
      else requestAnimationFrame(check);
    };
    check();
  });
}

/* ===============================
   Trip Validation & Repair Module
   =============================== */

async function validateAndRepair(list) {
  let segments = [...list];

  segments = removeAdjacentDrives(segments);

  segments = segments.filter((seg) => {
    if (seg.type !== "drive") return true;
    const origin = segments.find((x) => x.id === seg.originId);
    const dest = segments.find((x) => x.id === seg.destinationId);
    return origin && dest;
  });

  segments = insertDriveSegments(segments);
  segments = await generateRoutes(segments);

  return segments;
}

function removeAdjacentDrives(list) {
  let segments = [...list];

  for (let i = 0; i < segments.length - 1; i++) {
    if (segments[i].type === "drive" && segments[i + 1].type === "drive") {
      segments.splice(i, 2);
      i--;
    }
  }
  return segments;
}

function insertDriveSegments(list) {
  let segments = [...list];
  const out = [];
  for (let i = 0; i < segments.length; i++) {
    const cur = segments[i];
    out.push(cur);
    const next = segments[i + 1];
    if (!next) break;
    if (cur.type !== 'drive' && next.type !== 'drive') {
      out.push({
        id: newId(),
        name: `Drive from ${cur.name || 'current stop'} to ${
          next.name || 'next stop'
        }`,
        type: 'drive',
        autoDrive: true,
        manualEdit: false,
        originId: cur.id,
        destinationId: next.id,
      });
    }
  }
  return out;
}

async function generateRoutes(list) {
  //const segments = sortByDateInPlace([...list]); // commenting this out to see if anything breaks
  const segments = [...list];

  for (const seg of segments) {
    if (seg.type !== 'drive') continue;

    // Use explicit IDs first
    const origin = segments.find((ev) => ev.id === seg.originId);
    const destination = segments.find((ev) => ev.id === seg.destinationId);

    // Fallback: nearest non-drive neighbors
    const originAlt =
      origin ||
      [...segments.slice(0, segments.indexOf(seg))]
        .reverse()
        .find((ev) => ev.coordinates[1] && ev.coordinates[0]);
    const destAlt =
      destination ||
      segments
        .slice(segments.indexOf(seg) + 1)
        .find((ev) => ev.coordinates[1] && ev.coordinates[0]);
    const from = originAlt;
    const to = destAlt;

    if (!from || !to) {
      continue;
    }

    try {
      const route = await getRouteInfo(from, to);
      if (route) {
        seg.autoDrive = true;
        seg.routeGeometry = route.geometry;
        seg.distanceMi = route.distance_mi.toFixed(1);
        seg.durationMin = route.duration_min.toFixed(0);
        seg.durationHr = (route.duration_min / 60).toFixed(2);
        seg.duration = {val: (route.duration_min / 60).toFixed(2), lock: 'hard'};
        seg.originId = from.id;
        seg.destinationId = to.id;
        seg.originTz = from.timeZone;
        seg.destinationTz = to.timeZone;       
      }
    } catch (err) {}
  }

  return segments;
}

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

function computeSlackAndOverlap(list) {
    console.log('computeSlackAndOverlap');
    let segments = [...list];

    for (const s of segments) {
      delete s.overlapEmitters;
    }


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
            // Lookup related segments
            const tz =
              cur?.timeZone ||
              (cur?.type === 'drive' && baseSegments.find(s => s.id === cur.destinationId)?.timeZone) ||
              (next?.type === 'drive' && baseSegments.find(s => s.id === next.originId)?.timeZone) ||
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
            const leftAnchor  = findNearestEmitterLeft(i, baseSegments);
            const rightAnchor = findNearestEmitterRight(i, baseSegments);
            const tz = (leftAnchor?.seg?.timeZone) || (rightAnchor?.seg?.timeZone) || cur.timeZone;
            const aLabel = segLabel(cur, segments);
            const bLabel = segLabel(next, segments);

            for (const [anchor, role] of [[leftAnchor, 'left'], [rightAnchor, 'right']]) {
              if (anchor?.seg?.id) {
                const s = segments.find(x => x.id === anchor.seg.id);
                if (s) {
                  s.overlapEmitters = s.overlapEmitters || [];

                  // Add role if not already present
                  if (!s.overlapEmitters.some(e => e.role === role && e.overlapId === overlap?.id)) {
                    s.overlapEmitters.push({
                      role,
                      overlapId: null,       // fill in once overlap is created
                      overlapMinutes: overlapMin,
                      overlapHours: (overlapMin / 60).toFixed(2),
                      affectedField: anchor.kind, // "start", "end", "duration"
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
                const s = segments.find(x => x.id === anchor.seg.id);
                if (s?.overlapEmitters) {
                  s.overlapEmitters.forEach(e => {
                    if (e.role === role && e.overlapId === null) e.overlapId = overlap.id;
                  });
                }
              }
}

            const insertIndex = segments.findIndex((s) => s.id === next.id);
            segments.splice(insertIndex, 0, overlap);
        }
    }
    console.log('Segments after recompute:', segments);
    return segments;
}


function findNearestEmitterLeft(idx, segments) {
  for (let i = idx - 1; i >= 0; i--) {
    const s = segments[i];
    if (isEmitter(s.end, 'forward'))     return { seg: s, kind: 'end',   field: s.end };
    if (isEmitter(s.start, 'forward'))   return { seg: s, kind: 'start', field: s.start };
    if (isEmitter(s.duration, 'forward'))return { seg: s, kind: 'duration', field: s.duration };
  }
  return null;
}

function findNearestEmitterRight(idx, segments) {
  for (let i = idx + 1; i < segments.length; i++) {
    const s = segments[i];
    if (isEmitter(s.start, 'backward'))    return { seg: s, kind: 'start', field: s.start };
    if (isEmitter(s.end, 'backward'))      return { seg: s, kind: 'end',   field: s.end };
    if (isEmitter(s.duration, 'backward')) return { seg: s, kind: 'duration', field: s.duration };
  }
  return null;
}

function isEmitter(f, dir) {
    if (!boundaryLocked(f)) return false;
    return dir === 'forward' ? !!f.emitsForward : !!f.emitsBackward;
}

function boundaryLocked(f) { 
  return !!(f && f.lock && f.lock !== 'unlocked'); 
}

function getOverlapResolutionOptions(seg, role) {
  const options = [];
  const overlap = seg.overlapEmitters?.find(e => e.role === role);
  if (!overlap) return options;

  const overlapMin = overlap.overlapMinutes;
  const overlapHr = overlapMin / 60;
  const roundedHr = Math.ceil(overlapHr * 4) / 4;

  const durMin = segDurationMinutes(seg);
  const canShrink = durMin > 0 && overlapMin < durMin * 0.75;

  // Field locks
  const startLocked = seg.start?.lock === 'hard';
  const endLocked   = seg.end?.lock === 'hard';
  const durLocked   = seg.duration?.lock === 'hard';

  const addOption = (action, label, feasibility = 'ok', reason = '') => {
    options.push({ action, label, feasibility, reason });
  };

  switch (seg.type) {
    case 'trip_start':
    case 'trip_end': {
      const moveAction = role === 'left' ? 'moveEarlier' : 'moveLater';
      const locked = role === 'left' ? startLocked : endLocked;
      if (locked)
        addOption(moveAction, `🔒 Unlock & ${moveAction} (~${roundedHr}h)`, 'unlock', 'Hard lock prevents move');
      else
        addOption(moveAction, `${role === 'left' ? '⬅' : '➡'} Move (~${roundedHr}h)`);
      break;
    }

    case 'stop': {
      if (role === 'left') {
        const locked = endLocked; // earlier adjustment touches end
        if (locked)
          addOption('moveEarlier', '🔒 Unlock & Move Earlier', 'unlock', 'End locked');
        else
          addOption('moveEarlier', `⬅ Nudge Earlier (~${roundedHr}h)`);

        if (canShrink) {
          const durHard = durLocked;
          if (durHard)
            addOption('shrink', '🔒 Unlock & Shorten', 'unlock', 'Duration locked');
          else
            addOption('shrink', `↔ Shorten (~${roundedHr}h)`);
        }
      } else {
        const locked = startLocked; // later adjustment touches start
        if (locked)
          addOption('moveLater', '🔒 Unlock & Move Later', 'unlock', 'Start locked');
        else
          addOption('moveLater', `➡ Nudge Later (~${roundedHr}h)`);

        if (canShrink) {
          const durHard = durLocked;
          if (durHard)
            addOption('shrink', '🔒 Unlock & Shorten', 'unlock', 'Duration locked');
          else
            addOption('shrink', `↔ Shorten (~${roundedHr}h)`);
        }
      }
      break;
    }

  }

  return options;
}

