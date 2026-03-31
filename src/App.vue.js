/// <reference types="../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed, onMounted, ref, watch } from 'vue';
import { RouterView } from 'vue-router';
import { useKeyboard } from './composables/keyboard';
import { EMOJIS, FONTS } from './constant';
import { autoImportSettings, importSettingsFromUrl } from './helper/autoImportSettings';
import { backgroundImage } from './helper/indexeddb';
import { initNotification } from './helper/notification';
import { isPreferredDark } from './helper/utils';
import { blurIntensity, dashboardTransparent, disablePullToRefresh, emoji, font, theme, } from './store/settings';
import { initUsersDbSync } from './store/usersDbSync';
import { bootstrapRouterAgentForLan } from './store/agent';
import { initProviderTrafficSync } from './store/providerActivity';
const app = ref();
const toast = ref();
initNotification(toast);
// 字体类名映射表
const FONT_CLASS_MAP = {
    [EMOJIS.TWEMOJI]: {
        [FONTS.MI_SANS]: 'font-MiSans-Twemoji',
        [FONTS.SARASA_UI]: 'font-SarasaUI-Twemoji',
        [FONTS.PING_FANG]: 'font-PingFang-Twemoji',
        [FONTS.FIRA_SANS]: 'font-FiraSans-Twemoji',
        [FONTS.SYSTEM_UI]: 'font-SystemUI-Twemoji',
    },
    [EMOJIS.NOTO_COLOR_EMOJI]: {
        [FONTS.MI_SANS]: 'font-MiSans-NotoEmoji',
        [FONTS.SARASA_UI]: 'font-SarasaUI-NotoEmoji',
        [FONTS.PING_FANG]: 'font-PingFang-NotoEmoji',
        [FONTS.FIRA_SANS]: 'font-FiraSans-NotoEmoji',
        [FONTS.SYSTEM_UI]: 'font-SystemUI-NotoEmoji',
    },
};
const fontClassName = computed(() => {
    return (FONT_CLASS_MAP[emoji.value]?.[font.value] || FONT_CLASS_MAP[EMOJIS.TWEMOJI][FONTS.SYSTEM_UI]);
});
const setThemeColor = () => {
    const themeColor = getComputedStyle(app.value).getPropertyValue('background-color').trim();
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
        metaThemeColor.setAttribute('content', themeColor);
    }
};
watch(isPreferredDark, setThemeColor);
watch(disablePullToRefresh, () => {
    if (disablePullToRefresh.value) {
        document.body.style.overscrollBehavior = 'none';
        document.documentElement.style.overscrollBehavior = 'none';
    }
    else {
        document.body.style.overscrollBehavior = '';
        document.documentElement.style.overscrollBehavior = '';
    }
}, {
    immediate: true,
});
onMounted(() => {
    bootstrapRouterAgentForLan();
    initUsersDbSync();
    initProviderTrafficSync();
    if (autoImportSettings.value) {
        importSettingsFromUrl();
    }
    watch(theme, () => {
        document.body.setAttribute('data-theme', theme.value);
        setThemeColor();
    }, {
        immediate: true,
    });
});
const blurClass = computed(() => {
    if (!backgroundImage.value || blurIntensity.value === 0) {
        return '';
    }
    return `blur-intensity-${blurIntensity.value}`;
});
useKeyboard();
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ref: "app",
    id: "app-content",
    ...{ class: ([
            'bg-base-100 flex h-dvh w-screen overflow-hidden',
            __VLS_ctx.fontClassName,
            __VLS_ctx.backgroundImage &&
                `custom-background-${__VLS_ctx.dashboardTransparent} custom-background bg-cover bg-center`,
            __VLS_ctx.blurClass,
        ]) },
    ...{ style: (__VLS_ctx.backgroundImage) },
});
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['h-dvh']} */ ;
/** @type {__VLS_StyleScopedClasses['w-screen']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
let __VLS_0;
/** @ts-ignore @type {typeof __VLS_components.RouterView} */
RouterView;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement1(__VLS_intrinsics.div)({
    ref: "toast",
    ...{ class: "toast-sm toast toast-end toast-top z-9999 max-w-96 text-sm md:translate-y-8" },
});
/** @type {__VLS_StyleScopedClasses['toast-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['toast']} */ ;
/** @type {__VLS_StyleScopedClasses['toast-end']} */ ;
/** @type {__VLS_StyleScopedClasses['toast-top']} */ ;
/** @type {__VLS_StyleScopedClasses['z-9999']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-96']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['md:translate-y-8']} */ ;
// @ts-ignore
[fontClassName, backgroundImage, backgroundImage, dashboardTransparent, blurClass,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
