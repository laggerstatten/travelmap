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
                    const name = li.querySelector('.item-name') ?.value.trim() ;
                    const dur = parseFloat(li.querySelector('.item-dur') ?.value || 0 );
                    return name ? { name, dur: isNaN(dur) ? null : dur } : null;
                })
                .filter(Boolean);
            seg.items = items;
        }

        if (seg.type === 'drive') {
            const breakHr = items.reduce((a, b) => a + (b.dur || 0), 0);
            const baseHr = parseFloat(seg.durationHr || seg.duration ?.val || 0 );
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
                .closest('label') ?.querySelector('.lock-toggle') ;
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
        if (!f ?.geometry ) return;

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




