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

