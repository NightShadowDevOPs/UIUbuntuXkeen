/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { prettyBytesHelper } from '@/helper/utils';
import { activeConnections, closedConnections } from '@/store/connections';
import { computed } from 'vue';
const allConnections = computed(() => {
    return activeConnections.value.concat(closedConnections.value);
});
const usageMap = computed(() => {
    const hostMap = {};
    const proxyMap = {};
    const sourceIPMap = {};
    const addConnectionToHostMap = (connection) => {
        const hostkey = (connection.metadata.host || connection.metadata.sniffHost)
            ?.split('.')
            .slice(-2)
            .join('.');
        const key = hostkey || connection.metadata.destinationIP;
        if (key in hostMap) {
            hostMap[key].download += connection.download;
            hostMap[key].upload += connection.upload;
        }
        else {
            hostMap[key] = {
                key,
                download: connection.download,
                upload: connection.upload,
            };
        }
    };
    const addConnectionToProxyMap = (connection) => {
        const key = connection.chains[0];
        if (key in proxyMap) {
            proxyMap[key].download += connection.download;
            proxyMap[key].upload += connection.upload;
        }
        else {
            proxyMap[key] = {
                key,
                download: connection.download,
                upload: connection.upload,
            };
        }
    };
    const addConnectionToSourceIPMap = (connection) => {
        const key = connection.metadata.sourceIP;
        if (key in sourceIPMap) {
            sourceIPMap[key].download += connection.download;
            sourceIPMap[key].upload += connection.upload;
        }
        else {
            sourceIPMap[key] = {
                key,
                download: connection.download,
                upload: connection.upload,
            };
        }
    };
    allConnections.value.forEach((connection) => {
        addConnectionToHostMap(connection);
        addConnectionToProxyMap(connection);
        addConnectionToSourceIPMap(connection);
    });
    return {
        hostMap,
        proxyMap,
        sourceIPMap,
    };
});
const mostDownloadHost = computed(() => {
    const conn = Object.entries(usageMap.value.hostMap).sort((a, b) => b[1].download - a[1].download)?.[0];
    if (!conn) {
        return {
            host: '',
            download: 0,
        };
    }
    return {
        host: conn[0],
        download: prettyBytesHelper(conn[1].download),
    };
});
const mostUploadHost = computed(() => {
    const conn = Object.entries(usageMap.value.hostMap).sort((a, b) => b[1].upload - a[1].upload)?.[0];
    if (!conn) {
        return {
            host: '',
            upload: 0,
        };
    }
    return {
        host: conn[0],
        upload: prettyBytesHelper(conn[1].upload),
    };
});
const mostDownloadSourceIP = computed(() => {
    const conn = Object.entries(usageMap.value.sourceIPMap).sort((a, b) => b[1].download - a[1].download)?.[0];
    if (!conn) {
        return {
            sourceIP: '',
            download: 0,
        };
    }
    return {
        sourceIP: conn[0],
        download: prettyBytesHelper(conn[1].download),
    };
});
const mostUploadSourceIP = computed(() => {
    const conn = Object.entries(usageMap.value.sourceIPMap).sort((a, b) => b[1].upload - a[1].upload)?.[0];
    if (!conn) {
        return {
            sourceIP: '',
            upload: 0,
        };
    }
    return {
        sourceIP: conn[0],
        upload: prettyBytesHelper(conn[1].upload),
    };
});
const mostDownloadProxy = computed(() => {
    const conn = Object.entries(usageMap.value.proxyMap).sort((a, b) => b[1].download - a[1].download)?.[0];
    if (!conn) {
        return {
            proxy: '',
            download: 0,
        };
    }
    return {
        proxy: conn[0],
        download: prettyBytesHelper(conn[1].download),
    };
});
const mostUploadProxy = computed(() => {
    const conn = Object.entries(usageMap.value.proxyMap).sort((a, b) => b[1].upload - a[1].upload)?.[0];
    if (!conn) {
        return {
            proxy: '',
            upload: 0,
        };
    }
    return {
        proxy: conn[0],
        upload: prettyBytesHelper(conn[1].upload),
    };
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card w-full" },
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card-title px-4 pt-4" },
});
/** @type {__VLS_StyleScopedClasses['card-title']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-4']} */ ;
(__VLS_ctx.$t('totalConnections'));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "text-base-content/80 font-normal" },
});
/** @type {__VLS_StyleScopedClasses['text-base-content/80']} */ ;
/** @type {__VLS_StyleScopedClasses['font-normal']} */ ;
(__VLS_ctx.allConnections.length);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card-body gap-4" },
});
/** @type {__VLS_StyleScopedClasses['card-body']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "bg-base-200/50 grid grid-cols-1 gap-2 rounded-lg px-4 py-2 lg:grid-cols-3" },
});
/** @type {__VLS_StyleScopedClasses['bg-base-200/50']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:grid-cols-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex h-14 flex-col items-start justify-center gap-1" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['h-14']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-sm" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
(__VLS_ctx.$t('mostDownloadHost'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-base" },
});
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
(__VLS_ctx.mostDownloadHost.host);
(__VLS_ctx.mostDownloadHost.download);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex h-14 flex-col items-start justify-center gap-1" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['h-14']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-sm" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
(__VLS_ctx.$t('mostDownloadSourceIP'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-base" },
});
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
(__VLS_ctx.mostDownloadSourceIP.sourceIP);
(__VLS_ctx.mostDownloadSourceIP.download);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex h-14 flex-col items-start justify-center gap-1" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['h-14']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-sm" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
(__VLS_ctx.$t('mostDownloadProxy'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-base" },
});
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
(__VLS_ctx.mostDownloadProxy.proxy);
(__VLS_ctx.mostDownloadProxy.download);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex h-14 flex-col items-start justify-center gap-1" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['h-14']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-sm" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
(__VLS_ctx.$t('mostUploadHost'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-base" },
});
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
(__VLS_ctx.mostUploadHost.host);
(__VLS_ctx.mostUploadHost.upload);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex h-14 flex-col items-start justify-center gap-1" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['h-14']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-sm" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
(__VLS_ctx.$t('mostUploadSourceIP'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-base" },
});
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
(__VLS_ctx.mostUploadSourceIP.sourceIP);
(__VLS_ctx.mostUploadSourceIP.upload);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex h-14 flex-col items-start justify-center gap-1" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['h-14']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-sm" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
(__VLS_ctx.$t('mostUploadProxy'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-base" },
});
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
(__VLS_ctx.mostUploadProxy.proxy);
(__VLS_ctx.mostUploadProxy.upload);
// @ts-ignore
[$t, $t, $t, $t, $t, $t, $t, allConnections, mostDownloadHost, mostDownloadHost, mostDownloadSourceIP, mostDownloadSourceIP, mostDownloadProxy, mostDownloadProxy, mostUploadHost, mostUploadHost, mostUploadSourceIP, mostUploadSourceIP, mostUploadProxy, mostUploadProxy,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
