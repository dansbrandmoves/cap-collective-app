import { supabase } from './supabase'

// Structured diagnostics / execution log.
//
// Every meaningful action emits ONE execution record so the admin Diagnostics
// view can show n8n-style detail: who did what, each step, and where it stopped.
//
// The table schema stays { event, detail jsonb } — guests (anon) can insert, so
// we never need elevated auth to log. All structure lives inside `detail`:
//   { actor, status, projectId, roomId, summary, steps:[{label,status,...}], error, durationMs, ...extra }
//
// Logging must NEVER throw into a real flow — every call is best-effort.

export const STATUS = { OK: 'ok', SKIP: 'skip', ERROR: 'error', INFO: 'info' }

export function logEvent(flow, {
  actor = 'system',
  status = STATUS.INFO,
  projectId = null,
  roomId = null,
  summary = '',
  steps = [],
  error = null,
  ...extra
} = {}) {
  const detail = {
    actor,
    status,
    projectId,
    roomId,
    summary,
    steps,
    error: error ? String(error?.message || error) : null,
    ...extra,
  }
  try {
    // Fire-and-forget; swallow all errors so diagnostics can't break a flow.
    return supabase.from('diagnostics').insert({ event: flow, detail }).then(() => {}, () => {})
  } catch {
    return Promise.resolve()
  }
}

// A tiny execution recorder: collect steps, then flush one record.
//   const run = startRun('guest_connect_calendar', { actor, projectId, roomId })
//   run.step('fetched events', STATUS.OK, { count })
//   run.finish(STATUS.OK, 'wrote 42 free days')
export function startRun(flow, base = {}) {
  const startedAt = Date.now()
  const steps = []
  return {
    step(label, status = STATUS.OK, data = {}) {
      steps.push({ label, status, ...data })
      return this
    },
    finish(status = STATUS.OK, summary = '', extra = {}) {
      return logEvent(flow, {
        ...base,
        status,
        summary,
        steps,
        durationMs: Date.now() - startedAt,
        ...extra,
      })
    },
  }
}
