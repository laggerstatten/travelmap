// same mapping you already use
const LOCK_RANK = { undefined: 0, auto: 1, unlocked: 1, soft: 2, hard: 3 };

function canWrite(ep) {
  // only auto/undefined are writable
  return LOCK_RANK[ep?.lock || 'undefined'] <= LOCK_RANK.auto;
}

function normalizeSegments(segments) {
  for (const s of segments) {
    s.start    ??= { utc: '', lock: 'undefined' };
    s.end      ??= { utc: '', lock: 'undefined' };
    s.duration ??= { val: 0, lock: 'undefined' };
  }
}

// internal helper: derive endpoint meta
function endpointMeta(ep) {
  const lock = ep?.lock ?? 'undefined';
  const rank = LOCK_RANK[lock] ?? 0;
  const hasUtc = !!ep?.utc;
  const pinned = hasUtc && rank >= LOCK_RANK.soft;

  // For debugging simplicity: a pinned endpoint is an emitter in BOTH directions.
  // (Later we can narrow this if you decide “start only emits fwd” / “end only emits back”.)
  const emitsForward  = pinned;
  const emitsBackward = pinned;

  return { lock, rank, hasUtc, pinned, emitsForward, emitsBackward };
}

/**
 * annotateEmitters
 * Adds .meta objects on start/end: { lock, rank, hasUtc, pinned, emitsForward, emitsBackward }
 * Does NOT modify utc values. Pure: returns a cloned array.
 */
function annotateEmitters(list) {
  const segs = list.map(s => ({ ...s, start: { ...(s.start||{}) }, end: { ...(s.end||{}) } }));
  normalizeSegments(segs);

  for (const s of segs) {
    s.start.meta = endpointMeta(s.start);
    s.start.emitsForward = s.start.meta.emitsForward;
    s.start.emitsBackward = s.start.meta.emitsBackward;
    s.end.meta   = endpointMeta(s.end);
    s.end.emitsForward = s.end.meta.emitsForward;
    s.end.emitsBackward = s.end.meta.emitsBackward;
  }
  return segs;
}

/**
 * Determine whether each emitter will actually emit forward/backward
 * based on the relative rank of the nearest upstream and downstream emitters.
 * Does NOT modify UTCs or perform propagation.
 */
function determineEmitterDirections(segments, { priority = 'forward' } = {}) {
  const segs = annotateEmitters(segments); // ensures .meta fields exist
  const emitters = [];

  // collect all emitters (pinned start or end)
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    if (s.start.meta.pinned) emitters.push({ idx: i, side: 'start', rank: s.start.meta.rank });
    if (s.end.meta.pinned)   emitters.push({ idx: i, side: 'end',   rank: s.end.meta.rank });
  }

  // For quick lookup, we can flatten to array of {indexInSegments, side, rank}
  const emitterPositions = emitters.map((e, j) => ({ ...e, order: j }));

  // helper to find nearest upstream emitter index (smaller segment index)
  function findUpstream(currentIdx) {
    for (let i = currentIdx - 1; i >= 0; i--) {
      const s = segs[i];
      if (s.end.meta.pinned || s.start.meta.pinned) {
        const ep = s.end.meta.pinned ? s.end.meta : s.start.meta;
        return { idx: i, rank: ep.rank };
      }
    }
    return null;
  }

  // helper to find nearest downstream emitter index (larger segment index)
  function findDownstream(currentIdx) {
    for (let i = currentIdx + 1; i < segs.length; i++) {
      const s = segs[i];
      if (s.start.meta.pinned || s.end.meta.pinned) {
        const ep = s.start.meta.pinned ? s.start.meta : s.end.meta;
        return { idx: i, rank: ep.rank };
      }
    }
    return null;
  }

  // evaluate each emitter
  for (const e of emitters) {
    const upstream = findUpstream(e.idx);
    const downstream = findDownstream(e.idx);

    // initialize flags
    let willForward = false;
    let willBackward = false;

    // forward emission (downstream)
    if (downstream) {
      if (e.rank > downstream.rank) willForward = true;
      else if (e.rank < downstream.rank) willForward = false;
      else willForward = (priority === 'forward');
    } else {
      // no downstream pin → forward until trip end
      willForward = true;
    }

    // backward emission (upstream)
    if (upstream) {
      if (e.rank > upstream.rank) willBackward = true;
      else if (e.rank < upstream.rank) willBackward = false;
      else willBackward = (priority === 'backward');
    } else {
      // no upstream pin → backward until trip start
      willBackward = true;
    }

    // assign results to the correct endpoint meta
    if (e.side === 'start') {
      segs[e.idx].start.meta.willEmitForward = willForward;
      segs[e.idx].start.meta.willEmitBackward = willBackward;
    } else {
      segs[e.idx].end.meta.willEmitForward = willForward;
      segs[e.idx].end.meta.willEmitBackward = willBackward;
    }
  }

  return segs;
}

/**
 * propagateTimes
 */
function propagateTimes(segments) {
  const segs = segments.map(s => ({
    ...s,
    start: { ...(s.start || {}), meta: { ...(s.start?.meta || {}) } },
    end: { ...(s.end || {}), meta: { ...(s.end?.meta || {}) } }
  }));
  normalizeSegments(segs);
  propagateForward(segs);
  propagateBackward(segs);

  return segs;
}

/* ----------------------------- FORWARD PASS ----------------------------- */
function propagateForward(segs) {
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];

    const emitFromStart = s.start?.meta?.willEmitForward && s.start?.meta?.pinned;
    const emitFromEnd   = s.end?.meta?.willEmitForward && s.end?.meta?.pinned;
    if (!emitFromStart && !emitFromEnd) continue;


    const cursorField = emitFromStart ? "start" : "end";
    let cursor = s[cursorField].utc;
    const rank = s[cursorField].meta.rank;

    // fill own end if starting from start
    const dur = segDurationMinutes(s);
    if (emitFromStart && canWrite(s.end) && cursor) {
      s.end.utc = addMinutes(cursor, dur);
      cursor = s.end.utc;
    }

    // fill wave forward
    for (let j = i + 1; j < segs.length; j++) {
      const next = segs[j];
      if (!next.start || !next.end) continue;

      const barrier =
        (next.start.meta?.pinned && next.start.meta.rank >= rank) ||
        (next.end.meta?.pinned && next.end.meta.rank >= rank) ||
        next.start.meta?.willEmitBackward ||
        next.end.meta?.willEmitBackward;

      if (barrier) {
        break;
      }

      const durNext = segDurationMinutes(next);
      if (canWrite(next.start) && cursor) {
        next.start.utc = cursor;
      }
      if (canWrite(next.end) && next.start.utc) {
        const newEnd = addMinutes(next.start.utc, durNext);
        next.end.utc = newEnd;
        cursor = newEnd;
      }
    }
  }
}

/* ----------------------------- BACKWARD PASS ----------------------------- */
function propagateBackward(segs) {
  for (let i = segs.length - 1; i >= 0; i--) {
    const s = segs[i];

    const emitFromEnd   = s.end?.meta?.willEmitBackward && s.end?.meta?.pinned;
    const emitFromStart = s.start?.meta?.willEmitBackward && s.start?.meta?.pinned;
    if (!emitFromEnd && !emitFromStart) continue;


    const cursorField = emitFromEnd ? "end" : "start";
    let cursor = s[cursorField].utc;
    const rank = s[cursorField].meta.rank;

    const dur = segDurationMinutes(s);
    if (emitFromEnd && canWrite(s.start) && cursor) {
      const newStart = addMinutes(cursor, -dur);
      s.start.utc = newStart;
      cursor = newStart;
    }

    // fill wave backward
    for (let j = i - 1; j >= 0; j--) {
      const prev = segs[j];
      if (!prev.start || !prev.end) continue;

      const barrier =
        (prev.start.meta?.pinned && prev.start.meta.rank >= rank) ||
        (prev.end.meta?.pinned && prev.end.meta.rank >= rank) ||
        prev.start.meta?.willEmitForward ||
        prev.end.meta?.willEmitForward;

      if (barrier) {
        break;
      }

      const durPrev = segDurationMinutes(prev);
      if (canWrite(prev.end) && cursor) {
        prev.end.utc = cursor;
      }
      if (canWrite(prev.start) && prev.end.utc) {
        const newStart = addMinutes(prev.end.utc, -durPrev);
        prev.start.utc = newStart;
        cursor = newStart;
      }
    }
  }
}

function segDurationMinutes(seg) {
  if (!seg) return 0;

  if (seg.type === 'drive') {
    //if (seg.durationMin) return Number(seg.durationMin);
    if (seg.duration?.val) return Math.round(Number(seg.duration.val) * 60);
  }
  if (seg.durationMin) return Number(seg.durationMin);
  if (seg.duration?.minutes) return Number(seg.duration.minutes);
  if (seg.duration?.val) return Math.round(Number(seg.duration.val) * 60);

  return 0;
}