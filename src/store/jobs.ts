import { useStorage } from '@vueuse/core'

export type JobItem = {
  id: string
  title: string
  startedAt: number
  endedAt?: number
  ok?: boolean
  error?: string
  meta?: Record<string, any>
}

const MAX_JOBS = 60

export const jobHistory = useStorage<JobItem[]>('runtime/job-history-v1', [])

export const startJob = (title: string, meta?: Record<string, any>) => {
  const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`
  const job: JobItem = { id, title, startedAt: Date.now(), meta }
  jobHistory.value = [job, ...(jobHistory.value || [])].slice(0, MAX_JOBS)
  return id
}

export const finishJob = (id: string, patch: { ok: boolean; error?: string; meta?: Record<string, any> }) => {
  const list = jobHistory.value || []
  const idx = list.findIndex((j) => j.id === id)
  if (idx < 0) return
  const cur = list[idx]
  const next: JobItem = {
    ...cur,
    endedAt: Date.now(),
    ok: patch.ok,
    error: patch.error,
    meta: { ...(cur.meta || {}), ...(patch.meta || {}) },
  }
  const out = [...list]
  out[idx] = next
  jobHistory.value = out
}

export const clearJobs = () => {
  jobHistory.value = []
}
