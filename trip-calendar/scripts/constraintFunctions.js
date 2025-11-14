///////////////////////////////////////////////////////////////
// PARAM TYPE DETECTOR
///////////////////////////////////////////////////////////////

function detectParamType(paramName) {
  const n = paramName.toLowerCase();

  if (paramName === 'operator') return 'operator';
  if (paramName === 'days' || paramName === 'daysofweek') return 'daysOfWeek';
  if (
    paramName === 'dates' ||
    paramName === 'include' ||
    paramName === 'exclude'
  )
    return 'multiDate';
  if (paramName === 'ranges') return 'dateRange';
  if (paramName === 'windows') return 'windowsList';
  if (n.endsWith('datetime')) return 'datetime';
  if (n.endsWith('date')) return 'date';
  if (n.endsWith('time')) return 'time';
  if (paramName === 'otherSegmentId') return 'segmentSelector';

  return 'text';
}

///////////////////////////////////////////////////////////////
// RENDER PARAM FIELDS
///////////////////////////////////////////////////////////////

function renderParamField(seg, constraint, paramName) {
  const cid = constraint.cid;
  const ptype = detectParamType(paramName);
  const value = constraint.params[paramName];

  // --- 1. OPERATOR ---
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
                  o.value === value ? 'selected' : ''
                }>${o.label}</option>`
            )
            .join('')}
        </select>
      </label>
    `;
  }

  // --- 2. DAYS OF WEEK ---
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
              }> ${d}
            </label>
          `
            )
            .join('')}
        </div>
      </label>`;
  }

  // --- 3. MULTIPLE DATES ---
  if (ptype === 'multiDate') {
    const valStr = Array.isArray(value) ? value.join(', ') : '';
    /**
        return `
          <label class="param-row">
            ${paramName}:
            <input class="param-input multi-date"
              data-cid="${cid}" data-param="${paramName}"
              value="${valStr}">
          </label>`;
    */

    return `
      <label class="param-row">
        ${paramName}:
        <input class="param-input multi-date"
          data-cid="${cid}" data-param="${paramName}">
      </label>`;

  }






  // --- 4. DATE RANGE ---
  if (ptype === 'dateRange') {
    /**
        const display =
          Array.isArray(value) && value.length === 2
            ? `${value[0]} to ${value[1]}`
            : '';
    
        return `
          <label class="param-row">
            ${paramName}:
            <input class="param-input date-range"
              data-cid="${cid}" data-param="${paramName}"
              value="${display}">
          </label>`;
      }
    */

        return `
            <label class="param-row">
                ${paramName}:
                <input class="param-input date-range"
                data-cid="${cid}" data-param="${paramName}">
            </label>
            `;

      }




  // --- 5. OTHER TYPES ---
  if (ptype === 'datetime') {
    return `
      <label class="param-row">
        ${paramName}:
        <input class="param-input datetime-input"
          data-cid="${cid}" data-param="${paramName}"
          value="${value || ''}">
      </label>`;
  }

  if (ptype === 'date') {
    return `
      <label class="param-row">
        ${paramName}:
        <input class="param-input date-input"
          data-cid="${cid}" data-param="${paramName}"
          value="${value || ''}">
      </label>`;
  }

  if (ptype === 'time') {
    return `
      <label class="param-row">
        ${paramName}:
        <input class="param-input time-input"
          data-cid="${cid}" data-param="${paramName}"
          value="${value || ''}">
      </label>`;
  }

  if (ptype === 'segmentSelector') {
    return `
      <label class="param-row">
        ${paramName}:
        <select class="param-other-seg"
          data-cid="${cid}" data-param="${paramName}">
          ${window.globalSegments
            .map(
              (s) =>
                `<option value="${s.id}" ${value === s.id ? 'selected' : ''}>${
                  s.name || s.id
                }</option>`
            )
            .join('')}
        </select>
      </label>
    `;
  }

  // --- FALLBACK ---
  return `
    <label class="param-row">
      ${paramName}:
      <input class="param-input"
        data-cid="${cid}" data-param="${paramName}"
        value="${value || ''}">
    </label>`;
}

///////////////////////////////////////////////////////////////
// MAIN EDITOR
///////////////////////////////////////////////////////////////

function attachConstraintEditor(form, seg) {
  seg.constraints = seg.constraints || [];

  const typeSelect = form.querySelector('.constraint-type-select');
  const addBtn = form.querySelector('.add-constraint');
  const listEl = form.querySelector('.constraint-list');

  // populate dropdown
  Object.entries(constraintTypes).forEach(([key, def]) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = def.label;
    typeSelect.appendChild(opt);
  });

  addBtn.onclick = () => {
    const type = typeSelect.value;
    const def = constraintTypes[type];
    const mode = Object.keys(def.modes)[0];

    const params = {};
    def.modes[mode].params.forEach((p) => {
      const ptype = detectParamType(p);
      if (ptype === 'dateRange') params[p] = [];
      else if (ptype === 'multiDate') params[p] = [];
      else params[p] = '';
    });

    seg.constraints.push({
      cid: crypto.randomUUID(),
      type,
      mode,
      priority: seg.constraints.length,
      params
    });

    renderConstraintList();
  };

  function renderConstraintList() {
    listEl.innerHTML = '';

    seg.constraints.sort((a, b) => a.priority - b.priority);

    seg.constraints.forEach((c) => {
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

          <button class="remove-constraint" data-cid="${c.cid}">✕</button>
        </div>

        <div class="constraint-params">
          ${modeDef.params.map((p) => renderParamField(seg, c, p)).join('')}

        </div>
      `;

      listEl.appendChild(li);
    });

    wireEvents();
    enableSorting();
    initFlatpickr();
  }

  ///////////////////////////////////////////////////////////////
  // EVENTS
  ///////////////////////////////////////////////////////////////

  function wireEvents() {
    // MODE CHANGES
    listEl.querySelectorAll('.mode-select').forEach((sel) => {
      sel.onchange = () => {
        const cid = sel.dataset.cid;
        const c = seg.constraints.find((x) => x.cid === cid);
        c.mode = sel.value;

        const modeDef = constraintTypes[c.type].modes[c.mode];

        c.params = {};
        modeDef.params.forEach((p) => {
          const t = detectParamType(p);
          if (t === 'dateRange' || t === 'multiDate') c.params[p] = [];
          else c.params[p] = '';
        });

        renderConstraintList();
      };
    });

    // REMOVE
    listEl.querySelectorAll('.remove-constraint').forEach((btn) => {
      btn.onclick = () => {
        seg.constraints = seg.constraints.filter(
          (c) => c.cid !== btn.dataset.cid
        );
        renderConstraintList();
      };
    });

    // TEXT INPUTS
    listEl.querySelectorAll('.param-input').forEach((inp) => {
      inp.onchange = () => {
        const cid = inp.dataset.cid;
        const param = inp.dataset.param;
        const c = seg.constraints.find((x) => x.cid === cid);
        c.params[param] = inp.value;
      };
    });

    // OPERATOR
    listEl.querySelectorAll('.param-operator').forEach((sel) => {
      sel.onchange = () => {
        const cid = sel.dataset.cid;
        const c = seg.constraints.find((x) => x.cid === cid);
        c.params.operator = sel.value;
      };
    });

    // DAYS
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

    // SEGMENT SELECT
    listEl.querySelectorAll('.param-other-seg').forEach((sel) => {
      sel.onchange = () => {
        const cid = sel.dataset.cid;
        const param = sel.dataset.param;
        const c = seg.constraints.find((x) => x.cid === cid);
        c.params[param] = sel.value;
      };
    });
  }

  ///////////////////////////////////////////////////////////////
  // FLATPICKR INITIALIZATION
  ///////////////////////////////////////////////////////////////

  function initFlatpickr() {
    // MULTI-DATE
    listEl.querySelectorAll('.multi-date').forEach((inp) => {
      const cid = inp.dataset.cid;
      const param = inp.dataset.param;
      const c = seg.constraints.find((x) => x.cid === cid);

      flatpickr(inp, {
        mode: 'multiple',
        dateFormat: 'Y-m-d',
        defaultDate: Array.isArray(c.params[param]) ? c.params[param] : [],
        onChange: (dates) => {
          c.params[param] = dates.map((d) => d.toISOString().slice(0, 10));
        }
      });
    });

    // DATE RANGE
    listEl.querySelectorAll('.date-range').forEach((inp) => {
      const cid = inp.dataset.cid;
      const param = inp.dataset.param;
      const c = seg.constraints.find((x) => x.cid === cid);

      flatpickr(inp, {
        mode: 'range',
        dateFormat: 'Y-m-d',
        defaultDate: Array.isArray(c.params[param]) ? c.params[param] : [],
        onChange: (dates) => {
          if (dates.length === 2) {
            c.params[param] = [
              dates[0].toISOString().slice(0, 10),
              dates[1].toISOString().slice(0, 10)
            ];
          } else {
            c.params[param] = [];
          }
        }
      });
    });

    // DATE-TIME
    listEl.querySelectorAll('.datetime-input').forEach((inp) => {
      const cid = inp.dataset.cid;
      const param = inp.dataset.param;
      const c = seg.constraints.find((x) => x.cid === cid);

      flatpickr(inp, {
        enableTime: true,
        dateFormat: 'Y-m-d H:i',
        defaultDate: c.params[param] || null,
        onChange: (_, str) => {
          c.params[param] = str;
        }
      });
    });

    // DATE ONLY
    listEl.querySelectorAll('.date-input').forEach((inp) => {
      const cid = inp.dataset.cid;
      const param = inp.dataset.param;
      const c = seg.constraints.find((x) => x.cid === cid);

      flatpickr(inp, {
        dateFormat: 'Y-m-d',
        defaultDate: c.params[param] || null,
        onChange: (_, str) => {
          c.params[param] = str;
        }
      });
    });

    // TIME ONLY
    listEl.querySelectorAll('.time-input').forEach((inp) => {
      const cid = inp.dataset.cid;
      const param = inp.dataset.param;
      const c = seg.constraints.find((x) => x.cid === cid);

      flatpickr(inp, {
        enableTime: true,
        noCalendar: true,
        dateFormat: 'H:i',
        defaultDate: c.params[param] || null,
        onChange: (_, str) => {
          c.params[param] = str;
        }
      });
    });
  }

  ///////////////////////////////////////////////////////////////
  // SORTING
  ///////////////////////////////////////////////////////////////

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

///////////////////////////////////////////////////////////////
// MULTI EDITOR (not used yet)
///////////////////////////////////////////////////////////////

function openMultiEditor() {
  alert('TODO');
}
