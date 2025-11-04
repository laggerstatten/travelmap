function hasCoords(e) {
    return e && typeof e.lat === "number" && typeof e.lon === "number";
}



function addMinutes(baseIso, mins) {
    // assume baseIso in "YYYY-MM-DDTHH:mm" local form
    const [datePart, timePart] = baseIso.split("T");
    const [year, month, day] = datePart.split("-").map(Number);
    const [hour, minute] = timePart.split(":").map(Number);

    const d = new Date(year, month - 1, day, hour, minute); // local Date
    d.setMinutes(d.getMinutes() + mins);

    // re-emit as local YYYY-MM-DDTHH:mm (no timezone conversion)
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}