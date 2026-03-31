/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { getIPInfo } from '@/api/geoip';
import DialogWrapper from '@/components/common/DialogWrapper.vue';
import { useConnections } from '@/composables/connections';
import { proxyMap } from '@/store/proxies';
import { ArrowRightCircleIcon, MapPinIcon, ServerIcon } from '@heroicons/vue/24/outline';
import * as ipaddr from 'ipaddr.js';
import { computed, ref, watch } from 'vue';
import VueJsonPretty from 'vue-json-pretty';
import 'vue-json-pretty/lib/styles.css';
import ProxyIcon from '../proxies/ProxyIcon.vue';
const { infoConn, connectionDetailModalShow } = useConnections();
const details = ref(null);
const destinationIP = computed(() => infoConn.value?.metadata.destinationIP);
const isPrivateIP = computed(() => {
    if (!destinationIP.value || !ipaddr.isValid(destinationIP.value)) {
        return false;
    }
    const addr = ipaddr.parse(destinationIP.value);
    const range = addr.range();
    return ['private', 'uniqueLocal', 'loopback', 'linkLocal'].includes(range);
});
watch(() => destinationIP.value, (newIP) => {
    if (!newIP) {
        return;
    }
    if (isPrivateIP.value) {
        details.value = null;
        return;
    }
    if (details.value?.ip === newIP) {
        return;
    }
    details.value = null;
    getIPInfo(infoConn.value?.metadata.destinationIP).then((res) => {
        details.value = res;
    });
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
const __VLS_0 = DialogWrapper || DialogWrapper;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    modelValue: (__VLS_ctx.connectionDetailModalShow),
    noPadding: (true),
}));
const __VLS_2 = __VLS_1({
    modelValue: (__VLS_ctx.connectionDetailModalShow),
    noPadding: (true),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
var __VLS_5 = {};
const { default: __VLS_6 } = __VLS_3.slots;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex h-full max-h-[69dvh] flex-col overflow-hidden py-4 md:max-h-[89dvh]" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['max-h-[69dvh]']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['py-4']} */ ;
/** @type {__VLS_StyleScopedClasses['md:max-h-[89dvh]']} */ ;
let __VLS_7;
/** @ts-ignore @type {typeof __VLS_components.VueJsonPretty | typeof __VLS_components.VueJsonPretty} */
VueJsonPretty;
// @ts-ignore
const __VLS_8 = __VLS_asFunctionalComponent1(__VLS_7, new __VLS_7({
    data: (__VLS_ctx.infoConn),
    ...{ class: "overflow-y-auto px-4" },
}));
const __VLS_9 = __VLS_8({
    data: (__VLS_ctx.infoConn),
    ...{ class: "overflow-y-auto px-4" },
}, ...__VLS_functionalComponentArgsRest(__VLS_8));
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
const { default: __VLS_12 } = __VLS_10.slots;
{
    const { renderNodeValue: __VLS_13 } = __VLS_10.slots;
    const [{ node, defaultValue }] = __VLS_vSlot(__VLS_13);
    if (node.path.startsWith('root.chains') && __VLS_ctx.proxyMap[node.content]?.icon) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        const __VLS_14 = ProxyIcon;
        // @ts-ignore
        const __VLS_15 = __VLS_asFunctionalComponent1(__VLS_14, new __VLS_14({
            icon: (__VLS_ctx.proxyMap[node.content].icon),
            ...{ class: "inline-block" },
            margin: (0),
        }));
        const __VLS_16 = __VLS_15({
            icon: (__VLS_ctx.proxyMap[node.content].icon),
            ...{ class: "inline-block" },
            margin: (0),
        }, ...__VLS_functionalComponentArgsRest(__VLS_15));
        /** @type {__VLS_StyleScopedClasses['inline-block']} */ ;
        (node.content);
    }
    else {
        (defaultValue);
    }
    // @ts-ignore
    [connectionDetailModalShow, infoConn, proxyMap, proxyMap,];
}
// @ts-ignore
[];
var __VLS_10;
if (__VLS_ctx.destinationIP && !__VLS_ctx.isPrivateIP) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "min-h-12 shrink-0 px-4 pt-2 text-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['min-h-12']} */ ;
    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['pt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    if (__VLS_ctx.details) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-wrap items-center gap-1" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
        let __VLS_19;
        /** @ts-ignore @type {typeof __VLS_components.ArrowRightCircleIcon} */
        ArrowRightCircleIcon;
        // @ts-ignore
        const __VLS_20 = __VLS_asFunctionalComponent1(__VLS_19, new __VLS_19({
            ...{ class: "h-4 w-4 shrink-0" },
        }));
        const __VLS_21 = __VLS_20({
            ...{ class: "h-4 w-4 shrink-0" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_20));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        (__VLS_ctx.details?.ip);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        (__VLS_ctx.details?.asn);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-wrap" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        if (__VLS_ctx.details?.country) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mr-3 flex items-center gap-1" },
            });
            /** @type {__VLS_StyleScopedClasses['mr-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
            let __VLS_24;
            /** @ts-ignore @type {typeof __VLS_components.MapPinIcon} */
            MapPinIcon;
            // @ts-ignore
            const __VLS_25 = __VLS_asFunctionalComponent1(__VLS_24, new __VLS_24({
                ...{ class: "h-4 w-4 shrink-0" },
            }));
            const __VLS_26 = __VLS_25({
                ...{ class: "h-4 w-4 shrink-0" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_25));
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
            if (__VLS_ctx.details?.city && __VLS_ctx.details?.city !== __VLS_ctx.details?.country) {
                (__VLS_ctx.details?.city);
            }
            else if (__VLS_ctx.details?.region && __VLS_ctx.details?.region !== __VLS_ctx.details?.country) {
                (__VLS_ctx.details?.region);
            }
            (__VLS_ctx.details?.country);
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex items-center gap-1" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
        let __VLS_29;
        /** @ts-ignore @type {typeof __VLS_components.ServerIcon} */
        ServerIcon;
        // @ts-ignore
        const __VLS_30 = __VLS_asFunctionalComponent1(__VLS_29, new __VLS_29({
            ...{ class: "h-4 w-4 shrink-0" },
        }));
        const __VLS_31 = __VLS_30({
            ...{ class: "h-4 w-4 shrink-0" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_30));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
        (__VLS_ctx.details?.organization);
    }
}
// @ts-ignore
[destinationIP, isPrivateIP, details, details, details, details, details, details, details, details, details, details, details, details, details, details,];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
