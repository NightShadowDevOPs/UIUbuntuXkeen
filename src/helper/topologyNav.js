import { ROUTE_NAME } from '@/constant';
export const TOPOLOGY_NAV_FILTER_KEY = 'runtime/topology-pending-filter-v1';
export const setPendingTopologyNavFilter = (payload) => {
    try {
        localStorage.setItem(TOPOLOGY_NAV_FILTER_KEY, JSON.stringify(payload));
        return true;
    }
    catch {
        return false;
    }
};
export const clearPendingTopologyNavFilter = () => {
    try {
        localStorage.removeItem(TOPOLOGY_NAV_FILTER_KEY);
    }
    catch {
        // ignore
    }
};
export const navigateToTopology = async (router, focus, mode = 'none', opts) => {
    const value = String(focus?.value || '').trim();
    if (!value)
        return;
    const payload = {
        ts: Date.now(),
        mode,
        focus: { stage: focus.stage, kind: 'value', value },
        fallbackProxyName: opts?.fallbackProxyName || '',
    };
    setPendingTopologyNavFilter(payload);
    await router.push({ name: ROUTE_NAME.overview });
};
