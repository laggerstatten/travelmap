function renderParamField(seg, constraint, paramName) {
  const cid = constraint.cid;
  const ptype = detectParamType(paramName, constraint.type);
  const value = constraint.params[paramName] || '';

  /* ============================
     1. OPERATOR SELECT
     ============================ */
  if (ptype === 'operator') {
    const cat = constraintTypes[constraint.type].operatorCategory;
    const opts = operatorOptions[cat] || [];

    return `
      <label class="param-row">
        ${paramName}:
        <select class="param-operator" data-cid="${cid}" data-param="${paramName}">
          ${opts
            .map(
              (o) =>
                `<option value="${o.value}" ${
                  value === o.value ? 'selected' : ''
                }>
              ${o.label}
            </option>`
            )
            .join('')}
        </select>
      </label>`;
  }

  /* ============================
     2. DAYS OF WEEK CHECKBOXES
     ============================ */
  if (ptype === 'daysOfWeek') {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const selected = Array.isArray(value) ? value : [];

    return `
      <label class="param-row">
        ${paramName}:
        <div class="dow-checkboxes" data-cid="${cid}" data-param="${paramName}">
          ${days
            .map(
              (d) => `
            <label class="dow">
              <input type="checkbox" value="${d}" ${
                selected.includes(d) ? 'checked' : ''
              }>
              ${d}
            </label>
          `
            )
            .join('')}
        </div>
      </label>`;
  }

  /* ============================
     3. MULTIPLE DATES
     ============================ */
  if (ptype === 'multiDate') {
    return `
      <label class="param-row">
        ${paramName}:
        <input class="param-input multi-date"
               data-cid="${cid}" data-param="${paramName}"
               value="${Array.isArray(value) ? value.join(', ') : value}">
      </label>`;
  }

  /* ============================
     4. DATE RANGE
     ============================ */
  if (ptype === 'dateRangeSingle') {
    return `
      <label class="param-row">
        ${paramName}:
        <input class="param-input date-range"
               data-cid="${cid}" data-param="${paramName}"
               value="${
                 value && value.startDate
                   ? `${value.startDate} to ${value.endDate}`
                   : ''
               }">
      </label>`;
  }

  /* ============================
     5. WINDOWS LIST (time windows)
     ============================ */
  if (ptype === 'windowsList') {
    const windows = Array.isArray(value) ? value : [];
    return `
      <div class="param-row windows-editor" data-cid="${cid}" data-param="${paramName}">
        <div class="windows-list">
          ${windows
            .map(
              (w, i) => `
            <div class="window-item" data-index="${i}">
              <input class="window-start" value="${w.startTime || ''}" />
              <span>→</span>
              <input class="window-end" value="${w.endTime || ''}" />
              <button type="button" class="remove-window" data-index="${i}">✕</button>
            </div>
          `
            )
            .join('')}
        </div>
        <button type="button" class="add-window">+ Add Window</button>
      </div>`;
  }

  /* ============================
     6. DATETIME
     ============================ */
  if (ptype === 'datetime') {
    return `
      <label class="param-row">
        ${paramName}:
        <input class="param-input datetime-input"
               data-cid="${cid}" data-param="${paramName}"
               value="${value}">
      </label>`;
  }

  /* ============================
     7. DATE
     ============================ */
  if (ptype === 'date') {
    return `
      <label class="param-row">
        ${paramName}:
        <input class="param-input date-input"
               data-cid="${cid}" data-param="${paramName}"
               value="${value}">
      </label>`;
  }

  /* ============================
     8. TIME
     ============================ */
  if (ptype === 'time') {
    return `
      <label class="param-row">
        ${paramName}:
        <input class="param-input time-input"
               data-cid="${cid}" data-param="${paramName}"
               value="${value}">
      </label>`;
  }

  /* ============================
     9. SEGMENT SELECTOR
     ============================ */
  if (ptype === 'segmentSelector') {
    return `
      <label class="param-row">
        ${paramName}:
        <select class="param-other-seg"
                data-cid="${cid}" data-param="${paramName}">
          ${window.globalSegments
            .map(
              (s) =>
                `<option value="${s.id}" ${s.id === value ? 'selected' : ''}>
              ${s.name || s.id}
            </option>`
            )
            .join('')}
        </select>
      </label>`;
  }

  /* ============================
     10. DEFAULT TEXT FIELD
     ============================ */
  return `
    <label class="param-row">
      ${paramName}:
      <input class="param-input"
             data-cid="${cid}" data-param="${paramName}"
             value="${value}">
    </label>`;
}

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
      def.modes[firstMode].params.map((p) => [p, ''])
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

    seg.constraints.sort((a, b) => a.priority - b.priority);

    seg.constraints.forEach((c, index) => {
      const def = constraintTypes[c.type];
      const modeDef = def.modes[c.mode];

      const li = document.createElement('li');
      li.className = 'constraint-item';

      li.innerHTML = `
        <div class="constraint-item-header">
          <span class="label">${def.label}</span>

          <select class="mode-select" data-cid="${c.cid}">
            ${Object.keys(def.modes)
              .map(
                (m) =>
                  `<option value="${m}" ${
                    c.mode === m ? 'selected' : ''
                  }>${m}</option>`
              )
              .join('')}
          </select>

          <button class="remove-constraint small" data-cid="${c.cid}">✕</button>
        </div>

        <div class="constraint-params">
          ${modeDef.params.map((p) => renderParamField(seg, c, p)).join('')}

        </div>
      `;

      listEl.appendChild(li);

      // Flatpickr for time/date params
      li.querySelectorAll('.param-input').forEach((inp) => {
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
    listEl.querySelectorAll('.mode-select').forEach((sel) => {
      sel.onchange = (e) => {
        const cid = e.target.dataset.cid;
        const c = seg.constraints.find((x) => x.cid === cid);
        c.mode = sel.value;

        const def = constraintTypes[c.type];
        const modeDef = def.modes[c.mode];

        // reset params to match new mode
        c.params = Object.fromEntries(modeDef.params.map((p) => [p, '']));
        renderConstraintList();
      };
    });

    // operator selects
    listEl.querySelectorAll('.param-operator').forEach((sel) => {
      sel.onchange = (e) => {
        const cid = sel.dataset.cid;
        const c = seg.constraints.find((x) => x.cid === cid);
        c.params.operator = sel.value;
      };
    });

    // Update param values
    listEl.querySelectorAll('.param-input').forEach((inp) => {
      inp.onchange = (e) => {
        const cid = inp.dataset.cid;
        const param = inp.dataset.param;
        const c = seg.constraints.find((x) => x.cid === cid);
        c.params[param] = inp.value;
      };
    });

    // Remove constraint
    listEl.querySelectorAll('.remove-constraint').forEach((btn) => {
      btn.onclick = () => {
        seg.constraints = seg.constraints.filter(
          (c) => c.cid !== btn.dataset.cid
        );
        renderConstraintList();
      };
    });

    // Add/remove multi-date editors
    listEl.querySelectorAll('.multi-btn').forEach((btn) => {
      btn.onclick = () =>
        openMultiEditor(seg, btn.dataset.cid, btn.dataset.param);
    });

    // Days-of-week checkboxes
    listEl.querySelectorAll('.dow-checkboxes').forEach((box) => {
      box.onchange = () => {
        const cid = box.dataset.cid;
        const param = box.dataset.param;
        const c = seg.constraints.find((x) => x.cid === cid);
        c.params[param] = [...box.querySelectorAll('input:checked')].map(
          (i) => i.value
        );
      };
    });

    // operator <select> handled separately
    listEl.querySelectorAll('.param-operator').forEach((sel) => {
      sel.onchange = (e) => {
        const cid = sel.dataset.cid;
        const c = seg.constraints.find((x) => x.cid === cid);
        c.params.operator = sel.value;
      };
    });

    // Other segment dropdown
    listEl.querySelectorAll('.param-other-seg').forEach((sel) => {
      sel.onchange = (e) => {
        const cid = sel.dataset.cid;
        const param = sel.dataset.param;
        const c = seg.constraints.find((x) => x.cid === cid);
        c.params[param] = sel.value;
      };
    });

    // MULTIPLE DATES
    listEl.querySelectorAll('.multi-date').forEach((inp) => {
      flatpickr(inp, {
        mode: 'multiple',
        dateFormat: 'Y-m-d',
        defaultDate: (inp.value || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        onChange: (dates, str) => {
          const cid = inp.dataset.cid;
          const param = inp.dataset.param;
          const c = seg.constraints.find((x) => x.cid === cid);
          c.params[param] = dates.map((d) => d.toISOString().slice(0, 10));
        }
      });
    });

    // SINGLE RANGE
    listEl.querySelectorAll('.date-range').forEach((inp) => {
      flatpickr(inp, {
        mode: 'range',
        dateFormat: 'Y-m-d',
        onChange: (dates, str) => {
          const cid = inp.dataset.cid;
          const param = inp.dataset.param;
          const c = seg.constraints.find((x) => x.cid === cid);
          if (dates.length === 2) {
            c.params[param] = {
              startDate: dates[0].toISOString().slice(0, 10),
              endDate: dates[1].toISOString().slice(0, 10)
            };
          }
        }
      });
    });

    // DATETIME
    listEl.querySelectorAll('.datetime-input').forEach((inp) => {
      flatpickr(inp, {
        enableTime: true,
        dateFormat: 'Y-m-d H:i',
        onChange: (dates, str) => {
          const cid = inp.dataset.cid;
          const param = inp.dataset.param;
          const c = seg.constraints.find((x) => x.cid === cid);
          c.params[param] = str;
        }
      });
    });

    // DATE ONLY
    listEl.querySelectorAll('.date-input').forEach((inp) => {
      flatpickr(inp, {
        dateFormat: 'Y-m-d',
        onChange: (dates, str) => {
          const c = seg.constraints.find((x) => x.cid === inp.dataset.cid);
          c.params[inp.dataset.param] = str;
        }
      });
    });

    // TIME ONLY
    listEl.querySelectorAll('.time-input').forEach((inp) => {
      flatpickr(inp, {
        enableTime: true,
        noCalendar: true,
        dateFormat: 'H:i',
        onChange: (dates, str) => {
          const c = seg.constraints.find((x) => x.cid === inp.dataset.cid);
          c.params[inp.dataset.param] = str;
        }
      });
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
        seg.constraints.forEach((c, i) => (c.priority = i));
      }
    });
  }

  renderConstraintList();
}

function openMultiEditor(seg, cid, paramName) {
  alert(`TODO: open multi-editor for ${paramName}`);
}

/* =====================================
   Param Type Detection Helpers
   ===================================== */

function detectParamType(paramName, constraintType) {
  const name = paramName.toLowerCase();

  // Operators
  if (paramName === 'operator') return 'operator';

  // Days / DOW
  if (paramName === 'days' || paramName === 'daysofweek') return 'daysOfWeek';

  // Multiple dates
  if (
    paramName === 'dates' ||
    paramName === 'include' ||
    paramName === 'exclude'
  )
    return 'multiDate';

  // Ranges (single range)
  if (paramName === 'ranges') return 'dateRangeSingle';

  // Time windows
  if (paramName === 'windows') return 'windowsList';

  // Single datetime
  if (name.endsWith('datetime')) return 'datetime';

  // Single date
  if (name.endsWith('date')) return 'date';

  // Single time
  if (name.endsWith('time')) return 'time';

  // Segment selector
  if (paramName === 'otherSegmentId') return 'segmentSelector';

  // fallback
  return 'text';
}
