import { useStorage } from '@vueuse/core';
export const routerHostQosDraftProfiles = useStorage('config/router-host-qos-drafts-v2', {});
export const routerHostQosAppliedProfiles = useStorage('config/router-host-qos-applied-v1', {});
export const routerHostQosExpanded = useStorage('config/router-host-qos-expanded-v1', false);
export const mergeRouterHostQosAppliedProfiles = (next) => {
    if (!next || !Object.keys(next).length)
        return;
    routerHostQosAppliedProfiles.value = {
        ...routerHostQosAppliedProfiles.value,
        ...next,
    };
};
export const setRouterHostQosAppliedProfile = (ip, profile) => {
    if (!ip)
        return;
    const next = { ...routerHostQosAppliedProfiles.value };
    if (profile)
        next[ip] = profile;
    else
        delete next[ip];
    routerHostQosAppliedProfiles.value = next;
};
