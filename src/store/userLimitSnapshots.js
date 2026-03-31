import { useStorage } from '@vueuse/core';
export const userLimitSnapshots = useStorage('config/user-limits-snapshots-v1', []);
export const pushSnapshot = (snap, maxKeep = 10) => {
    const list = [...(userLimitSnapshots.value || []), snap];
    // keep newest N
    const next = list.sort((a, b) => a.createdAt - b.createdAt).slice(-maxKeep);
    userLimitSnapshots.value = next;
};
