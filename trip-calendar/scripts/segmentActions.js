function attachCardDragHandlers(card) {
  console.log('Attaching drag handlers to card', card);
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
    // do we need to do anything after this?
  });
}

function handleDragOver(e) { //FIXME: uses index lookup
  console.log('Drag over', e);
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

function getDragAfterElement(container, y) { //FIXME: uses index lookup
  console.log('Getting drag after element at y=', y);
  // include entire rail-pair for position math
  const pairs = [...container.querySelectorAll('.rail-pair:not(.dragging)')];
  return pairs.reduce(
    (closest, el) => {
      const box = el.getBoundingClientRect();
      const offset = y - (box.top + box.height / 2);
      return offset < 0 && offset > closest.offset
        ? { offset, element: el.querySelector('.timeline-card') }
        : closest;
    },
    { offset: Number.NEGATIVE_INFINITY, element: null }
  ).element;
}

function reorderFromDOM(calendar) { //FIXME: uses index lookup
  console.log('Reordering segments from DOM');
  const ids = [...calendar.querySelectorAll('.rail-pair .timeline-card')].map(
    (el) => el.dataset.id
  );

  segments = ids.map((id) => segments.find((s) => s.id === id));
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

function attachGeocoder(editor, seg) {
  const container = editor.querySelector(`#geocoder-${seg.id}`);
  if (!container) return;

  const geocoder = new MapboxGeocoder({
    // may need to bias toward map extent
    accessToken: mapboxgl.accessToken,
    useBrowserFocus: true,
    marker: false,
    placeholder: seg.location_name || 'Search location',
    types: 'country,region,place,postcode,locality,neighborhood',
    limit: 5
  });

  // Mount geocoder directly into that div
  geocoder.addTo(container);

  // Handle selection
  geocoder.on('result', async (e) => {
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
  geocoder.on('clear', () => {
    seg.coordinates = null;
    seg.location_name = '';
  });
}

/* ===============================
   Handle Save
   =============================== */
function handleEditorSubmit(editor, seg, card) {
  editor.addEventListener('submit', (submitEv) => {
    submitEv.preventDefault();
    const formData = Object.fromEntries(new FormData(editor).entries());
    //console.log('formData');
    //console.log(formData);

    // Apply core time/lock updates
    const { changed } = updateSegmentTiming(seg, formData);

    seg.name = formData.name || '';

    // Optional downstream logic
    if (seg.type === 'drive' && seg.autoDrive) {
      seg.manualEdit = true;
      seg.autoDrive = false;
    }

    // Capture subitems
    const trackSubitems = true;
    let items = [];
    if (trackSubitems) {
      items = Array.from(editor.querySelectorAll('.sublist-items li'))
        .map((li) => {
          const name = li.querySelector('.item-name')?.value.trim();
          const dur = parseFloat(li.querySelector('.item-dur')?.value || 0);
          return name ? { name, dur: isNaN(dur) ? null : dur } : null;
        })
        .filter(Boolean);
      seg.items = items;
    }

    if (seg.type === 'drive') {
      const breakHr = items.reduce((a, b) => a + (b.dur || 0), 0);
      const baseHr = parseFloat(seg.durationHr || seg.duration?.val || 0);
      seg.breakHr = breakHr;
      seg.duration.val = (baseHr + breakHr).toFixed(2);
    }

    // Queue and UI cleanup
    if (seg.isQueued && (seg.type === 'trip_start' || seg.type === 'trip_end'))
      seg.isQueued = false;
    seg.openEditor = false;

    const list = loadSegments();
    const idx = list.findIndex((s) => s.id === seg.id);
    if (idx !== -1) list[idx] = seg;
    else list.push(seg);
    saveSegments(list);

    // do validation functions need to auto run here?
    // list = await runPipeline(list); // test

    renderTimeline(syncGlobal());
    renderMap(syncGlobal());
    card.classList.remove('editing');
    editor.remove();

    //console.log(`Segment ${seg.id} updated`, { changed });
  });
}

function editSegment(seg, card) {
  if (card.classList.contains('editing')) return;
  card.classList.add('editing');
  const editor = buildOnCardEditor(seg, card);
}

function deleteSegment(seg, card) {
  // fire-and-forget async wrapper
  (async () => {
    const id = seg.id;
    deleteSegmentById(id);

    let segs = loadSegments();

    segs = await runPipeline(segs); // test

    saveSegments(segs);
    renderTimeline(segs);
    renderMap(segs);
  })();
}

function deleteSegmentById(id) { //FIXME: verify is working
  let segments = loadSegments();
  const idx = segments.findIndex((seg) => String(seg.id) === String(id));
  if (idx !== -1) {
    segments.splice(idx, 1);
    saveSegments(segments);
  }
}
