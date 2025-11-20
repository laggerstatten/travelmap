function segLabel(seg, segments) {
  if (!seg) return '(unknown)';
  if (seg.name) return seg.name;
  if (seg.type === 'drive') {
    const origin = segments.find((s) => s.id === seg.originId);
    const dest = segments.find((s) => s.id === seg.destinationId);
    return `Drive: ${origin?.name || '?'} → ${dest?.name || '?'}`;
  }
  return seg.id;
}
