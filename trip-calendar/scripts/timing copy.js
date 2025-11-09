  function attachLockButtons(editor, seg) {
    editor.querySelectorAll('.lock-toggle').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const fieldPath = e.currentTarget.dataset.field;
        if (!fieldPath) return;
  
        const [base, key] = fieldPath.split('.');
        const target = key ? seg[base]?.[key] : seg[base];
        const targetObj = key ? seg[base] : seg;
  
        if (!targetObj || typeof targetObj.lock === 'undefined') return;
        if (targetObj.lock === 'soft') return;
  
        targetObj.lock = targetObj.lock === 'hard' ? 'unlocked' : 'hard';
  
        // Update the icon + title
        e.currentTarget.textContent = targetObj.lock === 'hard' ? '🔒' : '🔓';
        e.currentTarget.title =
          targetObj.lock === 'hard'
            ? 'Hard locked — click to unlock'
            : 'Unlocked — click to hard lock';
      });
    });
  }


function attachClearButtons(editor, seg) {
  editor.querySelectorAll('.clear-field').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const field = e.currentTarget.dataset.field;
      if (!field) return;

      // Clear the form control value
      const input = editor.querySelector(`[name="${field}"]`);
      if (input) input.value = '';

      // Clear the segment field properly
      if (field === 'duration') {
        seg.duration.val = null;
        seg.duration.lock = 'unlocked';
      } else if (field === 'start' || field === 'end') {
        seg[field].utc = '';
        seg[field].lock = 'unlocked';
      }

      // Optional: update lock icon in the editor
      const lockBtn = e.currentTarget
        .closest('label')
        ?.querySelector('.lock-toggle');
      if (lockBtn) {
        lockBtn.textContent = '🔓';
        lockBtn.title = 'Unlocked — click to hard lock';
        lockBtn.disabled = false;
      }
    });
  });
}

function updateLockConsistency(seg) {
  const locks = {
    start: seg.start.lock,
    end: seg.end.lock,
    duration: seg.duration.lock
  };

  const hardCount = Object.values(locks).filter((l) => l === 'hard').length;

  // Clear derived states first
  if (locks.start !== 'hard') seg.start.lock = 'unlocked';
  if (locks.end !== 'hard') seg.end.lock = 'unlocked';
  if (locks.duration !== 'hard') seg.duration.lock = 'unlocked';

  // ────────────────────────────────
  // 1️⃣ Exactly two hard locks → derive the third as soft
  // ────────────────────────────────
  if (hardCount === 2) {
    const hardStart = locks.start === 'hard';
    const hardEnd = locks.end === 'hard';
    const hardDur = locks.duration === 'hard';

    if (hardStart && hardEnd && !hardDur) {
      seg.duration.val = durationFromStartEnd(seg.start.utc, seg.end.utc);
      seg.duration.lock = 'soft';
    } else if (hardStart && hardDur && !hardEnd) {
      seg.end.utc = endFromDuration(seg.start.utc, seg.duration.val);
      seg.end.lock = 'soft';
    } else if (hardEnd && hardDur && !hardStart) {
      seg.start.utc = startFromDuration(seg.end.utc, seg.duration.val);
      seg.start.lock = 'soft';
    }
  }

  // ────────────────────────────────
  // 2️⃣ One or zero hard locks → everything else stays unlocked
  // ────────────────────────────────
  // (no auto-promotion to hard — user must click to lock)
}

function durationFromStartEnd(startUTC, endUTC) {
  const s = new Date(startUTC),
    e = new Date(endUTC);
  return (e - s) / 3600000; // hours
}

function endFromDuration(startUTC, hours) {
  const s = new Date(startUTC);
  return new Date(s.getTime() + hours * 3600000).toISOString();
}

function startFromDuration(endUTC, hours) {
  const e = new Date(endUTC);
  return new Date(e.getTime() - hours * 3600000).toISOString();
}


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

  save();
  renderTimeline();
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
  renderTimeline();
}



function addMinutesUTC(utcString, minutes) {
  const date = new Date(utcString);
  const newDate = new Date(date.getTime() + minutes * 60000);
  return newDate.toISOString();
}