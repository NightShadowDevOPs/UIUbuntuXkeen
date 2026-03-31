import { useStorage } from '@vueuse/core';
const MAX_JOBS = 60;
export const jobHistory = useStorage('runtime/job-history-v1', []);
export const startJob = (title, meta) => {
    const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const job = { id, title, startedAt: Date.now(), meta };
    jobHistory.value = [job, ...(jobHistory.value || [])].slice(0, MAX_JOBS);
    return id;
};
export const finishJob = (id, patch) => {
    const list = jobHistory.value || [];
    const idx = list.findIndex((j) => j.id === id);
    if (idx < 0)
        return;
    const cur = list[idx];
    const next = {
        ...cur,
        endedAt: Date.now(),
        ok: patch.ok,
        error: patch.error,
        meta: { ...(cur.meta || {}), ...(patch.meta || {}) },
    };
    const out = [...list];
    out[idx] = next;
    jobHistory.value = out;
};
export const clearJobs = () => {
    jobHistory.value = [];
};
