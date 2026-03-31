/// <reference types="../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import ConnectionCardList from '@/components/connections/ConnectionCardList.vue';
import ConnectionDetails from '@/components/connections/ConnectionDetails.vue';
import ConnectionTable from '@/components/connections/ConnectionTable.vue';
import TrafficClientsStateCard from '@/components/traffic/TrafficClientsStateCard.vue';
import TrafficRuntimeSummaryCard from '@/components/traffic/TrafficRuntimeSummaryCard.vue';
import UserTrafficStats from '@/components/users/UserTrafficStats.vue';
import { ROUTE_NAME, CONNECTION_TAB_TYPE } from '@/constant';
import { connectionTabShow } from '@/store/connections';
import { useConnectionCard } from '@/store/settings';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
const router = useRouter();
const activeTab = ref('clients');
const clientsStateCard = ref(null);
const setTab = (tab) => {
    activeTab.value = tab;
};
const goConnections = () => {
    router.push({ name: ROUTE_NAME.connections });
};
const trafficClientItems = computed(() => clientsStateCard.value?.rows?.value || []);
const trafficAgentLive = computed(() => !!clientsStateCard.value?.agentLive?.value);
const trafficLastAgentUpdateAt = computed(() => Number(clientsStateCard.value?.lastAgentUpdateAt?.value || 0));
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex h-full flex-col gap-3 overflow-x-hidden overflow-y-auto p-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-x-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card gap-3 p-3" },
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['xl:flex-row']} */ ;
/** @type {__VLS_StyleScopedClasses['xl:items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['xl:justify-between']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
(__VLS_ctx.$t('trafficWorkspaceTitle'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-sm opacity-70" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
(__VLS_ctx.$t('trafficWorkspaceTip'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.setTab('clients');
            // @ts-ignore
            [$t, $t, setTab,];
        } },
    type: "button",
    ...{ class: "btn btn-sm" },
    ...{ class: (__VLS_ctx.activeTab === 'clients' ? '' : 'btn-ghost') },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
(__VLS_ctx.$t('trafficClientStateTitle'));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.setTab('connections');
            // @ts-ignore
            [$t, setTab, activeTab,];
        } },
    type: "button",
    ...{ class: "btn btn-sm" },
    ...{ class: (__VLS_ctx.activeTab === 'connections' ? '' : 'btn-ghost') },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
(__VLS_ctx.$t('connections'));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.setTab('users');
            // @ts-ignore
            [$t, setTab, activeTab,];
        } },
    type: "button",
    ...{ class: "btn btn-sm" },
    ...{ class: (__VLS_ctx.activeTab === 'users' ? '' : 'btn-ghost') },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
(__VLS_ctx.$t('users'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-3 text-sm opacity-75" },
});
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-75']} */ ;
(__VLS_ctx.$t('trafficWorkspaceOperationalTip'));
const __VLS_0 = TrafficRuntimeSummaryCard;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    items: (__VLS_ctx.trafficClientItems),
    agentLive: (__VLS_ctx.trafficAgentLive),
    lastAgentUpdateAt: (__VLS_ctx.trafficLastAgentUpdateAt),
}));
const __VLS_2 = __VLS_1({
    items: (__VLS_ctx.trafficClientItems),
    agentLive: (__VLS_ctx.trafficAgentLive),
    lastAgentUpdateAt: (__VLS_ctx.trafficLastAgentUpdateAt),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "space-y-2" },
});
__VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.activeTab === 'clients') }, null, null);
/** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
const __VLS_5 = TrafficClientsStateCard;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
    ref: "clientsStateCard",
}));
const __VLS_7 = __VLS_6({
    ref: "clientsStateCard",
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
var __VLS_10 = {};
var __VLS_8;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card gap-2 p-3 text-sm opacity-70" },
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
(__VLS_ctx.$t('trafficWorkspaceHostOnlyTip'));
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "space-y-2" },
});
__VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.activeTab === 'connections') }, null, null);
/** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card gap-3 p-3" },
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-center justify-between gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
(__VLS_ctx.$t('connections'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-sm opacity-70" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
(__VLS_ctx.$t('mihomoRuntimeConnectionsTip'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.connectionTabShow = __VLS_ctx.CONNECTION_TAB_TYPE.ACTIVE;
            // @ts-ignore
            [$t, $t, $t, $t, $t, activeTab, activeTab, activeTab, trafficClientItems, trafficAgentLive, trafficLastAgentUpdateAt, connectionTabShow, CONNECTION_TAB_TYPE,];
        } },
    type: "button",
    ...{ class: "btn btn-sm" },
    ...{ class: (__VLS_ctx.connectionTabShow === __VLS_ctx.CONNECTION_TAB_TYPE.ACTIVE ? '' : 'btn-ghost') },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
(__VLS_ctx.$t('activeConnections'));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.connectionTabShow = __VLS_ctx.CONNECTION_TAB_TYPE.CLOSED;
            // @ts-ignore
            [$t, connectionTabShow, connectionTabShow, CONNECTION_TAB_TYPE, CONNECTION_TAB_TYPE,];
        } },
    type: "button",
    ...{ class: "btn btn-sm" },
    ...{ class: (__VLS_ctx.connectionTabShow === __VLS_ctx.CONNECTION_TAB_TYPE.CLOSED ? '' : 'btn-ghost') },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
(__VLS_ctx.$t('closedConnections'));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.goConnections) },
    type: "button",
    ...{ class: "btn btn-sm btn-ghost" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
(__VLS_ctx.$t('open'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-lg border border-base-content/10 bg-base-100/40" },
});
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100/40']} */ ;
if (__VLS_ctx.useConnectionCard) {
    const __VLS_12 = ConnectionCardList;
    // @ts-ignore
    const __VLS_13 = __VLS_asFunctionalComponent1(__VLS_12, new __VLS_12({
        ...{ class: "overflow-x-hidden p-2" },
    }));
    const __VLS_14 = __VLS_13({
        ...{ class: "overflow-x-hidden p-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_13));
    /** @type {__VLS_StyleScopedClasses['overflow-x-hidden']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
}
else {
    const __VLS_17 = ConnectionTable;
    // @ts-ignore
    const __VLS_18 = __VLS_asFunctionalComponent1(__VLS_17, new __VLS_17({}));
    const __VLS_19 = __VLS_18({}, ...__VLS_functionalComponentArgsRest(__VLS_18));
}
const __VLS_22 = ConnectionDetails;
// @ts-ignore
const __VLS_23 = __VLS_asFunctionalComponent1(__VLS_22, new __VLS_22({}));
const __VLS_24 = __VLS_23({}, ...__VLS_functionalComponentArgsRest(__VLS_23));
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "space-y-2" },
});
__VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.activeTab === 'users') }, null, null);
/** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card gap-2 p-3 text-sm opacity-70" },
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
(__VLS_ctx.$t('userTrafficTip'));
const __VLS_27 = UserTrafficStats;
// @ts-ignore
const __VLS_28 = __VLS_asFunctionalComponent1(__VLS_27, new __VLS_27({}));
const __VLS_29 = __VLS_28({}, ...__VLS_functionalComponentArgsRest(__VLS_28));
// @ts-ignore
var __VLS_11 = __VLS_10;
// @ts-ignore
[$t, $t, $t, activeTab, connectionTabShow, CONNECTION_TAB_TYPE, goConnections, useConnectionCard,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
