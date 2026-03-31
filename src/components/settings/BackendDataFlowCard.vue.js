/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { BACKEND_KINDS } from '@/config/backendContract';
import { UBUNTU_PATHS } from '@/config/project';
import { getBackendKindBadgeClass } from '@/helper/backend';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
const props = defineProps();
const { t } = useI18n();
const kind = computed(() => props.kind || props.backend.kind || BACKEND_KINDS.COMPATIBILITY_BRIDGE);
const isUbuntuService = computed(() => kind.value === BACKEND_KINDS.UBUNTU_SERVICE);
const summaryText = computed(() => isUbuntuService.value ? t('backendDataFlowUbuntuSummary') : t('backendDataFlowCompatibilitySummary'));
const directHint = computed(() => isUbuntuService.value ? t('backendDataFlowDirectHintUbuntu') : t('backendDataFlowDirectHintCompatibility'));
const serviceHint = computed(() => isUbuntuService.value ? t('backendDataFlowServiceHintUbuntu') : t('backendDataFlowServiceHintCompatibility'));
const mihomoLogPath = UBUNTU_PATHS.mihomoLog;
const directItems = computed(() => [
    {
        key: 'proxies',
        title: t('backendDataFlowDirectProxiesTitle'),
        text: t('backendDataFlowDirectProxiesText'),
    },
    {
        key: 'rules',
        title: t('backendDataFlowDirectRulesTitle'),
        text: t('backendDataFlowDirectRulesText'),
    },
    {
        key: 'connections',
        title: t('backendDataFlowDirectConnectionsTitle'),
        text: t('backendDataFlowDirectConnectionsText'),
    },
    {
        key: 'logs',
        title: t('backendDataFlowDirectLogsTitle'),
        text: t('backendDataFlowDirectLogsText'),
    },
]);
const serviceItems = computed(() => {
    const active = isUbuntuService.value;
    return [
        {
            key: 'metrics',
            title: t('backendDataFlowServiceMetricsTitle'),
            text: active ? t('backendDataFlowServiceMetricsTextActive') : t('backendDataFlowServiceMetricsTextPending'),
            active,
        },
        {
            key: 'systemd',
            title: t('backendDataFlowServiceSystemdTitle'),
            text: active ? t('backendDataFlowServiceSystemdTextActive') : t('backendDataFlowServiceSystemdTextPending'),
            active,
        },
        {
            key: 'config',
            title: t('backendDataFlowServiceConfigTitle'),
            text: active ? t('backendDataFlowServiceConfigTextActive') : t('backendDataFlowServiceConfigTextPending'),
            active,
        },
        {
            key: 'backup',
            title: t('backendDataFlowServiceBackupTitle'),
            text: active ? t('backendDataFlowServiceBackupTextActive') : t('backendDataFlowServiceBackupTextPending'),
            active,
        },
    ];
});
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
(__VLS_ctx.$t('backendDataFlowTitle'));
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
    ...{ class: "mt-3 grid gap-2 xl:grid-cols-2" },
});
/** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['xl:grid-cols-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-xl border border-base-300/60 bg-base-200/40 p-3" },
});
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300/60']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200/40']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mb-2 font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
(__VLS_ctx.$t('backendDataFlowDirectTitle'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mb-2 text-[11px] opacity-70" },
});
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
(__VLS_ctx.directHint);
__VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
    ...{ class: "space-y-1.5" },
});
/** @type {__VLS_StyleScopedClasses['space-y-1.5']} */ ;
for (const [item] of __VLS_vFor((__VLS_ctx.directItems))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
        key: (item.key),
        ...{ class: "flex items-start gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "mt-[2px] h-1.5 w-1.5 rounded-full bg-primary/70" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-[2px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-1.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-1.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-primary/70']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "font-medium" },
    });
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    (item.title);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "opacity-75" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-75']} */ ;
    (item.text);
    // @ts-ignore
    [$t, $t, $t, $t, summaryText, getBackendKindBadgeClass, kind, kind, BACKEND_KINDS, directHint, directItems,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-xl border border-base-300/60 bg-base-200/40 p-3" },
});
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300/60']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200/40']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mb-2 font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
(__VLS_ctx.$t('backendDataFlowServiceTitle'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mb-2 text-[11px] opacity-70" },
});
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
(__VLS_ctx.serviceHint);
__VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
    ...{ class: "space-y-1.5" },
});
/** @type {__VLS_StyleScopedClasses['space-y-1.5']} */ ;
for (const [item] of __VLS_vFor((__VLS_ctx.serviceItems))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
        key: (item.key),
        ...{ class: "flex items-start gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "mt-[2px] h-1.5 w-1.5 rounded-full" },
        ...{ class: (item.active ? 'bg-success/70' : 'bg-warning/70') },
    });
    /** @type {__VLS_StyleScopedClasses['mt-[2px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-1.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-1.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "font-medium" },
    });
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    (item.title);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "opacity-75" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-75']} */ ;
    (item.text);
    // @ts-ignore
    [$t, serviceHint, serviceItems,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-3 rounded-xl border border-info/30 bg-info/10 p-3" },
});
/** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-info/30']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-info/10']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
(__VLS_ctx.$t('backendDataFlowObservabilityTitle'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-1 opacity-80" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
(__VLS_ctx.$t('backendDataFlowObservabilityTip'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-2 rounded-lg border border-info/20 bg-base-100/70 px-3 py-2" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-info/20']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-[11px] uppercase tracking-[0.12em] opacity-60" },
});
/** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-[0.12em]']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
(__VLS_ctx.$t('backendDataFlowMihomoLogLabel'));
__VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({
    ...{ class: "mt-1 block break-all" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['break-all']} */ ;
(__VLS_ctx.mihomoLogPath);
// @ts-ignore
[$t, $t, $t, mihomoLogPath,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
