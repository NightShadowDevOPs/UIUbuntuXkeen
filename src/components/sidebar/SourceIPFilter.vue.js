/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { getIPLabelFromMap } from '@/helper/sourceip';
import { connections, sourceIPFilter } from '@/store/connections';
import * as ipaddr from 'ipaddr.js';
import { isEqual, uniq } from 'lodash';
import { computed, ref, watch } from 'vue';
const sourceIPs = computed(() => {
    return uniq(connections.value.map((conn) => conn.metadata.sourceIP)).sort((a, b) => {
        if (!ipaddr.isValid(a))
            return -1;
        if (!ipaddr.isValid(b))
            return 1;
        const preIP = ipaddr.parse(a);
        const nextIP = ipaddr.parse(b);
        const isPreIPv4 = preIP.kind() === 'ipv4';
        const isNextIPv4 = nextIP.kind() === 'ipv4';
        if (!isPreIPv4 && isNextIPv4)
            return 1;
        if (!isNextIPv4 && isPreIPv4)
            return -1;
        const preIPBytes = preIP.toByteArray();
        const nextIPBytes = nextIP.toByteArray();
        for (let i = 0; i < preIPBytes.length; i++) {
            if (preIPBytes[i] !== nextIPBytes[i]) {
                return preIPBytes[i] - nextIPBytes[i];
            }
        }
        return 0;
    });
});
const sourceIPOpts = ref([]);
// do not use computed here for firefox
watch(sourceIPs, (value, oldValue) => {
    if (isEqual(value, oldValue))
        return;
    sourceIPOpts.value = [];
    sourceIPs.value.forEach((ip) => {
        const label = getIPLabelFromMap(ip);
        const index = sourceIPOpts.value.findIndex((opt) => opt.label === label);
        if (index === -1) {
            sourceIPOpts.value.push({
                label,
                value: [ip],
            });
        }
        else {
            sourceIPOpts.value[index].value.push(ip);
        }
    });
    if (sourceIPFilter.value !== null) {
        const currentLabel = getIPLabelFromMap(sourceIPFilter.value[0]);
        const current = sourceIPOpts.value.find((opt) => opt.label === currentLabel);
        if (!current) {
            sourceIPOpts.value.unshift({
                label: currentLabel,
                value: sourceIPFilter.value,
            });
        }
        else if (!isEqual(current.value, sourceIPFilter.value)) {
            sourceIPFilter.value = current.value;
        }
    }
}, {
    immediate: true,
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ class: "join-item select select-sm" },
    value: (__VLS_ctx.sourceIPFilter),
});
/** @type {__VLS_StyleScopedClasses['join-item']} */ ;
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: (null),
});
(__VLS_ctx.$t('allSourceIP'));
for (const [opt] of __VLS_vFor((__VLS_ctx.sourceIPOpts))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (opt.value.join(',')),
        value: (opt.value),
    });
    (opt.label);
    // @ts-ignore
    [sourceIPFilter, $t, sourceIPOpts,];
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
