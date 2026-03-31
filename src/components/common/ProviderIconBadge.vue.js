/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { FLAG_URLS } from '@/helper/flagIcons';
import { normalizeProviderIcon } from '@/helper/providerIcon';
import { GlobeAltIcon } from '@heroicons/vue/24/outline';
import { computed } from 'vue';
const props = withDefaults(defineProps(), { size: 'md' });
const raw = computed(() => normalizeProviderIcon(props.icon));
const kind = computed(() => {
    if (!raw.value)
        return 'none';
    if (raw.value === 'globe')
        return 'globe';
    return 'flag';
});
const flagCode = computed(() => {
    if (kind.value !== 'flag')
        return '';
    const cc = String(raw.value || '').trim().toUpperCase();
    return /^[A-Z]{2}$/.test(cc) ? cc : '';
});
const flagUrl = computed(() => {
    if (!flagCode.value)
        return '';
    const key = `/node_modules/flag-icons/flags/4x3/${flagCode.value.toLowerCase()}.svg`;
    return FLAG_URLS[key] || '';
});
const titleText = computed(() => {
    if (kind.value === 'none')
        return '—';
    if (kind.value === 'globe')
        return 'globe';
    return flagCode.value || raw.value;
});
const flagStyle = computed(() => {
    const w = props.size === 'sm' ? 18 : 20;
    const h = props.size === 'sm' ? 12 : 14;
    return {
        width: `${w}px`,
        height: `${h}px`,
        borderRadius: '2px',
        boxShadow: '0 0 0 1px rgba(0,0,0,0.12) inset',
    };
});
const __VLS_defaults = { size: 'md' };
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: ([
            'inline-flex items-center justify-center whitespace-nowrap rounded-md border border-base-300/70 bg-base-200/40 font-semibold leading-none tracking-wide shrink-0',
            __VLS_ctx.size === 'sm' ? 'h-5 min-w-8 px-1.5 text-[11px]' : 'h-6 min-w-9 px-2 text-[12px]',
        ]) },
    title: (__VLS_ctx.titleText),
});
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300/70']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200/40']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-none']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
if (__VLS_ctx.kind === 'none') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
}
else if (__VLS_ctx.kind === 'globe') {
    let __VLS_0;
    /** @ts-ignore @type {typeof __VLS_components.GlobeAltIcon} */
    GlobeAltIcon;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        ...{ class: "h-4 w-4" },
    }));
    const __VLS_2 = __VLS_1({
        ...{ class: "h-4 w-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
}
else if (__VLS_ctx.flagUrl) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
        src: (__VLS_ctx.flagUrl),
        ...{ style: (__VLS_ctx.flagStyle) },
        alt: (__VLS_ctx.flagCode),
    });
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-mono" },
    });
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    (__VLS_ctx.flagCode || __VLS_ctx.raw);
}
// @ts-ignore
[size, titleText, kind, kind, flagUrl, flagUrl, flagStyle, flagCode, flagCode, raw,];
const __VLS_export = (await import('vue')).defineComponent({
    __defaults: __VLS_defaults,
    __typeProps: {},
});
export default {};
