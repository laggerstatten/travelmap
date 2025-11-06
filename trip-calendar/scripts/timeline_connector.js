/* ===============================
   Timeline Rendering & Interaction
   =============================== */


// --- Build a card ---
function renderConnector(type, minutes) {
  const card = document.createElement('div');
  card.className = `segment timeline-card ${type}`;

  // --- Title logic ---
  let title = `${Math.abs(minutes)} min ${type}`;

    card.innerHTML = `
    <div class="title">${title}</div>
    <div class="subtitle">
      ${type}

    </div>`;


  return card;
}
