/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { useBounceOnVisible } from '@/composables/bouncein';
import { useRenderProxies } from '@/composables/renderProxies';
import { isHiddenGroup } from '@/helper';
import { SCROLLABLE_PARENT_CLASS } from '@/helper/utils';
import { hiddenGroupMap, proxyGroupLatencyTest, proxyMap } from '@/store/proxies';
import { blurIntensity, groupProxiesByProvider, manageHiddenGroup } from '@/store/settings';
import { EyeIcon, EyeSlashIcon } from '@heroicons/vue/24/outline';
import { twMerge } from 'tailwind-merge';
import { computed, nextTick, ref } from 'vue';
import LatencyTag from './LatencyTag.vue';
import ProxiesByProvider from './ProxiesByProvider.vue';
import ProxiesContent from './ProxiesContent.vue';
import ProxyGroupNow from './ProxyGroupNow.vue';
import ProxyIcon from './ProxyIcon.vue';
const props = defineProps();
const proxyGroup = computed(() => proxyMap.value[props.name]);
const allProxies = computed(() => proxyGroup.value.all ?? []);
const { proxiesCount, renderProxies } = useRenderProxies(allProxies, props.name);
const isLatencyTesting = ref(false);
const modalMode = ref(false);
const displayContent = ref(false);
const showAllContent = ref(modalMode.value);
const contentOpacity = ref(0);
const cardWrapperRef = ref();
const cardRef = ref();
const cardContentRef = ref();
const overflowY = ref(false);
const INIT_STYLE = {
    width: '100%',
    maxHeight: '100%',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
    transform: 'translate3d(0, 0, 0) scale(1)',
};
const cardStyle = ref({
    ...INIT_STYLE,
});
const calcCardStyle = () => {
    requestAnimationFrame(() => {
        if (!cardWrapperRef.value)
            return;
        if (!modalMode.value) {
            cardStyle.value = {
                ...cardStyle.value,
                width: '100%',
                maxHeight: '100%',
                transform: 'translate3d(0, 0, 0) scale(1)',
                zIndex: 50,
            };
            return;
        }
        const manyProxies = renderProxies.value.length > 4;
        const { left, top, bottom } = cardWrapperRef.value.getBoundingClientRect();
        const { innerHeight, innerWidth } = window;
        const minSafeArea = innerHeight * 0.15;
        const baseLine = innerHeight * 0.2;
        const maxSafeArea = innerHeight * 0.3;
        const isLeft = left < innerWidth / 3;
        const isTop = (top + bottom) * 0.5 < innerHeight * (manyProxies ? 0.7 : 0.5);
        const transformOrigin = isLeft
            ? isTop
                ? 'top left'
                : 'bottom left'
            : isTop
                ? 'top right'
                : 'bottom right';
        const positionKeyX = isLeft ? 'left' : 'right';
        const positionKeyY = isTop ? 'top' : 'bottom';
        let transformValueY = 0;
        let verticalOffset = 0;
        if (isTop) {
            if (top < minSafeArea || (top > maxSafeArea && manyProxies)) {
                transformValueY = baseLine - top;
            }
            verticalOffset = top + transformValueY;
        }
        else {
            const minSafeBottom = innerHeight - minSafeArea;
            const maxSafeBottom = innerHeight - maxSafeArea;
            const baseLineBottom = innerHeight - baseLine;
            if (bottom > minSafeBottom || (bottom < maxSafeBottom && manyProxies)) {
                transformValueY = baseLineBottom - bottom;
            }
            verticalOffset = innerHeight - bottom - transformValueY;
        }
        cardStyle.value = {
            width: 'calc(100vw - 1rem)',
            maxHeight: `${innerHeight - verticalOffset - 112}px`,
            transform: `translate3d(0, ${transformValueY}px, 0) scale(1)`,
            transformOrigin,
            zIndex: 50,
            [positionKeyY]: 0,
            [positionKeyX]: 0,
        };
    });
};
const handlerTransitionEnd = (e) => {
    if (e.propertyName !== 'width')
        return;
    if (modalMode.value) {
        contentOpacity.value = 1;
        showAllContent.value = true;
        nextTick(() => {
            if (!cardContentRef.value)
                return;
            overflowY.value = cardContentRef.value.scrollHeight > cardContentRef.value.clientHeight;
        });
    }
    else {
        displayContent.value = false;
        nextTick(() => {
            cardStyle.value = {
                ...INIT_STYLE,
            };
        });
    }
};
const handlerGroupClick = async () => {
    modalMode.value = !modalMode.value;
    if (modalMode.value) {
        displayContent.value = true;
    }
    showAllContent.value = false;
    contentOpacity.value = 0;
    calcCardStyle();
};
const handlerLatencyTest = async () => {
    if (isLatencyTesting.value)
        return;
    isLatencyTesting.value = true;
    try {
        await proxyGroupLatencyTest(props.name);
        isLatencyTesting.value = false;
    }
    catch {
        isLatencyTesting.value = false;
    }
};
const hiddenGroup = computed({
    get: () => isHiddenGroup(props.name),
    set: (value) => {
        hiddenGroupMap.value[props.name] = value;
    },
});
const handlerGroupToggle = () => {
    hiddenGroup.value = !hiddenGroup.value;
};
const preventDefault = (e) => {
    if (modalMode.value) {
        e.preventDefault();
    }
};
const preventDefaultForContent = (e) => {
    if (!overflowY.value) {
        e.preventDefault();
    }
};
useBounceOnVisible(cardRef);
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
    ...{ onClick: (__VLS_ctx.handlerGroupClick) },
    ...{ onTouchmove: (__VLS_ctx.preventDefault) },
    ...{ onWheel: (__VLS_ctx.preventDefault) },
    ...{ class: "relative h-22 cursor-pointer" },
    ref: "cardWrapperRef",
});
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['h-22']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
if (__VLS_ctx.modalMode) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
        ...{ class: "bg-base-300/50 fixed inset-0 z-40 overflow-hidden" },
    });
    /** @type {__VLS_StyleScopedClasses['bg-base-300/50']} */ ;
    /** @type {__VLS_StyleScopedClasses['fixed']} */ ;
    /** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['z-40']} */ ;
    /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ onContextmenu: (__VLS_ctx.handlerLatencyTest) },
    ...{ onTransitionend: (__VLS_ctx.handlerTransitionEnd) },
    ...{ class: "card absolute overflow-hidden transition-[width,transform,max-height] duration-200 ease-out will-change-transform" },
    ...{ class: (__VLS_ctx.modalMode && __VLS_ctx.blurIntensity < 5 && 'backdrop-blur-sm!') },
    ...{ style: (__VLS_ctx.cardStyle) },
    ref: "cardRef",
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-[width,transform,max-height]']} */ ;
/** @type {__VLS_StyleScopedClasses['duration-200']} */ ;
/** @type {__VLS_StyleScopedClasses['ease-out']} */ ;
/** @type {__VLS_StyleScopedClasses['will-change-transform']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "relative flex h-22 shrink-0 flex-col justify-between p-2" },
});
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['h-22']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-md truncate" },
    ...{ class: (__VLS_ctx.proxyGroup.icon && 'pr-10') },
});
/** @type {__VLS_StyleScopedClasses['text-md']} */ ;
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
(__VLS_ctx.proxyGroup.name);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-base-content/60 truncate text-xs" },
    ...{ class: (__VLS_ctx.proxyGroup.icon && 'pr-10') },
});
/** @type {__VLS_StyleScopedClasses['text-base-content/60']} */ ;
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
(__VLS_ctx.proxyGroup.type);
(__VLS_ctx.proxiesCount);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-1 items-center gap-1 truncate" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
if (__VLS_ctx.manageHiddenGroup) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.handlerGroupToggle) },
        ...{ class: "btn btn-circle btn-xs z-10" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['z-10']} */ ;
    if (!__VLS_ctx.hiddenGroup) {
        let __VLS_0;
        /** @ts-ignore @type {typeof __VLS_components.EyeIcon} */
        EyeIcon;
        // @ts-ignore
        const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
            ...{ class: "h-3 w-3" },
        }));
        const __VLS_2 = __VLS_1({
            ...{ class: "h-3 w-3" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_1));
        /** @type {__VLS_StyleScopedClasses['h-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-3']} */ ;
    }
    else {
        let __VLS_5;
        /** @ts-ignore @type {typeof __VLS_components.EyeSlashIcon} */
        EyeSlashIcon;
        // @ts-ignore
        const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
            ...{ class: "h-3 w-3" },
        }));
        const __VLS_7 = __VLS_6({
            ...{ class: "h-3 w-3" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_6));
        /** @type {__VLS_StyleScopedClasses['h-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-3']} */ ;
    }
}
const __VLS_10 = ProxyGroupNow;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
    name: (__VLS_ctx.proxyGroup.name),
    mobile: (true),
}));
const __VLS_12 = __VLS_11({
    name: (__VLS_ctx.proxyGroup.name),
    mobile: (true),
}, ...__VLS_functionalComponentArgsRest(__VLS_11));
const __VLS_15 = LatencyTag;
// @ts-ignore
const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({
    ...{ 'onClick': {} },
    ...{ class: (__VLS_ctx.twMerge('bg-base-200/50 hover:bg-base-200 z-10')) },
    loading: (__VLS_ctx.isLatencyTesting),
    name: (__VLS_ctx.proxyGroup.now),
    groupName: (__VLS_ctx.proxyGroup.name),
}));
const __VLS_17 = __VLS_16({
    ...{ 'onClick': {} },
    ...{ class: (__VLS_ctx.twMerge('bg-base-200/50 hover:bg-base-200 z-10')) },
    loading: (__VLS_ctx.isLatencyTesting),
    name: (__VLS_ctx.proxyGroup.now),
    groupName: (__VLS_ctx.proxyGroup.name),
}, ...__VLS_functionalComponentArgsRest(__VLS_16));
let __VLS_20;
const __VLS_21 = ({ click: {} },
    { onClick: (__VLS_ctx.handlerLatencyTest) });
var __VLS_18;
var __VLS_19;
if (__VLS_ctx.proxyGroup?.icon) {
    const __VLS_22 = ProxyIcon;
    // @ts-ignore
    const __VLS_23 = __VLS_asFunctionalComponent1(__VLS_22, new __VLS_22({
        icon: (__VLS_ctx.proxyGroup.icon),
        size: (40),
        margin: (0),
        ...{ class: "absolute top-2 right-2" },
    }));
    const __VLS_24 = __VLS_23({
        icon: (__VLS_ctx.proxyGroup.icon),
        size: (40),
        margin: (0),
        ...{ class: "absolute top-2 right-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_23));
    /** @type {__VLS_StyleScopedClasses['absolute']} */ ;
    /** @type {__VLS_StyleScopedClasses['top-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['right-2']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ onTouchmove: (__VLS_ctx.preventDefaultForContent) },
    ...{ onWheel: (__VLS_ctx.preventDefaultForContent) },
    ...{ class: "overflow-x-hidden overflow-y-auto overscroll-contain p-2 transition-opacity duration-200 ease-out" },
    ...{ class: ([__VLS_ctx.SCROLLABLE_PARENT_CLASS, 'will-change-opacity']) },
    ...{ style: ({
            width: 'calc(100vw - 1rem)',
            opacity: __VLS_ctx.contentOpacity,
            contain: 'layout style paint',
        }) },
    ref: "cardContentRef",
});
__VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.displayContent) }, null, null);
/** @type {__VLS_StyleScopedClasses['overflow-x-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['overscroll-contain']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-opacity']} */ ;
/** @type {__VLS_StyleScopedClasses['duration-200']} */ ;
/** @type {__VLS_StyleScopedClasses['ease-out']} */ ;
/** @type {__VLS_StyleScopedClasses['will-change-opacity']} */ ;
let __VLS_27;
/** @ts-ignore @type {typeof __VLS_components.Component} */
Component;
// @ts-ignore
const __VLS_28 = __VLS_asFunctionalComponent1(__VLS_27, new __VLS_27({
    is: (__VLS_ctx.groupProxiesByProvider ? ProxiesByProvider : ProxiesContent),
    name: (__VLS_ctx.name),
    now: (__VLS_ctx.proxyGroup.now),
    renderProxies: (__VLS_ctx.renderProxies),
    showFullContent: (__VLS_ctx.showAllContent),
}));
const __VLS_29 = __VLS_28({
    is: (__VLS_ctx.groupProxiesByProvider ? ProxiesByProvider : ProxiesContent),
    name: (__VLS_ctx.name),
    now: (__VLS_ctx.proxyGroup.now),
    renderProxies: (__VLS_ctx.renderProxies),
    showFullContent: (__VLS_ctx.showAllContent),
}, ...__VLS_functionalComponentArgsRest(__VLS_28));
// @ts-ignore
[handlerGroupClick, preventDefault, preventDefault, modalMode, modalMode, handlerLatencyTest, handlerLatencyTest, handlerTransitionEnd, blurIntensity, cardStyle, proxyGroup, proxyGroup, proxyGroup, proxyGroup, proxyGroup, proxyGroup, proxyGroup, proxyGroup, proxyGroup, proxyGroup, proxiesCount, manageHiddenGroup, handlerGroupToggle, hiddenGroup, twMerge, isLatencyTesting, preventDefaultForContent, preventDefaultForContent, SCROLLABLE_PARENT_CLASS, contentOpacity, displayContent, groupProxiesByProvider, name, renderProxies, showAllContent,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
