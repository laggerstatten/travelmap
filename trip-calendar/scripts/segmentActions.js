function attachCardDragHandlers(card) {
  const id = card.dataset.id;

  // --- Drag logic ---
  card.draggable = true;
  card.addEventListener('dragstart', (ev) => {
    if (card.classList.contains('editing')) {
      ev.preventDefault();
      return;
    }
    card.classList.add('dragging');
    ev.dataTransfer.effectAllowed = 'move';
    ev.dataTransfer.setData('text/plain', id);
  });

  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
    reorderFromDOM(document.getElementById('calendar'));
  });
}

function handleDragOver(e) {
  e.preventDefault();
  const cal = e.currentTarget;
  const dragging = cal.querySelector('.timeline-card.dragging');
  if (!dragging) return;

  // find card immediately after the cursor
  const after = getDragAfterElement(cal, e.clientY);
  const rails = dragging.closest('.rail-pair');
  if (!rails) return;

  const draggingWrapper = rails; // move the whole pair, not just card

  if (after) {
    cal.insertBefore(draggingWrapper, after.closest('.rail-pair'));
  } else {
    cal.appendChild(draggingWrapper);
  }
}

function getDragAfterElement(container, y) {
  // include entire rail-pair for position math
  const pairs = [...container.querySelectorAll('.rail-pair:not(.dragging)')];
  return pairs.reduce(
    (closest, el) => {
      const box = el.getBoundingClientRect();
      const offset = y - (box.top + box.height / 2);
      return offset < 0 && offset > closest.offset ? { offset, element: el.querySelector('.timeline-card') } :
        closest;
    }, { offset: Number.NEGATIVE_INFINITY, element: null }
  ).element;
}


function reorderFromDOM(calendar) {
const ids = [...calendar.querySelectorAll('.rail-pair .timeline-card')]
    .map(el => el.dataset.id);

  segments = ids.map(id => segments.find(s => s.id === id));
  saveSegments(segments);
  //renderTimeline(syncGlobal());
}






function attachLockButtons(editor, seg) {
  editor.querySelectorAll('.lock-toggle').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const fieldPath = e.currentTarget.dataset.field;
      if (!fieldPath) return;

      const [base, key] = fieldPath.split('.');
      const targetObj = key ? seg[base] : seg;

      if (!targetObj || targetObj.lock === 'soft') return;

      targetObj.lock = targetObj.lock === 'hard' ? 'unlocked' : 'hard';

      const icon = e.currentTarget.querySelector('i');
      if (targetObj.lock === 'hard') {
        icon.className = 'fa-solid fa-lock';
        e.currentTarget.title = 'Hard locked — click to unlock';
      } else {
        icon.className = 'fa-regular fa-square';
        e.currentTarget.title = 'Unlocked — click to hard lock';
      }
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

function handleEditorSubmit(editor, seg, card) {
  editor.addEventListener('submit', (submitEv) => {
    submitEv.preventDefault();

    const formData = Object.fromEntries(new FormData(editor).entries());
    console.log(formData);
    const prev = structuredClone(seg); // full copy

    // ✅ Ensure nested structure exists
    seg.start ??= { utc: '', lock: 'unlocked' };
    seg.end ??= { utc: '', lock: 'unlocked' };
    seg.duration ??= { val: null, lock: 'unlocked' };

    // Parse numeric duration
    const durVal = formData['duration']?.trim()
      ? Number(formData['duration'])
      : null;

    // Convert form times to UTC
    const newStartUTC = formData['start']
      ? localToUTC(formData['start'], seg.timeZone)
      : '';
    const newEndUTC = formData['end']
      ? localToUTC(formData['end'], seg.timeZone)
      : '';

    // Only set hard locks if user explicitly changed or field was previously unlocked
    if (newStartUTC && newStartUTC !== prev.start?.utc) {
      seg.start.utc = newStartUTC;
      if (seg.start.lock !== 'hard') seg.start.lock = 'unlocked';
    }
    if (newEndUTC && newEndUTC !== prev.end?.utc) {
      seg.end.utc = newEndUTC;
      if (seg.end.lock !== 'hard') seg.end.lock = 'unlocked';
    }
    if (durVal !== null && durVal !== Number(prev.duration?.val || 0)) {
      seg.duration.val = durVal;
      if (seg.duration.lock !== 'hard') seg.duration.lock = 'unlocked';
    }

    // Preserve any existing soft/unlocked states
    seg.start.lock ??= prev.start?.lock || 'unlocked';
    seg.end.lock ??= prev.end?.lock || 'unlocked';
    seg.duration.lock ??= prev.duration?.lock || 'unlocked';

    // Apply derived/soft lock logic
    updateLockConsistency(seg);

    seg.name = formData.name || '';
    seg.type = formData.type || 'stop';

    if (seg.type === 'drive' && seg.autoDrive) {
      seg.manualEdit = true;
      seg.autoDrive = false;
    }

    card.classList.remove('editing');
    editor.remove();
    if (
      seg.isQueued &&
      (seg.type === 'trip_start' || seg.type === 'trip_end')
    ) {
      seg.isQueued = false;
    }

    if (seg.openEditor) {
      seg.openEditor = false;
    }

    // PERSIST THE UPDATED SEGMENT
    const list = loadSegments();
    const idx = list.findIndex(s => s.id === seg.id);
    if (idx !== -1) {
      // merge (seg is already mutated, but ensure array element is updated)
      list[idx] = seg;
      saveSegments(list);
    } else {
      // if somehow not found, append and save
      list.push(seg);
      saveSegments(list);
    }

    renderTimeline(syncGlobal());
  });
}

function attachGeocoder(editor, seg) {
  const container = editor.querySelector(`#geocoder-${seg.id}`);
  console.log(container);
  if (!container) return;

  const geocoder = new MapboxGeocoder({
    accessToken: mapboxgl.accessToken,
    useBrowserFocus: true,
    marker: false,
    placeholder: seg.location_name || "Search location",
    types: "country,region,place,postcode,locality,neighborhood",
    limit: 5
  });

  // Mount geocoder directly into that div
  geocoder.addTo(container);

  // Handle selection
  geocoder.on("result", async (e) => {
    const f = e.result;
    if (!f?.geometry) return;

    seg.coordinates = f.geometry.coordinates;
    seg.location_name = f.text || f.place_name || '';

    if (!seg.name || seg.name.trim() === '' || seg.name === '(untitled)') {
      seg.name = seg.location_name;
      const input = editor.querySelector('input[name="name"]');
      if (input) input.value = seg.name;
    }

    try {
      seg.timeZone = await getTimeZone(seg.coordinates);
    } catch (err) {
      console.warn('Timezone lookup failed:', err);
    }
  });

  // Optional: clear handler if you want to wipe stored coords
  geocoder.on("clear", () => {
    seg.coordinates = null;
    seg.location_name = '';
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

function editSegment(seg, card) {
  if (card.classList.contains('editing')) return;
  card.classList.add('editing');
  const editor = buildOnCardEditor(seg, card);
}

function deleteSegment(seg, card) {
  const id = seg.id;
  deleteSegmentById(id);
  renderTimeline(syncGlobal());
}

function deleteSegmentById(id) {
  let segments = loadSegments();
  const idx = segments.findIndex((seg) => String(seg.id) === String(id));
  if (idx !== -1) {
    segments.splice(idx, 1);
    saveSegments(segments);
  }
}






