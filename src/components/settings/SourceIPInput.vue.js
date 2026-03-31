/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { checkTruncation, useTooltip } from '@/helper/tooltip';
import { getLabelFromBackend } from '@/helper/utils';
import { connections } from '@/store/connections';
import { sourceIPLabelList } from '@/store/settings';
import { backendList } from '@/store/setup';
import { ArrowRightCircleIcon, LockClosedIcon, LockOpenIcon } from '@heroicons/vue/24/outline';
import { uniq } from 'lodash';
import { computed } from 'vue';
import TextInput from '../common/TextInput.vue';
const sourceIPLabel = defineModel({
    default: {
        key: '',
        label: '',
    },
});
const sourceList = computed(() => {
    return uniq(connections.value.map((conn) => conn.metadata.sourceIP))
        .filter(Boolean)
        .filter((ip) => !sourceIPLabelList.value.find((item) => item.key === ip))
        .sort();
});
const getScopeValueFromSouceIPByBackendID = (backendID, sourceIP) => {
    return sourceIP.scope?.some((item) => item === backendID) ?? false;
};
const setScopeValueFromSouceIPByBackendID = (backendID, sourceIP, value) => {
    if (value) {
        if (!sourceIP.scope) {
            sourceIP.scope = [];
        }
        sourceIP.scope?.push(backendID);
    }
    else {
        sourceIP.scope = sourceIP.scope?.filter((item) => item !== backendID);
        if (!sourceIP.scope?.length) {
            delete sourceIP.scope;
        }
    }
};
const isLocked = computed(() => {
    return (sourceIPLabel.value.scope?.length && sourceIPLabel.value.scope.length < backendList.value.length);
});
const { showTip } = useTooltip();
const bindBackendMenu = (e) => {
    const backendListContent = document.createElement('div');
    backendListContent.classList.add('flex', 'flex-col', 'gap-2', 'py-1');
    for (const backend of backendList.value) {
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        const span = document.createElement('span');
        label.classList.add('flex', 'items-center', 'gap-2', 'cursor-pointer');
        checkbox.type = 'checkbox';
        checkbox.classList.add('checkbox', 'checkbox-sm');
        checkbox.checked = getScopeValueFromSouceIPByBackendID(backend.uuid, sourceIPLabel.value);
        checkbox.addEventListener('change', (e) => {
            const target = e.target;
            setScopeValueFromSouceIPByBackendID(backend.uuid, sourceIPLabel.value, target.checked);
        });
        span.textContent = getLabelFromBackend(backend);
        label.append(checkbox, span);
        backendListContent.append(label);
    }
    showTip(e, backendListContent, {
        theme: 'base',
        placement: 'bottom-start',
        trigger: 'click',
        appendTo: document.body,
        interactive: true,
        arrow: false,
    });
};
const __VLS_defaultModels = {
    'modelValue': {
        key: '',
        label: '',
    },
};
let __VLS_modelEmit;
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "relative flex w-full items-center gap-2" },
    ...{ class: (__VLS_ctx.sourceIPLabel.scope?.length ? 'pt-4' : '') },
});
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
var __VLS_0 = {};
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ onMouseenter: (__VLS_ctx.checkTruncation) },
    ...{ class: "absolute top-0 left-6 truncate text-xs" },
});
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['top-0']} */ ;
/** @type {__VLS_StyleScopedClasses['left-6']} */ ;
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
(__VLS_ctx.backendList
    .filter((b) => __VLS_ctx.sourceIPLabel.scope?.includes(b.uuid))
    .map(__VLS_ctx.getLabelFromBackend)
    .join(', '));
const __VLS_2 = TextInput;
// @ts-ignore
const __VLS_3 = __VLS_asFunctionalComponent1(__VLS_2, new __VLS_2({
    ...{ class: "w-12 max-w-64 flex-1 sm:w-36" },
    menus: (__VLS_ctx.sourceList),
    modelValue: (__VLS_ctx.sourceIPLabel.key),
    placeholder: "IP | CIDR | eui64 | /Regex",
}));
const __VLS_4 = __VLS_3({
    ...{ class: "w-12 max-w-64 flex-1 sm:w-36" },
    menus: (__VLS_ctx.sourceList),
    modelValue: (__VLS_ctx.sourceIPLabel.key),
    placeholder: "IP | CIDR | eui64 | /Regex",
}, ...__VLS_functionalComponentArgsRest(__VLS_3));
/** @type {__VLS_StyleScopedClasses['w-12']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-64']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:w-36']} */ ;
if (__VLS_ctx.backendList.length > 1) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (__VLS_ctx.bindBackendMenu) },
        ...{ class: "rounded-field bg-base-200 flex h-8 w-8 cursor-pointer items-center justify-center" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-field']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-200']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-8']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-8']} */ ;
    /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
    if (__VLS_ctx.isLocked) {
        let __VLS_7;
        /** @ts-ignore @type {typeof __VLS_components.LockClosedIcon} */
        LockClosedIcon;
        // @ts-ignore
        const __VLS_8 = __VLS_asFunctionalComponent1(__VLS_7, new __VLS_7({
            ...{ class: "h-4 w-4" },
        }));
        const __VLS_9 = __VLS_8({
            ...{ class: "h-4 w-4" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_8));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    }
    else {
        let __VLS_12;
        /** @ts-ignore @type {typeof __VLS_components.LockOpenIcon} */
        LockOpenIcon;
        // @ts-ignore
        const __VLS_13 = __VLS_asFunctionalComponent1(__VLS_12, new __VLS_12({
            ...{ class: "h-4 w-4" },
        }));
        const __VLS_14 = __VLS_13({
            ...{ class: "h-4 w-4" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_13));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    }
}
let __VLS_17;
/** @ts-ignore @type {typeof __VLS_components.ArrowRightCircleIcon} */
ArrowRightCircleIcon;
// @ts-ignore
const __VLS_18 = __VLS_asFunctionalComponent1(__VLS_17, new __VLS_17({
    ...{ class: "h-4 w-4 shrink-0" },
}));
const __VLS_19 = __VLS_18({
    ...{ class: "h-4 w-4 shrink-0" },
}, ...__VLS_functionalComponentArgsRest(__VLS_18));
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
const __VLS_22 = TextInput;
// @ts-ignore
const __VLS_23 = __VLS_asFunctionalComponent1(__VLS_22, new __VLS_22({
    ...{ class: "w-24 sm:w-40" },
    modelValue: (__VLS_ctx.sourceIPLabel.label),
    placeholder: (__VLS_ctx.$t('label')),
}));
const __VLS_24 = __VLS_23({
    ...{ class: "w-24 sm:w-40" },
    modelValue: (__VLS_ctx.sourceIPLabel.label),
    placeholder: (__VLS_ctx.$t('label')),
}, ...__VLS_functionalComponentArgsRest(__VLS_23));
/** @type {__VLS_StyleScopedClasses['w-24']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:w-40']} */ ;
var __VLS_27 = {};
// @ts-ignore
var __VLS_1 = __VLS_0, __VLS_28 = __VLS_27;
// @ts-ignore
[sourceIPLabel, sourceIPLabel, sourceIPLabel, sourceIPLabel, checkTruncation, backendList, backendList, getLabelFromBackend, sourceList, bindBackendMenu, isLocked, $t,];
const __VLS_base = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
const __VLS_export = {};
export default {};
