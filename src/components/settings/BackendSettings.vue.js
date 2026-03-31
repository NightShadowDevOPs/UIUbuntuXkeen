/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { flushDNSCacheAPI, flushFakeIPAPI, flushSmartGroupWeightsAPI, isCoreUpdateAvailable, isSingBox, reloadConfigsAPI, restartCoreAPI, updateGeoDataAPI, } from '@/api';
import BackendVersion from '@/components/common/BackendVersion.vue';
import BackendSwitch from '@/components/settings/BackendSwitch.vue';
import DnsQuery from '@/components/settings/DnsQuery.vue';
import { showNotification } from '@/helper/notification';
import { configs, fetchConfigs, updateConfigs } from '@/store/config';
import { fetchProxies, hasSmartGroup } from '@/store/proxies';
import { fetchRules } from '@/store/rules';
import { autoUpgradeCore, checkUpgradeCore, displayAllFeatures } from '@/store/settings';
import { activeBackend } from '@/store/setup';
import { ref } from 'vue';
import UpgradeCoreModal from './UpgradeCoreModal.vue';
const portList = [
    {
        label: 'mixedPort',
        key: 'mixed-port',
    },
    {
        label: 'httpPort',
        key: 'port',
    },
    {
        label: 'socksPort',
        key: 'socks-port',
    },
    {
        label: 'redirPort',
        key: 'redir-port',
    },
    {
        label: 'tproxyPort',
        key: 'tproxy-port',
    },
];
const reloadAll = () => {
    fetchConfigs();
    fetchRules();
    fetchProxies();
};
const showUpgradeCoreModal = ref(false);
const isCoreRestarting = ref(false);
const handlerClickRestartCore = async () => {
    if (isCoreRestarting.value)
        return;
    isCoreRestarting.value = true;
    try {
        await restartCoreAPI();
        setTimeout(() => {
            reloadAll();
        }, 500);
        isCoreRestarting.value = false;
        showNotification({
            content: 'restartCoreSuccess',
            type: 'alert-success',
        });
    }
    catch {
        isCoreRestarting.value = false;
    }
};
const isConfigReloading = ref(false);
const handlerClickReloadConfigs = async () => {
    if (isConfigReloading.value)
        return;
    isConfigReloading.value = true;
    try {
        await reloadConfigsAPI();
        reloadAll();
        isConfigReloading.value = false;
        showNotification({
            content: 'reloadConfigsSuccess',
            type: 'alert-success',
        });
    }
    catch {
        isConfigReloading.value = false;
    }
};
const isGeoUpdating = ref(false);
const handlerClickUpdateGeo = async () => {
    if (isGeoUpdating.value)
        return;
    isGeoUpdating.value = true;
    try {
        await updateGeoDataAPI();
        reloadAll();
        isGeoUpdating.value = false;
        showNotification({
            content: 'updateGeoSuccess',
            type: 'alert-success',
        });
    }
    catch {
        isGeoUpdating.value = false;
    }
};
const handlerCheckUpgradeCoreChange = () => {
    if (!checkUpgradeCore.value) {
        autoUpgradeCore.value = false;
        isCoreUpdateAvailable.value = false;
    }
};
const hanlderTunModeChange = async () => {
    await updateConfigs({ tun: { enable: configs.value?.tun.enable } });
};
const handlerAllowLanChange = async () => {
    await updateConfigs({ ['allow-lan']: configs.value?.['allow-lan'] });
};
const handleFlushDNSCache = async () => {
    await flushDNSCacheAPI();
    showNotification({
        content: 'flushDNSCacheSuccess',
        type: 'alert-success',
    });
};
const handleFlushFakeIP = async () => {
    await flushFakeIPAPI();
    showNotification({
        content: 'flushFakeIPSuccess',
        type: 'alert-success',
    });
};
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card" },
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card-title px-4 pt-4" },
});
/** @type {__VLS_StyleScopedClasses['card-title']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "indicator" },
});
/** @type {__VLS_StyleScopedClasses['indicator']} */ ;
if (__VLS_ctx.isCoreUpdateAvailable) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "indicator-item top-1 -right-1 flex" },
    });
    /** @type {__VLS_StyleScopedClasses['indicator-item']} */ ;
    /** @type {__VLS_StyleScopedClasses['top-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['-right-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "bg-secondary absolute h-2 w-2 animate-ping rounded-full" },
    });
    /** @type {__VLS_StyleScopedClasses['bg-secondary']} */ ;
    /** @type {__VLS_StyleScopedClasses['absolute']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['animate-ping']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "bg-secondary h-2 w-2 rounded-full" },
    });
    /** @type {__VLS_StyleScopedClasses['bg-secondary']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
    ...{ class: "flex cursor-pointer items-center gap-2" },
    href: (__VLS_ctx.isSingBox
        ? 'https://github.com/sagernet/sing-box'
        : 'https://github.com/metacubex/mihomo'),
    target: "_blank",
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
(__VLS_ctx.$t('backend'));
const __VLS_0 = BackendVersion;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    ...{ class: "text-sm font-normal" },
}));
const __VLS_2 = __VLS_1({
    ...{ class: "text-sm font-normal" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-normal']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card-body gap-4" },
});
/** @type {__VLS_StyleScopedClasses['card-body']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
const __VLS_5 = BackendSwitch;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({}));
const __VLS_7 = __VLS_6({}, ...__VLS_functionalComponentArgsRest(__VLS_6));
if (!__VLS_ctx.isSingBox && __VLS_ctx.configs) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "divider" },
    });
    /** @type {__VLS_StyleScopedClasses['divider']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid max-w-3xl grid-cols-2 gap-2 lg:grid-cols-3" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['max-w-3xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['grid-cols-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['lg:grid-cols-3']} */ ;
    for (const [portConfig] of __VLS_vFor((__VLS_ctx.portList))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex items-center gap-2" },
            key: (portConfig.key),
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "shrink-0" },
        });
        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
        (__VLS_ctx.$t(portConfig.label));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            ...{ onChange: (...[$event]) => {
                    if (!(!__VLS_ctx.isSingBox && __VLS_ctx.configs))
                        return;
                    __VLS_ctx.updateConfigs({ [portConfig.key]: Number(__VLS_ctx.configs[portConfig.key]) });
                    // @ts-ignore
                    [isCoreUpdateAvailable, isSingBox, isSingBox, $t, $t, configs, configs, portList, updateConfigs,];
                } },
            ...{ class: "input input-sm w-20 sm:w-24" },
            type: "number",
        });
        (__VLS_ctx.configs[portConfig.key]);
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-20']} */ ;
        /** @type {__VLS_StyleScopedClasses['sm:w-24']} */ ;
        // @ts-ignore
        [configs,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid max-w-3xl grid-cols-2 gap-2 lg:grid-cols-4" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['max-w-3xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['grid-cols-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['lg:grid-cols-4']} */ ;
    if (__VLS_ctx.configs?.tun) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex items-center gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        (__VLS_ctx.$t('tunMode'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            ...{ onChange: (__VLS_ctx.hanlderTunModeChange) },
            ...{ class: "toggle" },
            type: "checkbox",
        });
        (__VLS_ctx.configs.tun.enable);
        /** @type {__VLS_StyleScopedClasses['toggle']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    (__VLS_ctx.$t('allowLan'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onChange: (__VLS_ctx.handlerAllowLanChange) },
        ...{ class: "toggle" },
        type: "checkbox",
    });
    (__VLS_ctx.configs['allow-lan']);
    /** @type {__VLS_StyleScopedClasses['toggle']} */ ;
    if (!__VLS_ctx.activeBackend?.disableUpgradeCore) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex items-center gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        (__VLS_ctx.$t('checkUpgrade'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            ...{ onChange: (__VLS_ctx.handlerCheckUpgradeCoreChange) },
            ...{ class: "toggle" },
            type: "checkbox",
        });
        (__VLS_ctx.checkUpgradeCore);
        /** @type {__VLS_StyleScopedClasses['toggle']} */ ;
        if (__VLS_ctx.checkUpgradeCore) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex items-center gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            (__VLS_ctx.$t('autoUpgrade'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                ...{ class: "toggle" },
                type: "checkbox",
            });
            (__VLS_ctx.autoUpgradeCore);
            /** @type {__VLS_StyleScopedClasses['toggle']} */ ;
        }
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid max-w-3xl grid-cols-2 gap-2" },
    ...{ class: (__VLS_ctx.hasSmartGroup
            ? 'md:grid-cols-4 xl:max-w-6xl xl:grid-cols-7'
            : 'md:grid-cols-3 xl:max-w-6xl xl:grid-cols-6') },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
if (!__VLS_ctx.isSingBox || __VLS_ctx.displayAllFeatures) {
    if (!__VLS_ctx.activeBackend?.disableUpgradeCore) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(!__VLS_ctx.isSingBox || __VLS_ctx.displayAllFeatures))
                        return;
                    if (!(!__VLS_ctx.activeBackend?.disableUpgradeCore))
                        return;
                    __VLS_ctx.showUpgradeCoreModal = true;
                    // @ts-ignore
                    [isSingBox, $t, $t, $t, $t, configs, configs, configs, hanlderTunModeChange, handlerAllowLanChange, activeBackend, activeBackend, handlerCheckUpgradeCoreChange, checkUpgradeCore, checkUpgradeCore, autoUpgradeCore, hasSmartGroup, displayAllFeatures, showUpgradeCoreModal,];
                } },
            ...{ class: "btn btn-primary btn-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
        (__VLS_ctx.$t('upgradeCore'));
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.handlerClickRestartCore) },
        ...{ class: "btn btn-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
    if (__VLS_ctx.isCoreRestarting) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "loading loading-spinner loading-md" },
        });
        /** @type {__VLS_StyleScopedClasses['loading']} */ ;
        /** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
        /** @type {__VLS_StyleScopedClasses['loading-md']} */ ;
    }
    (__VLS_ctx.$t('restartCore'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.handlerClickReloadConfigs) },
        ...{ class: "btn btn-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
    if (__VLS_ctx.isConfigReloading) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "loading loading-spinner loading-md" },
        });
        /** @type {__VLS_StyleScopedClasses['loading']} */ ;
        /** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
        /** @type {__VLS_StyleScopedClasses['loading-md']} */ ;
    }
    (__VLS_ctx.$t('reloadConfigs'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.handlerClickUpdateGeo) },
        ...{ class: "btn btn-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
    if (__VLS_ctx.isGeoUpdating) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "loading loading-spinner loading-md" },
        });
        /** @type {__VLS_StyleScopedClasses['loading']} */ ;
        /** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
        /** @type {__VLS_StyleScopedClasses['loading-md']} */ ;
    }
    (__VLS_ctx.$t('updateGeoDatabase'));
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.handleFlushDNSCache) },
    ...{ class: "btn btn-sm" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
(__VLS_ctx.$t('flushDNSCache'));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.handleFlushFakeIP) },
    ...{ class: "btn btn-sm" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
(__VLS_ctx.$t('flushFakeIP'));
if (__VLS_ctx.hasSmartGroup) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.flushSmartGroupWeightsAPI) },
        ...{ class: "btn btn-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
    (__VLS_ctx.$t('flushSmartWeights'));
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "divider" },
});
/** @type {__VLS_StyleScopedClasses['divider']} */ ;
const __VLS_10 = DnsQuery;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({}));
const __VLS_12 = __VLS_11({}, ...__VLS_functionalComponentArgsRest(__VLS_11));
const __VLS_15 = UpgradeCoreModal;
// @ts-ignore
const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({
    modelValue: (__VLS_ctx.showUpgradeCoreModal),
}));
const __VLS_17 = __VLS_16({
    modelValue: (__VLS_ctx.showUpgradeCoreModal),
}, ...__VLS_functionalComponentArgsRest(__VLS_16));
// @ts-ignore
[$t, $t, $t, $t, $t, $t, $t, hasSmartGroup, showUpgradeCoreModal, handlerClickRestartCore, isCoreRestarting, handlerClickReloadConfigs, isConfigReloading, handlerClickUpdateGeo, isGeoUpdating, handleFlushDNSCache, handleFlushFakeIP, flushSmartGroupWeightsAPI,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
