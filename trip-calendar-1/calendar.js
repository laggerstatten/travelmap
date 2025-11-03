const calendar = document.getElementById("calendar");
const modal = document.getElementById("event-modal");
const form = document.getElementById("event-form");

let events = JSON.parse(localStorage.getItem("tripEvents")) || [];
let currentEdit = null;
let viewMode = "timeline";

/* ---------- Core Helpers ---------- */
function save(noRender = false) {
    localStorage.setItem("tripEvents", JSON.stringify(events));
    if (!noRender) render();
}

function fmtDate(dtString) {
    if (!dtString) return "";
    const d = new Date(dtString);
    return isNaN(d) ?
        "" :
        d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function parseDate(v) {
    const d = new Date(v);
    return isNaN(d) ? null : d;
}

/* ---------- Sorting ---------- */
function sortByDateInPlace(list) {
    const dated = list.filter((e) => parseDate(e.start));
    const undated = list.filter((e) => !parseDate(e.start));
    dated.sort((a, b) => parseDate(a.start) - parseDate(b.start));

    const merged = [];
    let di = 0;
    for (const e of list) {
        if (!parseDate(e.start)) merged.push(e);
        else merged.push(dated[di++]);
    }
    list.splice(0, list.length, ...merged);
}

function sortByDate() {
    sortByDateInPlace(events);
    save();
}

/* ---------- Drive Segment Logic ---------- */
function insertDriveSegments() {
    sortByDateInPlace(events);
    const newList = [];
    for (let i = 0; i < events.length; i++) {
        newList.push(events[i]);
        const cur = events[i];
        const next = events[i + 1];
        if (!next) break;
        if (cur.type !== "drive" && next.type !== "drive") {
            newList.push({
                id: Date.now() + i,
                name: `Drive to ${next.name || "next stop"}`,
                type: "drive",
                autoDrive: true,
                manualEdit: false,
                start: cur.end || "",
                end: "",
            });
        }
    }
    events = newList;
    save();
}

function clearAutoDrives() {
    events = events.filter(
        (e) => !(e.type === "drive" && e.autoDrive && !e.manualEdit)
    );
    save();
}

/* ---------- Rendering ---------- */
function render() {
    calendar.className = viewMode;
    calendar.innerHTML = "";

    sortByDateInPlace(events);

    let lastDay = "";
    events.forEach((e) => {
        const day = e.start ? new Date(e.start).toDateString() : "";

        if (viewMode === "timeline" && day && day !== lastDay) {
            const divider = document.createElement("div");
            divider.className = "day-divider";
            divider.textContent = day;
            calendar.appendChild(divider);
            lastDay = day;
        }

        const card = document.createElement("div");
        card.className = `event ${e.type || "stop"}`;
        card.dataset.id = e.id;
        card.setAttribute("autodrive", e.autoDrive || false);
        card.setAttribute("manualedit", e.manualEdit || false);

        const dateLine =
            e.start || e.end ?
            `${fmtDate(e.start)}${e.end ? " → " + fmtDate(e.end) : ""}` :
            "No date set";

        card.innerHTML = `
      <div class="insolation-band"></div>
      <div class="weather-band"></div>
      <div class="details">
        <strong>${e.name || "(untitled)"}</strong><br>
        <small>${e.type || "stop"}</small>
        <div class="meta">${dateLine}</div>
      </div>
      <div class="tools">
        <button class="context-btn">⋮</button>
      </div>
    `;

        // ----- Context menu -----
        const menu = document.createElement("div");
        menu.className = "card-menu";
        menu.innerHTML = `
      <button class="edit-opt">Edit</button>
      <button class="dup-opt">Duplicate</button>
      <button class="del-opt">Delete</button>
    `;
        card.appendChild(menu);

        // open menu toggle
        const btn = card.querySelector(".context-btn");
        btn.onclick = (ev) => {
            ev.stopPropagation();
            menu.style.display = menu.style.display === "flex" ? "none" : "flex";
        };

        // Edit
        menu.querySelector(".edit-opt").onclick = (ev) => {
            ev.stopPropagation();
            menu.style.display = "none";
            openEdit(e);
        };
        // Duplicate
        menu.querySelector(".dup-opt").onclick = (ev) => {
            ev.stopPropagation();
            menu.style.display = "none";
            const copy = {...e, id: Date.now() };
            events.push(copy);
            save();
        };
        // Delete
        menu.querySelector(".del-opt").onclick = (ev) => {
            ev.stopPropagation();
            menu.style.display = "none";
            events = events.filter((x) => x.id !== e.id);
            save();
        };

        // Dragging
        card.draggable = viewMode === "timeline";
        card.addEventListener("dragstart", (ev) => {
            card.classList.add("dragging");
            ev.dataTransfer.effectAllowed = "move";
            ev.dataTransfer.setData("text/plain", e.id);
        });
        card.addEventListener("dragend", () => {
            card.classList.remove("dragging");
            reorderFromDOM();
        });

        calendar.appendChild(card);
    });
}

/* ---------- Drag reorder ---------- */
calendar.addEventListener("dragover", (e) => {
    if (viewMode !== "timeline") return;
    e.preventDefault();
    const dragging = document.querySelector(".event.dragging");
    if (!dragging) return;
    const after = getDragAfterElement(calendar, e.clientY);
    if (after == null) calendar.appendChild(dragging);
    else calendar.insertBefore(dragging, after);
});

function getDragAfterElement(container, y) {
    const els = [...container.querySelectorAll(".event:not(.dragging)")];
    return els.reduce(
        (closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            return offset < 0 && offset > closest.offset ? { offset, element: child } :
                closest;
        }, { offset: Number.NEGATIVE_INFINITY, element: null }
    ).element;
}

function reorderFromDOM() {
    const order = [...calendar.querySelectorAll(".event")].map(
        (el) => el.dataset.id
    );
    events.sort((a, b) => order.indexOf(String(a.id)) - order.indexOf(String(b.id)));
    save();
}

/* ---------- Toolbar Buttons ---------- */
document.getElementById("mode-timeline").onclick = () => {
    viewMode = "timeline";
    render();
};
document.getElementById("mode-week").onclick = () => {
    viewMode = "week";
    render();
};
document.getElementById("add-event").onclick = () => {
    currentEdit = null;
    form.reset();
    modal.showModal();
};
document.getElementById("sort-date").onclick = sortByDate;
document.getElementById("insert-drives").onclick = insertDriveSegments;
document.getElementById("clear-auto").onclick = clearAutoDrives;

/* ---------- Modal Editing ---------- */
function openEdit(e) {
    currentEdit = e;
    form.name.value = e.name || "";
    form.type.value = e.type || "stop";
    form.start.value = e.start || "";
    form.end.value = e.end || "";
    form.duration.value = e.duration || "";
    modal.showModal();
}

form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());

    // Compute end if duration given
    let end = data.end;
    if (data.duration && data.start) {
        const start = new Date(data.start);
        const endLocal = new Date(start.getTime() + parseFloat(data.duration) * 3600000);
        end = endLocal.toISOString().slice(0, 16); // ensures correct hour rollover
    }

    const normalized = {
        name: data.name || "",
        type: data.type || "stop",
        start: data.start || "",
        end: end || "",
        duration: data.duration || "",
    };

    // Mark drives that are manually changed
    if (currentEdit && currentEdit.type === "drive" && currentEdit.autoDrive) {
        currentEdit.manualEdit = true;
        currentEdit.autoDrive = false;
    }

    if (currentEdit) Object.assign(currentEdit, normalized);
    else events.push({ id: Date.now(), ...normalized });
    save();
    modal.close();
});

render();