/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { upgradeUIAPI, zashboardVersion } from '@/api';
import { APP_DISPLAY_NAME, APP_REPO_URL } from '@/config/project';
import LanguageSelect from '@/components/settings/LanguageSelect.vue';
import { useSettings } from '@/composables/settings';
import { useUiBuild } from '@/composables/uiBuild';
import { EMOJIS, FONTS } from '@/constant';
import { handlerUpgradeSuccess } from '@/helper';
import { deleteBase64FromIndexedDB, LOCAL_IMAGE, saveBase64ToIndexedDB } from '@/helper/indexeddb';
import { exportSettings, isPWA } from '@/helper/utils';
import { autoTheme, autoUpgrade, blurIntensity, customBackgroundURL, darkTheme, dashboardTransparent, defaultTheme, emoji, font, } from '@/store/settings';
import { AdjustmentsHorizontalIcon, ArrowPathIcon, ArrowUpTrayIcon, PlusIcon, } from '@heroicons/vue/24/outline';
import dayjs from 'dayjs';
import { twMerge } from 'tailwind-merge';
import { computed, ref, watch } from 'vue';
import ImportSettings from '../common/ImportSettings.vue';
import TextInput from '../common/TextInput.vue';
import CustomTheme from './CustomTheme.vue';
import ThemeSelector from './ThemeSelector.vue';
const customThemeModal = ref(false);
const displayBgProperty = ref(false);
watch(customBackgroundURL, (value) => {
    if (value) {
        displayBgProperty.value = true;
    }
});
const inputFileRef = ref();
const handlerClickUpload = () => {
    inputFileRef.value?.click();
};
const handlerBackgroundURLChange = () => {
    if (!customBackgroundURL.value.includes(LOCAL_IMAGE)) {
        deleteBase64FromIndexedDB();
    }
};
const handlerFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file)
        return;
    const reader = new FileReader();
    reader.onload = () => {
        customBackgroundURL.value = LOCAL_IMAGE + '-' + Date.now();
        saveBase64ToIndexedDB(reader.result);
    };
    reader.readAsDataURL(file);
};
const fontOptions = computed(() => {
    const mode = import.meta.env.MODE;
    if (Object.values(FONTS).includes(mode)) {
        return [mode];
    }
    return Object.values(FONTS);
});
const { isUIUpdateAvailable } = useSettings();
const { uiBuildId, currentBundleTag, onlineBundleTag, isUiBuildChecking, isFreshUiBuildAvailable, uiBuildStatusKey, uiBuildCheckError, lastUiBuildCheckedAt, checkFreshUiBuild, hardRefreshUiCache, } = useUiBuild();
const lastCheckedLabel = computed(() => {
    if (!lastUiBuildCheckedAt.value)
        return '';
    return dayjs(lastUiBuildCheckedAt.value).format('DD-MM-YYYY HH:mm:ss');
});
const isUIUpgrading = ref(false);
const handlerClickUpgradeUI = async () => {
    if (isUIUpgrading.value)
        return;
    isUIUpgrading.value = true;
    try {
        await upgradeUIAPI();
        isUIUpgrading.value = false;
        handlerUpgradeSuccess();
        setTimeout(() => {
            void hardRefreshUiCache();
        }, 1000);
    }
    catch {
        isUIUpgrading.value = false;
    }
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
if (__VLS_ctx.isUIUpdateAvailable) {
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
    href: (__VLS_ctx.APP_REPO_URL),
    target: "_blank",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.APP_DISPLAY_NAME);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "text-sm font-normal" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-normal']} */ ;
(__VLS_ctx.zashboardVersion);
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.hardRefreshUiCache) },
    ...{ class: "btn btn-sm absolute top-2 right-2" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['top-2']} */ ;
/** @type {__VLS_StyleScopedClasses['right-2']} */ ;
(__VLS_ctx.$t('uiHardRefresh'));
let __VLS_0;
/** @ts-ignore @type {typeof __VLS_components.ArrowPathIcon} */
ArrowPathIcon;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    ...{ class: "h-4 w-4" },
}));
const __VLS_2 = __VLS_1({
    ...{ class: "h-4 w-4" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card-body gap-4" },
});
/** @type {__VLS_StyleScopedClasses['card-body']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-2xl border border-base-300/70 bg-base-200/40 p-3" },
});
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300/70']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200/40']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-start justify-between gap-3" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "space-y-1" },
});
/** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-sm font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
(__VLS_ctx.$t('uiCacheStatusTitle'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-xs opacity-70" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
(__VLS_ctx.$t('uiCacheStatusTip'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "badge badge-primary badge-outline" },
});
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
(__VLS_ctx.zashboardVersion);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "badge badge-secondary badge-outline" },
});
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
(__VLS_ctx.uiBuildId);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "badge" },
    ...{ class: ([
            __VLS_ctx.isFreshUiBuildAvailable
                ? 'badge-warning'
                : __VLS_ctx.uiBuildCheckError
                    ? 'badge-error'
                    : __VLS_ctx.onlineBundleTag !== '—'
                        ? 'badge-success'
                        : 'badge-ghost',
        ]) },
});
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
(__VLS_ctx.$t(__VLS_ctx.uiBuildStatusKey));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-3 grid grid-cols-1 gap-2 text-xs md:grid-cols-2" },
});
/** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-xl bg-base-100/60 px-3 py-2" },
});
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "opacity-60" },
});
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
(__VLS_ctx.$t('uiLoadedBundle'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-1 break-all font-mono text-[11px] text-base-content/90" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['break-all']} */ ;
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/90']} */ ;
(__VLS_ctx.currentBundleTag);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-xl bg-base-100/60 px-3 py-2" },
});
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "opacity-60" },
});
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
(__VLS_ctx.$t('uiOnlineBundle'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-1 break-all font-mono text-[11px] text-base-content/90" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['break-all']} */ ;
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/90']} */ ;
(__VLS_ctx.onlineBundleTag);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-3 flex flex-wrap items-center gap-2 text-xs opacity-70" },
});
/** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
if (__VLS_ctx.lastCheckedLabel) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.$t('uiLastChecked'));
    (__VLS_ctx.lastCheckedLabel);
}
if (__VLS_ctx.uiBuildCheckError) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.uiBuildCheckError);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-3 flex flex-wrap gap-2" },
});
/** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.checkFreshUiBuild) },
    ...{ class: "btn btn-sm" },
    ...{ class: (__VLS_ctx.isUiBuildChecking ? 'animate-pulse' : '') },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
(__VLS_ctx.$t('uiCheckFreshness'));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.hardRefreshUiCache) },
    ...{ class: "btn btn-sm btn-outline" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-outline']} */ ;
(__VLS_ctx.$t('uiHardRefresh'));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "self-center text-xs opacity-60" },
});
/** @type {__VLS_StyleScopedClasses['self-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
(__VLS_ctx.isPWA ? __VLS_ctx.$t('uiPwaModeDetected') : __VLS_ctx.$t('uiBrowserModeDetected'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid grid-cols-1 gap-2 lg:grid-cols-2" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:grid-cols-2']} */ ;
const __VLS_5 = LanguageSelect;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({}));
const __VLS_7 = __VLS_6({}, ...__VLS_functionalComponentArgsRest(__VLS_6));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
(__VLS_ctx.$t('autoSwitchTheme'));
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "checkbox",
    ...{ class: "toggle" },
});
(__VLS_ctx.autoTheme);
/** @type {__VLS_StyleScopedClasses['toggle']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
(__VLS_ctx.$t('defaultTheme'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "join" },
});
/** @type {__VLS_StyleScopedClasses['join']} */ ;
const __VLS_10 = ThemeSelector;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
    value: (__VLS_ctx.defaultTheme),
}));
const __VLS_12 = __VLS_11({
    value: (__VLS_ctx.defaultTheme),
}, ...__VLS_functionalComponentArgsRest(__VLS_11));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.customThemeModal = !__VLS_ctx.customThemeModal;
            // @ts-ignore
            [isUIUpdateAvailable, APP_REPO_URL, APP_DISPLAY_NAME, zashboardVersion, zashboardVersion, hardRefreshUiCache, hardRefreshUiCache, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, uiBuildId, isFreshUiBuildAvailable, uiBuildCheckError, uiBuildCheckError, uiBuildCheckError, onlineBundleTag, onlineBundleTag, uiBuildStatusKey, currentBundleTag, lastCheckedLabel, lastCheckedLabel, checkFreshUiBuild, isUiBuildChecking, isPWA, autoTheme, defaultTheme, customThemeModal, customThemeModal,];
        } },
    ...{ class: "btn btn-sm join-item" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['join-item']} */ ;
let __VLS_15;
/** @ts-ignore @type {typeof __VLS_components.PlusIcon} */
PlusIcon;
// @ts-ignore
const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({
    ...{ class: "h-4 w-4" },
}));
const __VLS_17 = __VLS_16({
    ...{ class: "h-4 w-4" },
}, ...__VLS_functionalComponentArgsRest(__VLS_16));
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
const __VLS_20 = CustomTheme;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent1(__VLS_20, new __VLS_20({
    value: (__VLS_ctx.customThemeModal),
}));
const __VLS_22 = __VLS_21({
    value: (__VLS_ctx.customThemeModal),
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
if (__VLS_ctx.autoTheme) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    (__VLS_ctx.$t('darkTheme'));
    const __VLS_25 = ThemeSelector;
    // @ts-ignore
    const __VLS_26 = __VLS_asFunctionalComponent1(__VLS_25, new __VLS_25({
        value: (__VLS_ctx.darkTheme),
    }));
    const __VLS_27 = __VLS_26({
        value: (__VLS_ctx.darkTheme),
    }, ...__VLS_functionalComponentArgsRest(__VLS_26));
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
(__VLS_ctx.$t('fonts'));
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (__VLS_ctx.font),
    ...{ class: "select select-sm w-48" },
});
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['w-48']} */ ;
for (const [opt] of __VLS_vFor((__VLS_ctx.fontOptions))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (opt),
        value: (opt),
    });
    (opt);
    // @ts-ignore
    [$t, $t, autoTheme, customThemeModal, darkTheme, font, fontOptions,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (__VLS_ctx.emoji),
    ...{ class: "select select-sm w-48" },
});
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['w-48']} */ ;
for (const [opt] of __VLS_vFor((Object.values(__VLS_ctx.EMOJIS)))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (opt),
        value: (opt),
    });
    (opt);
    // @ts-ignore
    [emoji, EMOJIS,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "shrink-0" },
});
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
(__VLS_ctx.$t('customBackgroundURL'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "join" },
});
/** @type {__VLS_StyleScopedClasses['join']} */ ;
const __VLS_30 = TextInput;
// @ts-ignore
const __VLS_31 = __VLS_asFunctionalComponent1(__VLS_30, new __VLS_30({
    ...{ 'onUpdate:modelValue': {} },
    modelValue: (__VLS_ctx.customBackgroundURL),
    ...{ class: "join-item w-48" },
    clearable: (true),
}));
const __VLS_32 = __VLS_31({
    ...{ 'onUpdate:modelValue': {} },
    modelValue: (__VLS_ctx.customBackgroundURL),
    ...{ class: "join-item w-48" },
    clearable: (true),
}, ...__VLS_functionalComponentArgsRest(__VLS_31));
let __VLS_35;
const __VLS_36 = ({ 'update:modelValue': {} },
    { 'onUpdate:modelValue': (__VLS_ctx.handlerBackgroundURLChange) });
/** @type {__VLS_StyleScopedClasses['join-item']} */ ;
/** @type {__VLS_StyleScopedClasses['w-48']} */ ;
var __VLS_33;
var __VLS_34;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.handlerClickUpload) },
    ...{ class: "btn join-item btn-sm" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['join-item']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
let __VLS_37;
/** @ts-ignore @type {typeof __VLS_components.ArrowUpTrayIcon} */
ArrowUpTrayIcon;
// @ts-ignore
const __VLS_38 = __VLS_asFunctionalComponent1(__VLS_37, new __VLS_37({
    ...{ class: "h-4 w-4" },
}));
const __VLS_39 = __VLS_38({
    ...{ class: "h-4 w-4" },
}, ...__VLS_functionalComponentArgsRest(__VLS_38));
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
if (__VLS_ctx.customBackgroundURL) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.customBackgroundURL))
                    return;
                __VLS_ctx.displayBgProperty = !__VLS_ctx.displayBgProperty;
                // @ts-ignore
                [$t, customBackgroundURL, customBackgroundURL, handlerBackgroundURLChange, handlerClickUpload, displayBgProperty, displayBgProperty,];
            } },
        ...{ class: "btn btn-circle join-item btn-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
    /** @type {__VLS_StyleScopedClasses['join-item']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
    let __VLS_42;
    /** @ts-ignore @type {typeof __VLS_components.AdjustmentsHorizontalIcon} */
    AdjustmentsHorizontalIcon;
    // @ts-ignore
    const __VLS_43 = __VLS_asFunctionalComponent1(__VLS_42, new __VLS_42({
        ...{ class: "h-4 w-4" },
    }));
    const __VLS_44 = __VLS_43({
        ...{ class: "h-4 w-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_43));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onChange: (__VLS_ctx.handlerFileChange) },
    ref: "inputFileRef",
    type: "file",
    accept: "image/*",
    ...{ class: "hidden" },
});
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
if (__VLS_ctx.customBackgroundURL && __VLS_ctx.displayBgProperty) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    (__VLS_ctx.$t('transparent'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onTouchstart: () => { } },
        ...{ onTouchmove: () => { } },
        ...{ onTouchend: () => { } },
        type: "range",
        min: "0",
        max: "100",
        ...{ class: "range max-w-64" },
    });
    (__VLS_ctx.dashboardTransparent);
    /** @type {__VLS_StyleScopedClasses['range']} */ ;
    /** @type {__VLS_StyleScopedClasses['max-w-64']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    (__VLS_ctx.$t('blurIntensity'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onTouchstart: () => { } },
        ...{ onTouchmove: () => { } },
        ...{ onTouchend: () => { } },
        type: "range",
        min: "0",
        max: "40",
        ...{ class: "range max-w-64" },
    });
    (__VLS_ctx.blurIntensity);
    /** @type {__VLS_StyleScopedClasses['range']} */ ;
    /** @type {__VLS_StyleScopedClasses['max-w-64']} */ ;
}
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
(__VLS_ctx.autoUpgrade);
/** @type {__VLS_StyleScopedClasses['toggle']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid max-w-4xl grid-cols-2 gap-2 sm:grid-cols-4" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-4xl']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:grid-cols-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.handlerClickUpgradeUI) },
    ...{ class: (__VLS_ctx.twMerge('btn btn-primary btn-sm', __VLS_ctx.isUIUpgrading ? 'animate-pulse' : '')) },
});
(__VLS_ctx.$t('upgradeUI'));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.checkFreshUiBuild) },
    ...{ class: "btn btn-sm" },
    ...{ class: (__VLS_ctx.isUiBuildChecking ? 'animate-pulse' : '') },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
(__VLS_ctx.$t('uiCheckFreshness'));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.exportSettings) },
    ...{ class: "btn btn-sm" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
(__VLS_ctx.$t('exportSettings'));
const __VLS_47 = ImportSettings;
// @ts-ignore
const __VLS_48 = __VLS_asFunctionalComponent1(__VLS_47, new __VLS_47({}));
const __VLS_49 = __VLS_48({}, ...__VLS_functionalComponentArgsRest(__VLS_48));
// @ts-ignore
[$t, $t, $t, $t, $t, $t, checkFreshUiBuild, isUiBuildChecking, customBackgroundURL, displayBgProperty, handlerFileChange, dashboardTransparent, blurIntensity, autoUpgrade, handlerClickUpgradeUI, twMerge, isUIUpgrading, exportSettings,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
