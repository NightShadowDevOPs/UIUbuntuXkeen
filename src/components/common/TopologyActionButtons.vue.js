/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { navigateToTopology } from '@/helper/topologyNav';
import { FunnelIcon, NoSymbolIcon, PresentationChartLineIcon } from '@heroicons/vue/24/outline';
import { twMerge } from 'tailwind-merge';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
const props = defineProps();
const emit = defineEmits();
const router = useRouter();
const { t } = useI18n();
const grouped = computed(() => props.grouped !== false);
const enabled = computed(() => {
    if (props.disabled)
        return false;
    return String(props.value || '').trim().length > 0;
});
const btnClass = computed(() => twMerge(grouped.value ? 'btn btn-ghost btn-xs join-item' : 'btn btn-ghost btn-xs btn-circle', props.buttonClass));
const iconClass = computed(() => twMerge('h-4 w-4', props.iconClass));
const go = async (mode) => {
    emit('beforeNavigate', mode);
    await navigateToTopology(router, { stage: props.stage, value: String(props.value || '').trim() }, mode, { fallbackProxyName: props.fallbackProxyName });
};
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
if (__VLS_ctx.enabled) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: (__VLS_ctx.twMerge(__VLS_ctx.grouped ? 'join' : 'flex items-center gap-1', props.containerClass)) },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (() => __VLS_ctx.go('none')) },
        type: "button",
        ...{ class: (__VLS_ctx.btnClass) },
        title: (__VLS_ctx.t('openInTopology')),
    });
    let __VLS_0;
    /** @ts-ignore @type {typeof __VLS_components.PresentationChartLineIcon} */
    PresentationChartLineIcon;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        ...{ class: (__VLS_ctx.iconClass) },
    }));
    const __VLS_2 = __VLS_1({
        ...{ class: (__VLS_ctx.iconClass) },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (() => __VLS_ctx.go('only')) },
        type: "button",
        ...{ class: (__VLS_ctx.btnClass) },
        title: (__VLS_ctx.t('topologyOnlyThis')),
    });
    let __VLS_5;
    /** @ts-ignore @type {typeof __VLS_components.FunnelIcon} */
    FunnelIcon;
    // @ts-ignore
    const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
        ...{ class: (__VLS_ctx.iconClass) },
    }));
    const __VLS_7 = __VLS_6({
        ...{ class: (__VLS_ctx.iconClass) },
    }, ...__VLS_functionalComponentArgsRest(__VLS_6));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (() => __VLS_ctx.go('exclude')) },
        type: "button",
        ...{ class: (__VLS_ctx.btnClass) },
        title: (__VLS_ctx.t('topologyExcludeThis')),
    });
    let __VLS_10;
    /** @ts-ignore @type {typeof __VLS_components.NoSymbolIcon} */
    NoSymbolIcon;
    // @ts-ignore
    const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
        ...{ class: (__VLS_ctx.iconClass) },
    }));
    const __VLS_12 = __VLS_11({
        ...{ class: (__VLS_ctx.iconClass) },
    }, ...__VLS_functionalComponentArgsRest(__VLS_11));
}
// @ts-ignore
[enabled, twMerge, grouped, go, go, go, btnClass, btnClass, btnClass, t, t, t, iconClass, iconClass, iconClass,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
