function editSegment(seg, card) {
    if (card.classList.contains('editing')) return;
    card.classList.add('editing');
    const editor = buildOnCardEditor(seg, card);
}