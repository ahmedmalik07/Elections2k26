// Keep complete signed submissions, not just the display score, across reloads.
export const PENDING_SCORES_KEY = "campus-dash-pending-v1";
export function enqueueScore(queue, body) {
  return [...queue.filter((item) => item.token !== body.token), body];
}
export function acknowledgeScore(queue, token) {
  return queue.filter((item) => item.token !== token);
}
export function nextPendingScore(queue) {
  return (
    [...queue].sort((a, b) => Number(b.score) - Number(a.score))[0] || null
  );
}
