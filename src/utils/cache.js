// Tiny sessionStorage cache helpers for stale-while-revalidate reads.
// sessionStorage (not local) on purpose: survives a refresh, clears when the tab
// closes — so cached availability never lingers stale across sessions.

export function readCache(key) {
  try { return JSON.parse(sessionStorage.getItem(key) || 'null') } catch { return null }
}

export function writeCache(key, value) {
  try { sessionStorage.setItem(key, JSON.stringify(value)) } catch { /* quota / unavailable */ }
}

export function clearCache(key) {
  try { sessionStorage.removeItem(key) } catch { /* unavailable */ }
}
