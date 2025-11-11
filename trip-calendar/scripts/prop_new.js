// same mapping you already use
const LOCK_RANK = { undefined: 0, auto: 1, unlocked: 1, soft: 2, hard: 3 };

function canWrite(ep) {
  // only auto/undefined are writable
  return LOCK_RANK[ep?.lock || 'undefined'] <= LOCK_RANK.auto;
}

function addMinutes(isoUtc, minutes) {
  console.log(isoUtc);
  console.log(minutes);

  const t = new Date(isoUtc).getTime() + minutes * 60000;
  return new Date(t).toISOString();
}

function segDurationMinutes(seg) {
  if (!seg) return 0;

  if (seg.type === 'drive') {
    if (seg.durationMin) return Number(seg.durationMin);
    if (seg.duration?.val) return Math.round(Number(seg.duration.val) * 60);
  }
  if (seg.durationMin) return Number(seg.durationMin);
  if (seg.duration?.minutes) return Number(seg.duration.minutes);
  if (seg.duration?.val) return Math.round(Number(seg.duration.val) * 60);

  return 0;
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
    s.end.meta   = endpointMeta(s.end);
  }
  return segs;
}

/** Pretty logger so we can inspect what’s happening per segment */
function logEmitMatrix(segments) {
  const rows = segments.map((s, i) => ({
    idx: i,
    id: (s.id||'').slice(0,6),
    type: s.type,
    // START
    s_lock: s.start.lock,
    s_rank: s.start.meta?.rank ?? '',
    s_pinned: !!s.start.meta?.pinned,
    s_emitF: !!s.start.meta?.emitsForward,
    s_emitB: !!s.start.meta?.emitsBackward,
    s_utc: s.start.utc || '',
    // END
    e_lock: s.end.lock,
    e_rank: s.end.meta?.rank ?? '',
    e_pinned: !!s.end.meta?.pinned,
    e_emitF: !!s.end.meta?.emitsForward,
    e_emitB: !!s.end.meta?.emitsBackward,
    e_utc: s.end.utc || '',
  }));
  console.table(rows);
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

function logEmitterDirections(segments) {
  const rows = [];
  segments.forEach((s, i) => {
    ['start','end'].forEach(side => {
      const m = s[side].meta;
      if (!m?.pinned) return;
      rows.push({
        idx: i,
        name: s.name,
        type: s.type,
        side,
        rank: m.rank,
        willEmitB: !!m.willEmitBackward,
        willEmitF: !!m.willEmitForward
      });
    });
  });
  console.table(rows);
}


/**
 * propagateTimes
 * Uses willEmitForward / willEmitBackward flags to fill UTCs.
 * Preserves all .meta attributes.
 * Returns a cloned array with updated UTCs.
 */
function propagateTimes(segments) {
  const segs = segments.map(s => ({
    ...s,
    start: { ...(s.start || {}) },
    end: { ...(s.end || {}) },
  }));
  normalizeSegments(segs);

  // ----------- Forward pass -----------
  console.log('Forward pass');
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    if (!s.start?.meta || !s.end?.meta) continue;

    // === Emit from START forward ===
    if (s.start.meta.willEmitForward && s.start.meta.pinned) {
      let cursor = s.start.utc;

      // fill own end if possible
      if (canWrite(s.end)) {
        const dur = segDurationMinutes(s);
        const newEnd = addMinutes(cursor, dur);
        s.end.utc = newEnd;
        cursor = newEnd;
      }

      // continue forward until hitting a stronger/equal pin
      for (let j = i + 1; j < segs.length; j++) {
        const next = segs[j];
        if (!next.start || !next.end) continue;

        // barrier check
        const nextHasBarrier =
        (next.start.meta?.pinned && next.start.meta.rank >= s.start.meta.rank) ||
        (next.end.meta?.pinned && next.end.meta.rank >= s.start.meta.rank);
        if (nextHasBarrier) {
          break;
        }

        // fill next start if writable
        if ((!next.start.utc || next.start.utc === '') && j > 0) {
          const prev = segs[j - 1];
          if (prev?.end?.utc) next.start.utc = prev.end.utc;
        }

        if (canWrite(next.start) && !next.start.utc && cursor)
          next.start.utc = cursor;

        // fill next end
        const dur = segDurationMinutes(next);
        if (canWrite(next.end) && next.start.utc) {
          const newEnd = addMinutes(next.start.utc, dur);
          next.end.utc = newEnd;
          cursor = newEnd;
        } else {
        cursor = next.end.utc;
        }
      }
    }

    // === Emit from END forward ===
    if (s.end.meta.willEmitForward && s.end.meta.pinned) {
      let cursor = s.end.utc;

      for (let j = i + 1; j < segs.length; j++) {
        const next = segs[j];
        if (!next.start || !next.end) continue;

        const nextHasBarrier =
        (next.start.meta?.pinned && next.start.meta.rank >= s.end.meta.rank) ||
        (next.end.meta?.pinned && next.end.meta.rank >= s.end.meta.rank);
        if (nextHasBarrier) {
          break;
        }

        if ((!next.start.utc || next.start.utc === '') && j > 0) {
          const prev = segs[j - 1];
          if (prev?.end?.utc) next.start.utc = prev.end.utc;
        }

        if (canWrite(next.start) && !next.start.utc && cursor) {
          next.start.utc = cursor;
        }

        const dur = segDurationMinutes(next);
        if (canWrite(next.end) && next.start.utc) {
          const newEnd = addMinutes(next.start.utc, dur);
          next.end.utc = newEnd;
          cursor = newEnd;
        } else {
        cursor = next.start.utc || next.end.utc || cursor;
        }
      }
    }
  }


  // ----------- Backward pass -----------
  console.log('Backward pass');
  for (let i = segs.length - 1; i >= 0; i--) {
    const s = segs[i];
    if (!s.start?.meta || !s.end?.meta) continue;

    // === Emit from END backward ===
    if (s.end.meta.willEmitBackward && s.end.meta.pinned) {
      let cursor = s.end.utc;

      // fill own start if possible
      if (canWrite(s.start)) {
        const dur = segDurationMinutes(s);
        const newStart = addMinutes(cursor, -dur);
        s.start.utc = newStart;
        cursor = newStart;
      }

      // continue backward until hitting stronger/equal pin
      for (let j = i - 1; j >= 0; j--) {
        const prev = segs[j];
        if (!prev.start || !prev.end) continue;

        const prevHasBarrier =
          (prev.end.meta?.pinned && prev.end.meta.rank >= s.end.meta.rank) ||
          (prev.start.meta?.pinned && prev.start.meta.rank >= s.end.meta.rank);
        if (prevHasBarrier) {
          break;
        }

        // inherit missing end
        if ((!prev.end.utc || prev.end.utc === '') && j < segs.length - 1) {
          const after = segs[j + 1];
          if (after?.start?.utc) prev.end.utc = after.start.utc;
        }

        if (canWrite(prev.end) && !prev.end.utc && cursor) {
          prev.end.utc = cursor;
        }

        // fill next end
        const dur = segDurationMinutes(prev);
        if (canWrite(prev.start) && prev.end.utc) {
          const newStart = addMinutes(prev.end.utc, -dur);
          prev.start.utc = newStart;
          cursor = newStart;
        } else {
          cursor = prev.start.utc || prev.end.utc || cursor;
        }
      }
    }

    // === Emit from START backward ===
    if (s.start.meta.willEmitBackward && s.start.meta.pinned) {
      let cursor = s.start.utc;

      for (let j = i - 1; j >= 0; j--) {
        const prev = segs[j];
        if (!prev.start || !prev.end) continue;

        const prevHasBarrier =
          (prev.end.meta?.pinned && prev.end.meta.rank >= s.start.meta.rank) ||
          (prev.start.meta?.pinned && prev.start.meta.rank >= s.start.meta.rank);
        if (prevHasBarrier) {
          break;
        }

        if ((!prev.end.utc || prev.end.utc === '') && j < segs.length - 1) {
          const after = segs[j + 1];
          if (after?.start?.utc) prev.end.utc = after.start.utc;
        }

        if (canWrite(prev.end) && !prev.end.utc && cursor) {
          prev.end.utc = cursor;
        }

        const dur = segDurationMinutes(prev);
        if (canWrite(prev.start) && prev.end.utc) {
          const newStart = addMinutes(prev.end.utc, -dur);
          prev.start.utc = newStart;
          cursor = newStart;
        } else {
          cursor = prev.start.utc || prev.end.utc || cursor;
        }
      }
    }
  }

  return segs;
}
