/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { BACKEND_KINDS } from '@/config/backendContract';
import { UBUNTU_PATHS } from '@/config/project';
import { getBackendKindBadgeClass, getBackendProbePaths } from '@/helper/backend';
import { getUrlFromBackend } from '@/helper/utils';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
const props = defineProps();
const { t } = useI18n();
const kind = computed(() => props.kind || props.backend.kind || BACKEND_KINDS.COMPATIBILITY_BRIDGE);
const baseUrl = computed(() => getUrlFromBackend(props.backend));
const probePaths = computed(() => getBackendProbePaths(kind.value));
const headingKey = computed(() => kind.value === BACKEND_KINDS.UBUNTU_SERVICE
    ? 'backendContractUbuntuHeading'
    : 'backendContractCompatibilityHeading');
const summaryText = computed(() => kind.value === BACKEND_KINDS.UBUNTU_SERVICE
    ? t('backendContractUbuntuSummary')
    : t('backendContractCompatibilitySummary'));
const ubuntuPathItems = computed(() => [
    { key: 'active', label: t('backendContractPathActiveConfig'), value: UBUNTU_PATHS.activeConfig },
    { key: 'state', label: t('backendContractPathStateRoot'), value: UBUNTU_PATHS.stateRoot },
    { key: 'config', label: t('backendContractPathConfigRoot'), value: UBUNTU_PATHS.configRoot },
    { key: 'logs', label: t('backendContractPathLogsRoot'), value: UBUNTU_PATHS.logsRoot },
    { key: 'mihomoLog', label: t('backendContractPathMihomoLog'), value: UBUNTU_PATHS.mihomoLog },
    { key: 'env', label: t('backendContractPathAgentEnv'), value: UBUNTU_PATHS.agentEnv },
]);
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-2xl border border-base-300/70 bg-base-100/70 px-3 py-3 text-xs leading-5" },
});
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300/70']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-start justify-between gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
(__VLS_ctx.$t(__VLS_ctx.headingKey));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "opacity-75" },
});
/** @type {__VLS_StyleScopedClasses['opacity-75']} */ ;
(__VLS_ctx.summaryText);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: (__VLS_ctx.getBackendKindBadgeClass(__VLS_ctx.kind)) },
});
(__VLS_ctx.kind === __VLS_ctx.BACKEND_KINDS.UBUNTU_SERVICE ? __VLS_ctx.$t('backendModeShortUbuntu') : __VLS_ctx.$t('backendModeShortDirect'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-3 grid gap-2 lg:grid-cols-2" },
});
/** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:grid-cols-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-xl border border-base-300/60 bg-base-200/40 p-3" },
});
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300/60']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200/40']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mb-1 font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
(__VLS_ctx.$t('backendContractConnectionPreview'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "font-mono break-all" },
});
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
/** @type {__VLS_StyleScopedClasses['break-all']} */ ;
(__VLS_ctx.baseUrl);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-2 text-[11px] opacity-70" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
(__VLS_ctx.$t('backendContractConnectionPreviewTip'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-xl border border-base-300/60 bg-base-200/40 p-3" },
});
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300/60']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200/40']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mb-1 font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
(__VLS_ctx.$t('backendContractProbePaths'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap gap-1" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
for (const [item] of __VLS_vFor((__VLS_ctx.probePaths))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({
        key: (item),
        ...{ class: "rounded bg-base-100 px-2 py-1" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-1']} */ ;
    (item);
    // @ts-ignore
    [$t, $t, $t, $t, $t, $t, headingKey, summaryText, getBackendKindBadgeClass, kind, kind, BACKEND_KINDS, baseUrl, probePaths,];
}
if (__VLS_ctx.kind === __VLS_ctx.BACKEND_KINDS.UBUNTU_SERVICE) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-3 rounded-xl border border-success/30 bg-success/10 p-3" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-success/30']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-success/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mb-2 font-semibold" },
    });
    /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    (__VLS_ctx.$t('backendContractUbuntuPathsTitle'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid gap-2 md:grid-cols-2" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
    for (const [item] of __VLS_vFor((__VLS_ctx.ubuntuPathItems))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (item.key),
            ...{ class: "rounded-lg border border-success/20 bg-base-100/60 px-3 py-2" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-success/20']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "text-[11px] uppercase tracking-[0.12em] opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
        /** @type {__VLS_StyleScopedClasses['tracking-[0.12em]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (item.label);
        __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({
            ...{ class: "mt-1 block break-all" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['block']} */ ;
        /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
        (item.value);
        // @ts-ignore
        [$t, kind, BACKEND_KINDS, ubuntuPathItems,];
    }
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-3 rounded-xl border border-warning/30 bg-warning/10 p-3" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-warning/30']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-warning/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "font-semibold" },
    });
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    (__VLS_ctx.$t('backendContractCompatibilityTitle'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-1 opacity-80" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
    (__VLS_ctx.$t('backendContractCompatibilityTip'));
}
// @ts-ignore
[$t, $t,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
