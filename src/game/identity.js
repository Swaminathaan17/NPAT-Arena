export function viewerIdFromState(state) {
  const self = state && Array.isArray(state.players) ? state.players.find((p) => p.isYou) : null;
  return self && self.id ? self.id : null;
}