/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { upgradeCoreAPI } from '@/api';
import { handlerUpgradeSuccess } from '@/helper';
import { fetchConfigs } from '@/store/config';
import { fetchProxies } from '@/store/proxies';
import { fetchRules } from '@/store/rules';
import { ref } from 'vue';
import DialogWrapper from '../common/DialogWrapper.vue';
const reloadAll = () => {
    fetchConfigs();
    fetchRules();
    fetchProxies();
};
const upgradingType = ref('auto');
const modalValue = defineModel();
const isCoreUpgrading = ref(false);
const handlerClickUpgradeCore = async (type) => {
    if (isCoreUpgrading.value)
        return;
    upgradingType.value = type;
    isCoreUpgrading.value = true;
    try {
        await upgradeCoreAPI(type);
        reloadAll();
        modalValue.value = false;
        handlerUpgradeSuccess();
        isCoreUpgrading.value = false;
    }
    catch (e) {
        console.error(e);
        isCoreUpgrading.value = false;
    }
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
const __VLS_0 = DialogWrapper || DialogWrapper;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    modelValue: (__VLS_ctx.modalValue),
    title: (__VLS_ctx.$t('upgradeCore')),
}));
const __VLS_2 = __VLS_1({
    modelValue: (__VLS_ctx.modalValue),
    title: (__VLS_ctx.$t('upgradeCore')),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
var __VLS_5 = {};
const { default: __VLS_6 } = __VLS_3.slots;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-col gap-2 p-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.handlerClickUpgradeCore('auto');
            // @ts-ignore
            [modalValue, $t, handlerClickUpgradeCore,];
        } },
    ...{ class: "btn btn-primary" },
    disabled: (__VLS_ctx.isCoreUpgrading && __VLS_ctx.upgradingType !== 'auto'),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
if (__VLS_ctx.isCoreUpgrading && __VLS_ctx.upgradingType === 'auto') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "loading loading-spinner loading-md" },
    });
    /** @type {__VLS_StyleScopedClasses['loading']} */ ;
    /** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
    /** @type {__VLS_StyleScopedClasses['loading-md']} */ ;
}
(__VLS_ctx.$t('upgradeCore'));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.handlerClickUpgradeCore('release');
            // @ts-ignore
            [$t, handlerClickUpgradeCore, isCoreUpgrading, isCoreUpgrading, upgradingType, upgradingType,];
        } },
    ...{ class: "btn" },
    disabled: (__VLS_ctx.isCoreUpgrading && __VLS_ctx.upgradingType !== 'release'),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
if (__VLS_ctx.isCoreUpgrading && __VLS_ctx.upgradingType === 'release') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "loading loading-spinner loading-md" },
    });
    /** @type {__VLS_StyleScopedClasses['loading']} */ ;
    /** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
    /** @type {__VLS_StyleScopedClasses['loading-md']} */ ;
}
(__VLS_ctx.$t('upgradeToRelease'));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.handlerClickUpgradeCore('alpha');
            // @ts-ignore
            [$t, handlerClickUpgradeCore, isCoreUpgrading, isCoreUpgrading, upgradingType, upgradingType,];
        } },
    ...{ class: "btn" },
    disabled: (__VLS_ctx.isCoreUpgrading && __VLS_ctx.upgradingType !== 'alpha'),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
if (__VLS_ctx.isCoreUpgrading && __VLS_ctx.upgradingType === 'alpha') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "loading loading-spinner loading-md" },
    });
    /** @type {__VLS_StyleScopedClasses['loading']} */ ;
    /** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
    /** @type {__VLS_StyleScopedClasses['loading-md']} */ ;
}
(__VLS_ctx.$t('upgradeToAlpha'));
// @ts-ignore
[$t, isCoreUpgrading, isCoreUpgrading, upgradingType, upgradingType,];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
