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
      return offset < 0 && offset > closest.offset
        ? { offset, element: el.querySelector('.timeline-card') }
        : closest;
    },
    { offset: Number.NEGATIVE_INFINITY, element: null }
  ).element;
}

function reorderFromDOM(calendar) {
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
    console.log('formData');
    console.log(formData);

    // Apply core time/lock updates
    const { changed } = updateSegmentTiming(seg, formData);

    seg.name = formData.name || '';

    // Optional downstream logic
    if (seg.type === 'drive' && seg.autoDrive) {
      seg.manualEdit = true;
      seg.autoDrive = false;
    }

    // Capture subitems
    const items = Array.from(editor.querySelectorAll('.sublist-items li'))
      .map((li) => {
        const name = li.querySelector('.item-name')?.value.trim();
        const dur = parseFloat(li.querySelector('.item-dur')?.value || 0);
        return name ? { name, dur: isNaN(dur) ? null : dur } : null;
      })
      .filter(Boolean);
    seg.items = items;

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

    renderTimeline(syncGlobal());
    card.classList.remove('editing');
    editor.remove();

    console.log(`Segment ${seg.id} updated`, { changed });
  });
}

function updateSegmentTiming(seg, formData) {
  const prev = structuredClone(seg);

  seg.start ??= { utc: '', lock: 'unlocked' };
  seg.end ??= { utc: '', lock: 'unlocked' };
  seg.duration ??= { val: null, lock: 'unlocked' };

  const durVal = formData['duration']?.trim() 
  ? Number(formData['duration']) 
  : null;

  const newStartUTC = formData['start'] 
  ? localToUTC(formData['start'], seg.timeZone) 
  : '';
  const newEndUTC = formData['end']   
  ? localToUTC(formData['end'], seg.timeZone)   
  : '';

  // Apply user edits (don’t recompute yet)
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

  seg.start.lock ??= prev.start?.lock || 'unlocked';
  seg.end.lock ??= prev.end?.lock || 'unlocked';
  seg.duration.lock ??= prev.duration?.lock || 'unlocked';

  updateLockConsistency(seg);

  const changed = {
    start: seg.start.utc !== prev.start?.utc,
    end: seg.end.utc !== prev.end?.utc,
    duration: seg.duration.val !== prev.duration?.val
  };

  recalculateSegmentTimes(seg, changed);
  return { changed, prev };
}

// Helpers
const HOURS = 3600000;
const toDate = (utc) => (utc ? new Date(utc) : null);
const iso = (d) => (d ? new Date(d).toISOString() : '');

function recalculateSegmentTimes(seg, changed = { start:false, end:false, duration:false }) {
  const startLocked = seg.start?.lock === 'hard';
  const endLocked   = seg.end?.lock === 'hard';
  const durLocked   = seg.duration?.lock === 'hard';

  const hasStart = !!seg.start?.utc;
  const hasEnd   = !!seg.end?.utc;
  const hasDur   = seg.duration?.val != null && !isNaN(Number(seg.duration.val));

  const startDT = toDate(seg.start?.utc);
  const endDT   = toDate(seg.end?.utc);
  const durMs   = hasDur ? Number(seg.duration.val) * HOURS : null;

  // --- 1) Two locked => compute the third
  if (startLocked && endLocked) {
    if (hasStart && hasEnd) seg.duration.val = (endDT - startDT) / HOURS;
    return seg;
  }
  if (startLocked && durLocked) {
    if (hasStart && hasDur) seg.end.utc = iso(startDT.getTime() + durMs);
    return seg;
  }
  if (endLocked && durLocked) {
    if (hasEnd && hasDur) seg.start.utc = iso(endDT.getTime() - durMs);
    return seg;
  }

  // --- 2) Exactly one locked => edited field drives the third
  if (startLocked && !endLocked && !durLocked) {
    if (changed.duration && hasStart && hasDur) seg.end.utc = iso(startDT.getTime() + durMs);
    else if (changed.end && hasStart && hasEnd) seg.duration.val = (endDT - startDT) / HOURS;
    return seg;
  }
  if (endLocked && !startLocked && !durLocked) {
    if (changed.duration && hasEnd && hasDur) seg.start.utc = iso(endDT.getTime() - durMs);
    else if (changed.start && hasStart && hasEnd) seg.duration.val = (endDT - startDT) / HOURS;
    return seg;
  }
  if (durLocked && !startLocked && !endLocked) {
    if (changed.start && hasStart && hasDur) seg.end.utc = iso(startDT.getTime() + durMs);
    else if (changed.end && hasEnd && hasDur) seg.start.utc = iso(endDT.getTime() - durMs);
    return seg;
  }

  // --- 3) None locked: prefer the edited field(s)
  // If only one thing changed, compute the dependent third if possible.
  const oneChanged =
    (changed.start?1:0) + (changed.end?1:0) + (changed.duration?1:0) === 1;

  if (oneChanged) {
    if (changed.start && hasStart && hasDur) {
      seg.end.utc = iso(startDT.getTime() + durMs);
      return seg;
    }
    if (changed.end && hasEnd && hasDur) {
      seg.start.utc = iso(endDT.getTime() - durMs);
      return seg;
    }
    if (changed.duration) {
      if (hasStart) seg.end.utc = iso(startDT.getTime() + durMs);
      else if (hasEnd) seg.start.utc = iso(endDT.getTime() - durMs);
      return seg;
    }
  }

  // --- 4) Fallback: if start & end present, keep duration consistent
  if (hasStart && hasEnd) seg.duration.val = (endDT - startDT) / HOURS;

  return seg;
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

/* ===============================
   Drive Duration Updater
   =============================== */
function updateDriveDurations(editor, seg) {
  const durFields = Array.from(editor.querySelectorAll('.item-dur')).map(
    (i) => parseFloat(i.value) || 0
  );
  const breakHr = durFields.reduce((a, b) => a + b, 0);

  seg.breakHr = breakHr;

  const baseHr = parseFloat(seg.durationHr || seg.duration?.val || 0);
  const totalHr = baseHr + breakHr;

  seg.duration = seg.duration || {};
  seg.duration.val = totalHr;

  const durInput = editor.querySelector('input[name="duration"]');
  if (durInput) durInput.value = totalHr.toFixed(2);
}

/* ===============================
   Sublist Handlers (Add / Remove / Reorder / Collapse)
   =============================== */
function attachSublistHandlers(editor, seg) {
  const addBtn = editor.querySelector('.add-item');
  const list = editor.querySelector('.sublist-items');
  const sublist = editor.querySelector('.sublist');
  const toggle = editor.querySelector('.toggle-sublist');
  if (!sublist) return;

  // Prevent outer drag interference
  ['mousedown', 'touchstart', 'pointerdown'].forEach((evt) => {
    sublist.addEventListener(evt, (e) => e.stopPropagation(), {
      passive: true
    });
  });

  // Collapse / expand
  toggle?.addEventListener('click', () => {
    const collapsed = sublist.classList.toggle('collapsed');
    toggle.querySelector('i').className = collapsed
      ? 'fa-solid fa-caret-right'
      : 'fa-solid fa-caret-down';
  });

  addBtn?.addEventListener('click', () => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="drag-handle"><i class="fa-solid fa-grip-vertical"></i></span>
      <input class="item-name" placeholder="Task or stop" />
      <input class="item-dur" type="number" step="0.25" placeholder="hr" />
      <button type="button" class="remove-item">✕</button>`;
    list.appendChild(li);
    sublist.classList.remove('collapsed');
    toggle.querySelector('i').className = 'fa-solid fa-caret-down';
  });

  editor.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-item')) {
      e.target.closest('li').remove();
      if (list.children.length === 0) {
        sublist.classList.add('collapsed');
        toggle.querySelector('i').className = 'fa-solid fa-caret-right';
      }
      if (seg.type === 'drive') updateDriveDurations(editor, seg);
    }
  });

  // Auto-recalculate when durations change (drives only)
  if (seg.type === 'drive') {
    editor.addEventListener('input', (e) => {
      if (e.target.classList.contains('item-dur')) {
        updateDriveDurations(editor, seg);
      }
    });
  }

  // Enable reordering
  if (typeof Sortable !== 'undefined' && list) {
    new Sortable(list, {
      animation: 150,
      handle: '.drag-handle',
      forceFallback: true,
      fallbackOnBody: true,
      fallbackTolerance: 5,
      filter: 'input,button',
      preventOnFilter: false
    });
  }
}

async function resolveOverlapAction(seg, opt) {
  console.log(`Resolving ${opt.action} (${opt.role}) for`, seg.name);

  // minutes/hours are precomputed on opt
  const roundedMin = opt.roundedMin ?? 0;
  const roundedHr  = opt.roundedHr  ?? 0;

  // Unlock if needed
  if (opt.feasibility === 'unlock') {
    if (opt.action === 'moveEarlier' || opt.action === 'moveLater') {
      seg.start.lock = 'unlocked';
      seg.end.lock   = 'unlocked';
    } else if (opt.action === 'shrink') {
      seg.duration.lock = 'unlocked';
      // also unlock the boundary we’ll recompute below
      if (opt.role === 'left') seg.end.lock = 'unlocked';
      else seg.start.lock = 'unlocked';
    }
  }

  const formData = {};

  if (opt.action === 'moveEarlier') {
    formData.start = utcToLocalInput(addMinutes(seg.start.utc, -roundedMin), seg.timeZone);
    formData.end   = utcToLocalInput(addMinutes(seg.end.utc,   -roundedMin), seg.timeZone);
  }

  if (opt.action === 'moveLater') {
    formData.start = utcToLocalInput(addMinutes(seg.start.utc,  roundedMin), seg.timeZone);
    formData.end   = utcToLocalInput(addMinutes(seg.end.utc,    roundedMin), seg.timeZone);
  }

  if (opt.action === 'shrink') {
    // Current duration (minutes) with your helper
    const curDurMin = segDurationMinutes(seg);
    const newDurMin = Math.max(0, curDurMin - roundedMin);
    const newDurHr  = newDurMin / 60;

    // Role determines which boundary stays anchored:
    // left side shrink ⇒ keep START fixed, move END earlier
    // right side shrink ⇒ keep END fixed, move START later
    if (opt.role === 'left') {
      formData.start    = utcToLocalInput(seg.start.utc, seg.timeZone);
      formData.end      = utcToLocalInput(endFromDuration(seg.start.utc, newDurHr), seg.timeZone);
      formData.duration = newDurHr.toFixed(2);
    } else {
      formData.end      = utcToLocalInput(seg.end.utc, seg.timeZone);
      formData.start    = utcToLocalInput(startFromDuration(seg.end.utc, newDurHr), seg.timeZone);
      formData.duration = newDurHr.toFixed(2);
    }
  }

    if (opt.action === 'unlockAndClear') {
      seg.start.utc = '';
      seg.end.utc = '';
      //seg.duration.val = null;
      seg.start.lock = 'unlocked';
      seg.end.lock = 'unlocked';
      seg.duration.lock = 'unlocked';
      seg.isQueued = false;
    }

    if (opt.action === 'unlockAndQueue') {
      seg.start.utc = '';
      seg.end.utc = '';
      //seg.duration.val = null;
      seg.start.lock = 'soft';
      seg.end.lock = 'soft';
      seg.duration.lock = 'soft';
      seg.isQueued = true;
    }





  // Apply via your central logic
  if (Object.keys(formData).length > 0) {
    updateSegmentTiming(seg, formData);
  }

  // Persist + recompute
  let list = loadSegments();
  const idx = list.findIndex(s => s.id === seg.id);
  if (idx !== -1) list[idx] = seg;

  if (opt.action === 'unlockAndQueue') {
    const qIdx = list.findIndex(s => s.id === seg.id);
    if (qIdx > -1) {
      const [item] = list.splice(qIdx, 1);
      list.unshift(item); // put at top
    }
  }

  list = removeSlackAndOverlap(list);
  list = await validateAndRepair(list);
  list = annotateEmitters(list);
  list = determineEmitterDirections(list, { priority: PLANNING_DIRECTION });
  list = propagateTimes(list);
  list = computeSlackAndOverlap(list);

  saveSegments(list);
  renderTimeline(list);
}

/**
  function attachConstraintEditor(form, seg) {
    const listEl = form.querySelector('.constraint-list');
    const addBtn = form.querySelector('.add-constraint');
  
    function renderList() {
      listEl.innerHTML = '';
      seg.constraints = seg.constraints || [];
  
      seg.constraints.forEach((c, i) => {
        const def = constraintTypes[c.type];
        const modeDef = def.modes[c.mode];
  
        const li = document.createElement('li');
        li.className = 'constraint-item';
        li.innerHTML = `
          <div class="flex justify-between items-center mb-1">
            <span class="font-semibold">${def.label}</span>
            <button type="button" data-remove="${i}" class="text-red-500 small">✕</button>
          </div>
          <div class="param-fields space-y-1">
            ${modeDef.params.map(p => `
              <label class="block text-xs">
                ${p}: <input type="text" class="param-input border rounded px-1 w-full" 
                data-index="${i}" data-param="${p}" value="${c.params[p] || ''}">
              </label>
            `).join('')}
          </div>`;
  
        listEl.appendChild(li);
  
        // Flatpickr for date/time params
        li.querySelectorAll('.param-input').forEach(inp => {
          const pname = inp.dataset.param.toLowerCase();
          if (pname.includes('time') || pname.includes('date')) {
            flatpickr(inp, {
              enableTime: pname.includes('time'),
              noCalendar: !pname.includes('date'),
              dateFormat: pname.includes('date') ? 'Y-m-d H:i' : 'H:i',
              time_24hr: true,
              defaultDate: inp.value || null
            });
          }
        });
      });
  
      // Wire up removes
      listEl.querySelectorAll('[data-remove]').forEach(btn => {
        btn.onclick = () => {
          seg.constraints.splice(+btn.dataset.remove, 1);
          renderList();
        };
      });
  
      // Update param values
      listEl.querySelectorAll('.param-input').forEach(inp => {
        inp.onchange = e => {
          const idx = +e.target.dataset.index;
          const param = e.target.dataset.param;
          seg.constraints[idx].params[param] = e.target.value;
        };
      });
  
      // Re-sortable (optional)
      new Sortable(listEl, {
        animation: 150,
        onEnd: evt => {
          const moved = seg.constraints.splice(evt.oldIndex, 1)[0];
          seg.constraints.splice(evt.newIndex, 0, moved);
          seg.constraints.forEach((c, i) => c.priority = i);
        }
      });
    }
  
    addBtn.onclick = () => {
      // Simple picker via prompt (replace with dropdown UI later)
      const typeKeys = Object.keys(constraintTypes);
      const chosen = prompt('Constraint type:\n' + typeKeys.join(', '));
      if (!constraintTypes[chosen]) return alert('Invalid type');
  
      const def = constraintTypes[chosen];
      const firstMode = Object.keys(def.modes)[0];
      const params = Object.fromEntries(def.modes[firstMode].params.map(p => [p, '']));
  
      seg.constraints.push({
        cid: crypto.randomUUID(),
        type: chosen,
        mode: firstMode,
        enabled: true,
        priority: seg.constraints.length,
        params
      });
      renderList();
    };
  
    renderList();
  }
*/


function attachConstraintEditor(form, seg) {
  seg.constraints = seg.constraints || [];

  const typeSelect = form.querySelector('.constraint-type-select');
  const addBtn = form.querySelector('.add-constraint');
  const listEl = form.querySelector('.constraint-list');

  if (!typeSelect || !addBtn || !listEl) return; // safety

  // Populate type dropdown
  Object.entries(constraintTypes).forEach(([key, def]) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = def.label;
    typeSelect.appendChild(opt);
  });

  // Add constraint instance
  addBtn.onclick = () => {
    const type = typeSelect.value;
    const def = constraintTypes[type];
    const firstMode = Object.keys(def.modes)[0];

    const params = Object.fromEntries(
      def.modes[firstMode].params.map(p => [p, ""])
    );

    seg.constraints.push({
      cid: crypto.randomUUID(),
      type,
      mode: firstMode,
      priority: seg.constraints.length,
      params
    });

    renderConstraintList();
  };

  // --- Rendering the actual list ---
  function renderConstraintList() {
    listEl.innerHTML = '';

    seg.constraints.sort((a,b)=>a.priority - b.priority);

    seg.constraints.forEach((c, index) => {
      const def = constraintTypes[c.type];
      const modeDef = def.modes[c.mode];

      const li = document.createElement('li');
      li.className = 'constraint-item';

      li.innerHTML = `
        <div class="constraint-item-header">
          <span class="label">${def.label}</span>

          <select class="mode-select" data-cid="${c.cid}">
            ${Object.keys(def.modes).map(m =>
              `<option value="${m}" ${c.mode === m ? "selected" : ""}>${m}</option>`
            ).join("")}
          </select>

          <button class="remove-constraint small" data-cid="${c.cid}">✕</button>
        </div>

        <div class="constraint-params">
          ${modeDef.params.map(p => `
            <label class="param-row">
              ${p}: <input class="param-input"
                data-cid="${c.cid}" data-param="${p}" value="${c.params[p] || ''}">
            </label>
          `).join("")}
        </div>
      `;

      listEl.appendChild(li);

      // Flatpickr for time/date params
      li.querySelectorAll('.param-input').forEach(inp => {
        const pname = inp.dataset.param.toLowerCase();
        if (pname.includes('time') || pname.includes('date')) {
          flatpickr(inp, {
            enableTime: pname.includes('time'),
            noCalendar: !pname.includes('date'),
            dateFormat: pname.includes('date') ? 'Y-m-d H:i' : 'H:i',
            time_24hr: true
          });
        }
      });
    });

    wireEvents();
    enableSorting();
  }

  // --- Events for mode changes, param edits, removal ---
  function wireEvents() {

    // Change mode
    listEl.querySelectorAll('.mode-select').forEach(sel => {
      sel.onchange = e => {
        const cid = e.target.dataset.cid;
        const c = seg.constraints.find(x => x.cid === cid);
        c.mode = sel.value;

        const def = constraintTypes[c.type];
        const modeDef = def.modes[c.mode];

        // reset params to match new mode
        c.params = Object.fromEntries(modeDef.params.map(p => [p, ""]));
        renderConstraintList();
      };
    });

    // Update param values
    listEl.querySelectorAll('.param-input').forEach(inp => {
      inp.onchange = e => {
        const cid = inp.dataset.cid;
        const param = inp.dataset.param;
        const c = seg.constraints.find(x => x.cid === cid);
        c.params[param] = inp.value;
      };
    });

    // Remove constraint
    listEl.querySelectorAll('.remove-constraint').forEach(btn => {
      btn.onclick = () => {
        seg.constraints = seg.constraints.filter(
          c => c.cid !== btn.dataset.cid
        );
        renderConstraintList();
      };
    });
  }

  // --- Sorting ---
  function enableSorting() {
    new Sortable(listEl, {
      animation: 150,
      handle: '.constraint-item-header',
      onEnd(evt) {
        const moved = seg.constraints.splice(evt.oldIndex, 1)[0];
        seg.constraints.splice(evt.newIndex, 0, moved);
        seg.constraints.forEach((c,i)=>c.priority = i);
      }
    });
  }

  renderConstraintList();
}
