function newId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now() + Math.random().toString(36).slice(2);
}
