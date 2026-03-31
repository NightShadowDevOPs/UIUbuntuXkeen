/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { disconnectByIdAPI } from '@/api';
import { useConnections } from '@/composables/connections';
import { CONNECTION_TAB_TYPE, CONNECTIONS_TABLE_ACCESSOR_KEY, PROXY_CHAIN_DIRECTION, TABLE_SIZE, TABLE_WIDTH_MODE, } from '@/constant';
import { getDestinationFromConnection, getDestinationTypeFromConnection, getHostFromConnection, getInboundUserFromConnection, getNetworkTypeFromConnection, getProcessFromConnection, } from '@/helper';
import { showNotification } from '@/helper/notification';
import { getIPLabelFromMap } from '@/helper/sourceip';
import { fromNow, prettyBytesHelper } from '@/helper/utils';
import { connectionTabShow, renderConnections } from '@/store/connections';
import { connectionTableColumns, proxyChainDirection, tableSize, tableWidthMode, } from '@/store/settings';
import { ArrowDownCircleIcon, ArrowRightCircleIcon, ArrowUpCircleIcon, MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon, MapPinIcon, XMarkIcon, } from '@heroicons/vue/24/outline';
import { FlexRender, getCoreRowModel, getExpandedRowModel, getGroupedRowModel, getSortedRowModel, isFunction, useVueTable, } from '@tanstack/vue-table';
import { useVirtualizer } from '@tanstack/vue-virtual';
import { useStorage } from '@vueuse/core';
import dayjs from 'dayjs';
import { twMerge } from 'tailwind-merge';
import { computed, h, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import ProxyName from '../proxies/ProxyName.vue';
import SourceIPStats from './SourceIPStats.vue';
const { handlerInfo } = useConnections();
const columnWidthMap = useStorage('config/table-column-width', {
    [CONNECTIONS_TABLE_ACCESSOR_KEY.Close]: 50,
    [CONNECTIONS_TABLE_ACCESSOR_KEY.Host]: 320,
    [CONNECTIONS_TABLE_ACCESSOR_KEY.Chains]: 320,
    [CONNECTIONS_TABLE_ACCESSOR_KEY.Rule]: 200,
    [CONNECTIONS_TABLE_ACCESSOR_KEY.Download]: 80,
    [CONNECTIONS_TABLE_ACCESSOR_KEY.DlSpeed]: 80,
    [CONNECTIONS_TABLE_ACCESSOR_KEY.Upload]: 80,
    [CONNECTIONS_TABLE_ACCESSOR_KEY.UlSpeed]: 80,
    [CONNECTIONS_TABLE_ACCESSOR_KEY.Outbound]: 80,
    [CONNECTIONS_TABLE_ACCESSOR_KEY.Type]: 150,
    [CONNECTIONS_TABLE_ACCESSOR_KEY.Process]: 150,
    [CONNECTIONS_TABLE_ACCESSOR_KEY.SourceIP]: 150,
    [CONNECTIONS_TABLE_ACCESSOR_KEY.SourcePort]: 100,
    [CONNECTIONS_TABLE_ACCESSOR_KEY.SniffHost]: 200,
    [CONNECTIONS_TABLE_ACCESSOR_KEY.Destination]: 150,
    [CONNECTIONS_TABLE_ACCESSOR_KEY.ConnectTime]: 100,
});
const isManualTable = computed(() => tableWidthMode.value === TABLE_WIDTH_MODE.MANUAL);
const { t } = useI18n();
const columns = [
    {
        header: () => t(CONNECTIONS_TABLE_ACCESSOR_KEY.Close),
        enableSorting: false,
        id: CONNECTIONS_TABLE_ACCESSOR_KEY.Close,
        cell: ({ row }) => {
            return h('button', {
                class: 'btn btn-xs btn-circle',
                onClick: (e) => {
                    const connection = row.original;
                    e.stopPropagation();
                    disconnectByIdAPI(connection.id);
                },
            }, [
                h(XMarkIcon, {
                    class: 'h-4 w-4',
                }),
            ]);
        },
    },
    {
        header: () => t(CONNECTIONS_TABLE_ACCESSOR_KEY.Type),
        id: CONNECTIONS_TABLE_ACCESSOR_KEY.Type,
        accessorFn: getNetworkTypeFromConnection,
    },
    {
        header: () => t(CONNECTIONS_TABLE_ACCESSOR_KEY.Process),
        id: CONNECTIONS_TABLE_ACCESSOR_KEY.Process,
        accessorFn: getProcessFromConnection,
    },
    {
        header: () => t(CONNECTIONS_TABLE_ACCESSOR_KEY.Host),
        id: CONNECTIONS_TABLE_ACCESSOR_KEY.Host,
        accessorFn: getHostFromConnection,
    },
    {
        header: () => t(CONNECTIONS_TABLE_ACCESSOR_KEY.SniffHost),
        id: CONNECTIONS_TABLE_ACCESSOR_KEY.SniffHost,
        accessorFn: (original) => original.metadata.sniffHost || '-',
    },
    {
        header: () => t(CONNECTIONS_TABLE_ACCESSOR_KEY.Rule),
        id: CONNECTIONS_TABLE_ACCESSOR_KEY.Rule,
        accessorFn: (original) => !original.rulePayload ? original.rule : `${original.rule}: ${original.rulePayload}`,
    },
    {
        header: () => t(CONNECTIONS_TABLE_ACCESSOR_KEY.Chains),
        id: CONNECTIONS_TABLE_ACCESSOR_KEY.Chains,
        accessorFn: (original) => {
            const chains = [...original.chains];
            return proxyChainDirection.value === PROXY_CHAIN_DIRECTION.REVERSE
                ? chains.join(' → ')
                : chains.reverse().join(' → ');
        },
        cell: ({ row }) => {
            const chains = [];
            const originChains = row.original.chains;
            originChains.forEach((chain, index) => {
                chains.unshift(h(ProxyName, { name: chain, key: chain }));
                if (index < originChains.length - 1) {
                    chains.unshift(h(ArrowRightCircleIcon, {
                        class: 'h-4 w-4 shrink-0',
                        key: `arrow-${index}`,
                    }));
                }
            });
            return h('div', {
                class: `flex items-center ${proxyChainDirection.value === PROXY_CHAIN_DIRECTION.REVERSE && 'flex-row-reverse justify-end'} gap-1`,
            }, chains);
        },
    },
    {
        header: () => t(CONNECTIONS_TABLE_ACCESSOR_KEY.Outbound),
        id: CONNECTIONS_TABLE_ACCESSOR_KEY.Outbound,
        accessorFn: (original) => original.chains[0],
        cell: ({ row }) => {
            return h(ProxyName, { name: row.original.chains[0] });
        },
    },
    {
        header: () => t(CONNECTIONS_TABLE_ACCESSOR_KEY.ConnectTime),
        enableGrouping: false,
        id: CONNECTIONS_TABLE_ACCESSOR_KEY.ConnectTime,
        accessorFn: (original) => fromNow(original.start),
        sortingFn: (prev, next) => dayjs(next.original.start).valueOf() - dayjs(prev.original.start).valueOf(),
    },
    {
        header: () => t(CONNECTIONS_TABLE_ACCESSOR_KEY.DlSpeed),
        enableGrouping: false,
        sortDescFirst: true,
        id: CONNECTIONS_TABLE_ACCESSOR_KEY.DlSpeed,
        accessorFn: (original) => `${prettyBytesHelper(original.downloadSpeed)}/s`,
        sortingFn: (prev, next) => prev.original.downloadSpeed - next.original.downloadSpeed,
    },
    {
        header: () => t(CONNECTIONS_TABLE_ACCESSOR_KEY.UlSpeed),
        enableGrouping: false,
        sortDescFirst: true,
        id: CONNECTIONS_TABLE_ACCESSOR_KEY.UlSpeed,
        accessorFn: (original) => `${prettyBytesHelper(original.uploadSpeed)}/s`,
        sortingFn: (prev, next) => prev.original.uploadSpeed - next.original.uploadSpeed,
    },
    {
        header: () => t(CONNECTIONS_TABLE_ACCESSOR_KEY.Download),
        enableGrouping: false,
        sortDescFirst: true,
        id: CONNECTIONS_TABLE_ACCESSOR_KEY.Download,
        accessorFn: (original) => prettyBytesHelper(original.download),
        sortingFn: (prev, next) => prev.original.download - next.original.download,
    },
    {
        header: () => t(CONNECTIONS_TABLE_ACCESSOR_KEY.Upload),
        enableGrouping: false,
        sortDescFirst: true,
        id: CONNECTIONS_TABLE_ACCESSOR_KEY.Upload,
        accessorFn: (original) => prettyBytesHelper(original.upload),
        sortingFn: (prev, next) => prev.original.upload - next.original.upload,
    },
    {
        header: () => t(CONNECTIONS_TABLE_ACCESSOR_KEY.SourceIP),
        id: CONNECTIONS_TABLE_ACCESSOR_KEY.SourceIP,
        accessorFn: (original) => {
            return getIPLabelFromMap(original.metadata.sourceIP);
        },
    },
    {
        header: () => t(CONNECTIONS_TABLE_ACCESSOR_KEY.SourcePort),
        id: CONNECTIONS_TABLE_ACCESSOR_KEY.SourcePort,
        accessorFn: (original) => original.metadata.sourcePort,
    },
    {
        header: () => t(CONNECTIONS_TABLE_ACCESSOR_KEY.Destination),
        id: CONNECTIONS_TABLE_ACCESSOR_KEY.Destination,
        accessorFn: getDestinationFromConnection,
    },
    {
        header: () => t(CONNECTIONS_TABLE_ACCESSOR_KEY.DestinationType),
        id: CONNECTIONS_TABLE_ACCESSOR_KEY.DestinationType,
        accessorFn: getDestinationTypeFromConnection,
    },
    {
        header: () => t(CONNECTIONS_TABLE_ACCESSOR_KEY.RemoteAddress),
        id: CONNECTIONS_TABLE_ACCESSOR_KEY.RemoteAddress,
        accessorFn: (original) => original.metadata.remoteDestination || '-',
    },
    {
        header: () => t(CONNECTIONS_TABLE_ACCESSOR_KEY.InboundUser),
        id: CONNECTIONS_TABLE_ACCESSOR_KEY.InboundUser,
        accessorFn: getInboundUserFromConnection,
    },
];
const grouping = ref([]);
const expanded = ref({});
const sorting = useStorage('config/table-sorting', []);
const columnPinning = useStorage('config/table-column-pinning', {
    left: [],
    right: [],
});
const tanstackTable = useVueTable({
    get data() {
        return renderConnections.value;
    },
    columns,
    columnResizeMode: 'onChange',
    columnResizeDirection: 'ltr',
    state: {
        get columnOrder() {
            return connectionTableColumns.value;
        },
        get columnVisibility() {
            return {
                ...Object.fromEntries(Object.values(CONNECTIONS_TABLE_ACCESSOR_KEY).map((key) => [key, false])),
                ...Object.fromEntries(connectionTableColumns.value
                    .filter((key) => key !== CONNECTIONS_TABLE_ACCESSOR_KEY.Close ||
                    connectionTabShow.value !== CONNECTION_TAB_TYPE.CLOSED)
                    .map((key) => [key, true])),
            };
        },
        get grouping() {
            return grouping.value;
        },
        get expanded() {
            return expanded.value;
        },
        get sorting() {
            return sorting.value;
        },
        get columnSizing() {
            return columnWidthMap.value;
        },
        get columnPinning() {
            return columnPinning.value;
        },
    },
    onGroupingChange: (updater) => {
        if (isFunction(updater)) {
            grouping.value = updater(grouping.value);
        }
        else {
            grouping.value = updater;
        }
    },
    onExpandedChange: (updater) => {
        if (isFunction(updater)) {
            expanded.value = updater(expanded.value);
        }
    },
    onSortingChange: (updater) => {
        if (isFunction(updater)) {
            sorting.value = updater(sorting.value);
        }
        else {
            sorting.value = updater;
        }
    },
    onColumnSizingChange: (updater) => {
        if (isFunction(updater)) {
            columnWidthMap.value = updater(columnWidthMap.value);
        }
        else {
            columnWidthMap.value = updater;
        }
    },
    onColumnPinningChange: (updater) => {
        if (isFunction(updater)) {
            columnPinning.value = updater(columnPinning.value);
        }
        else {
            columnPinning.value = updater;
        }
    },
    getSortedRowModel: getSortedRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getCoreRowModel: getCoreRowModel(),
});
const rows = computed(() => {
    return tanstackTable.getRowModel().rows;
});
const parentRef = ref(null);
const rowVirtualizerOptions = computed(() => {
    return {
        count: rows.value.length,
        getScrollElement: () => parentRef.value,
        estimateSize: () => 36,
        overscan: 24,
    };
});
const rowVirtualizer = useVirtualizer(rowVirtualizerOptions);
const virtualRows = computed(() => rowVirtualizer.value.getVirtualItems());
const totalSize = computed(() => rowVirtualizer.value.getTotalSize() + 24);
const classMap = {
    [TABLE_SIZE.SMALL]: 'table-xs',
    [TABLE_SIZE.LARGE]: 'table-sm',
};
const sizeOfTable = computed(() => {
    return classMap[tableSize.value];
});
const handlerClickRow = (row) => {
    if (isDragging.value)
        return;
    if (row.getIsGrouped()) {
        if (row.getCanExpand()) {
            row.getToggleExpandedHandler()();
        }
    }
    else {
        handlerInfo(row.original);
    }
};
const handlePinColumn = (column) => {
    if (column.getIsPinned() === 'left') {
        column.pin(false);
    }
    else {
        const currentPinning = columnPinning.value.left || [];
        currentPinning.forEach((pinnedColumnId) => {
            if (pinnedColumnId !== column.id) {
                const pinnedColumn = tanstackTable.getColumn(pinnedColumnId);
                if (pinnedColumn) {
                    pinnedColumn.pin(false);
                }
            }
        });
        column.pin('left');
    }
};
const isDragging = ref(false);
const isMouseDown = ref(false);
const DRAG_THRESHOLD = Math.pow(3, 2);
const handleMouseDown = (e) => {
    if (e.button !== 0)
        return; // 只处理左键
    isMouseDown.value = true;
    e.preventDefault();
};
const handleMouseMove = (e) => {
    if (!isMouseDown.value || !parentRef.value)
        return;
    const deltaX = e.movementX;
    const deltaY = e.movementY;
    // 检查是否超过拖动阈值
    if (!isDragging.value && Math.pow(deltaX, 2) + Math.pow(deltaY, 2) > DRAG_THRESHOLD) {
        isDragging.value = true;
    }
    if (isDragging.value) {
        parentRef.value.scrollLeft -= deltaX;
        parentRef.value.scrollTop -= deltaY;
        e.preventDefault();
    }
};
const handleMouseUp = () => {
    // 延迟重置拖动状态，以防止在拖动结束后立即触发点击事件
    if (isDragging.value) {
        setTimeout(() => {
            isDragging.value = false;
        }, 100);
    }
    isMouseDown.value = false;
};
// 复制功能
const copyToClipboard = async (text) => {
    try {
        await navigator.clipboard.writeText(text);
        showNotification({
            content: 'copySuccess',
            type: 'alert-success',
            timeout: 2000,
        });
    }
    catch {
        // 降级处理
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            showNotification({
                content: 'copySuccess',
                type: 'alert-success',
                timeout: 2000,
            });
        }
        catch (error) {
            console.error('复制失败:', error);
        }
        document.body.removeChild(textArea);
    }
};
const handleCellRightClick = (event, cell) => {
    event.preventDefault();
    const cellValue = cell.getValue();
    if (cellValue && cellValue !== '-') {
        copyToClipboard(String(cellValue));
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
    ...{ onTouchstart: () => { } },
    ...{ onTouchmove: () => { } },
    ...{ onTouchend: () => { } },
    ...{ onMousedown: (__VLS_ctx.handleMouseDown) },
    ...{ onMousemove: (__VLS_ctx.handleMouseMove) },
    ...{ onMouseup: (__VLS_ctx.handleMouseUp) },
    ...{ onMouseleave: (__VLS_ctx.handleMouseUp) },
    ref: "parentRef",
    ...{ class: "h-full overflow-auto p-2" },
    ...{ class: ({
            'select-none': __VLS_ctx.isDragging,
        }) },
});
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['select-none']} */ ;
const __VLS_0 = SourceIPStats;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    ...{ class: "mb-2" },
}));
const __VLS_2 = __VLS_1({
    ...{ class: "mb-2" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ style: ({ height: `${__VLS_ctx.totalSize}px` }) },
});
__VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
    ...{ class: ([
            'table-zebra table rounded-none shadow-md',
            __VLS_ctx.sizeOfTable,
            __VLS_ctx.isManualTable && 'table-fixed',
        ]) },
    ...{ style: (__VLS_ctx.isManualTable && {
            width: `${__VLS_ctx.tanstackTable.getCenterTotalSize()}px`,
        }) },
});
/** @type {__VLS_StyleScopedClasses['table-zebra']} */ ;
/** @type {__VLS_StyleScopedClasses['table']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-none']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-md']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({
    ...{ class: "bg-base-100 sticky -top-2 z-10" },
});
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['sticky']} */ ;
/** @type {__VLS_StyleScopedClasses['-top-2']} */ ;
/** @type {__VLS_StyleScopedClasses['z-10']} */ ;
for (const [headerGroup] of __VLS_vFor((__VLS_ctx.tanstackTable.getHeaderGroups()))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
        key: (headerGroup.id),
    });
    for (const [header] of __VLS_vFor((headerGroup.headers))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
            ...{ onClick: (...[$event]) => {
                    header.column.getToggleSortingHandler()?.($event);
                    // @ts-ignore
                    [handleMouseDown, handleMouseMove, handleMouseUp, handleMouseUp, isDragging, totalSize, sizeOfTable, isManualTable, isManualTable, tanstackTable, tanstackTable,];
                } },
            key: (header.id),
            colSpan: (header.colSpan),
            ...{ class: "relative" },
            ...{ class: ([
                    header.column.getCanSort() ? 'cursor-pointer select-none' : '',
                    header.column.getIsPinned && header.column.getIsPinned() === 'left'
                        ? 'pinned-td bg-base-100 sticky -left-2 z-20'
                        : '',
                ]) },
            ...{ style: (__VLS_ctx.isManualTable && {
                    width: `${header.getSize()}px`,
                }) },
        });
        /** @type {__VLS_StyleScopedClasses['relative']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex items-center gap-1" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
        if (!header.isPlaceholder) {
            let __VLS_5;
            /** @ts-ignore @type {typeof __VLS_components.FlexRender | typeof __VLS_components.FlexRender} */
            FlexRender;
            // @ts-ignore
            const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
                render: (header.column.columnDef.header),
                props: (header.getContext()),
            }));
            const __VLS_7 = __VLS_6({
                render: (header.column.columnDef.header),
                props: (header.getContext()),
            }, ...__VLS_functionalComponentArgsRest(__VLS_6));
        }
        if (header.column.getIsSorted() === 'asc') {
            let __VLS_10;
            /** @ts-ignore @type {typeof __VLS_components.ArrowUpCircleIcon} */
            ArrowUpCircleIcon;
            // @ts-ignore
            const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
                ...{ class: "h-4 w-4" },
            }));
            const __VLS_12 = __VLS_11({
                ...{ class: "h-4 w-4" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_11));
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        }
        if (header.column.getIsSorted() === 'desc') {
            let __VLS_15;
            /** @ts-ignore @type {typeof __VLS_components.ArrowDownCircleIcon} */
            ArrowDownCircleIcon;
            // @ts-ignore
            const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({
                ...{ class: "h-4 w-4" },
            }));
            const __VLS_17 = __VLS_16({
                ...{ class: "h-4 w-4" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_16));
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        if (header.column.getCanGroup()) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (() => header.column.getToggleGroupingHandler()()) },
                ...{ class: "btn btn-xs btn-circle btn-ghost" },
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
            if (header.column.getIsGrouped()) {
                let __VLS_20;
                /** @ts-ignore @type {typeof __VLS_components.MagnifyingGlassMinusIcon} */
                MagnifyingGlassMinusIcon;
                // @ts-ignore
                const __VLS_21 = __VLS_asFunctionalComponent1(__VLS_20, new __VLS_20({
                    ...{ class: "h-4 w-4" },
                }));
                const __VLS_22 = __VLS_21({
                    ...{ class: "h-4 w-4" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_21));
                /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
            }
            else {
                let __VLS_25;
                /** @ts-ignore @type {typeof __VLS_components.MagnifyingGlassPlusIcon} */
                MagnifyingGlassPlusIcon;
                // @ts-ignore
                const __VLS_26 = __VLS_asFunctionalComponent1(__VLS_25, new __VLS_25({
                    ...{ class: "h-4 w-4" },
                }));
                const __VLS_27 = __VLS_26({
                    ...{ class: "h-4 w-4" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_26));
                /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
            }
        }
        if (header.column.id === __VLS_ctx.CONNECTIONS_TABLE_ACCESSOR_KEY.Host ||
            header.column.id === __VLS_ctx.CONNECTIONS_TABLE_ACCESSOR_KEY.SniffHost) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (() => __VLS_ctx.handlePinColumn(header.column)) },
                ...{ class: "btn btn-xs btn-circle btn-ghost" },
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
            if (header.column.getIsPinned() !== 'left') {
                let __VLS_30;
                /** @ts-ignore @type {typeof __VLS_components.MapPinIcon} */
                MapPinIcon;
                // @ts-ignore
                const __VLS_31 = __VLS_asFunctionalComponent1(__VLS_30, new __VLS_30({
                    ...{ class: "h-4 w-4" },
                }));
                const __VLS_32 = __VLS_31({
                    ...{ class: "h-4 w-4" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_31));
                /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
            }
            else {
                let __VLS_35;
                /** @ts-ignore @type {typeof __VLS_components.XMarkIcon} */
                XMarkIcon;
                // @ts-ignore
                const __VLS_36 = __VLS_asFunctionalComponent1(__VLS_35, new __VLS_35({
                    ...{ class: "h-4 w-4" },
                }));
                const __VLS_37 = __VLS_36({
                    ...{ class: "h-4 w-4" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_36));
                /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
            }
        }
        if (__VLS_ctx.isManualTable) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
                ...{ onDblclick: (() => header.column.resetSize()) },
                ...{ onClick: () => { } },
                ...{ onMousedown: ((e) => header.getResizeHandler()(e)) },
                ...{ onTouchstart: ((e) => header.getResizeHandler()(e)) },
                ...{ class: "resizer bg-neutral absolute top-0 right-0 h-full w-1 cursor-ew-resize" },
            });
            /** @type {__VLS_StyleScopedClasses['resizer']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-neutral']} */ ;
            /** @type {__VLS_StyleScopedClasses['absolute']} */ ;
            /** @type {__VLS_StyleScopedClasses['top-0']} */ ;
            /** @type {__VLS_StyleScopedClasses['right-0']} */ ;
            /** @type {__VLS_StyleScopedClasses['h-full']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['cursor-ew-resize']} */ ;
        }
        // @ts-ignore
        [isManualTable, isManualTable, CONNECTIONS_TABLE_ACCESSOR_KEY, CONNECTIONS_TABLE_ACCESSOR_KEY, handlePinColumn,];
    }
    // @ts-ignore
    [];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
for (const [virtualRow, index] of __VLS_vFor((__VLS_ctx.virtualRows))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.handlerClickRow(__VLS_ctx.rows[virtualRow.index]);
                // @ts-ignore
                [virtualRows, handlerClickRow, rows,];
            } },
        key: (virtualRow.key.toString()),
        ...{ style: ({
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start - index * virtualRow.size}px)`,
            }) },
        ...{ class: "bg-base-100 hover:bg-primary! hover:text-primary-content" },
        ...{ class: ({
                'cursor-pointer': !__VLS_ctx.isDragging,
                'cursor-grabbing': __VLS_ctx.isDragging,
            }) },
    });
    /** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:bg-primary!']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:text-primary-content']} */ ;
    /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
    /** @type {__VLS_StyleScopedClasses['cursor-grabbing']} */ ;
    for (const [cell] of __VLS_vFor((__VLS_ctx.rows[virtualRow.index].getVisibleCells()))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ onContextmenu: (...[$event]) => {
                    __VLS_ctx.handleCellRightClick($event, cell);
                    // @ts-ignore
                    [isDragging, isDragging, rows, handleCellRightClick,];
                } },
            key: (cell.id),
            ...{ class: ([
                    __VLS_ctx.isManualTable
                        ? 'truncate text-sm'
                        : __VLS_ctx.twMerge('text-sm whitespace-nowrap', [
                            __VLS_ctx.CONNECTIONS_TABLE_ACCESSOR_KEY.Download,
                            __VLS_ctx.CONNECTIONS_TABLE_ACCESSOR_KEY.DlSpeed,
                            __VLS_ctx.CONNECTIONS_TABLE_ACCESSOR_KEY.Upload,
                            __VLS_ctx.CONNECTIONS_TABLE_ACCESSOR_KEY.UlSpeed,
                        ].includes(cell.column.id) && 'min-w-20', __VLS_ctx.CONNECTIONS_TABLE_ACCESSOR_KEY.Host ===
                            cell.column.id && 'max-w-xs truncate', [
                            __VLS_ctx.CONNECTIONS_TABLE_ACCESSOR_KEY.Chains,
                            __VLS_ctx.CONNECTIONS_TABLE_ACCESSOR_KEY.Rule,
                        ].includes(cell.column.id) &&
                            'max-w-xl truncate'),
                    cell.column.getIsPinned && cell.column.getIsPinned() === 'left'
                        ? 'pinned-td sticky -left-2 z-20 bg-inherit shadow-md'
                        : '',
                ]) },
        });
        if (cell.column.getIsGrouped()) {
            if (__VLS_ctx.rows[virtualRow.index].getCanExpand()) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "flex items-center" },
                });
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                if (__VLS_ctx.rows[virtualRow.index].getIsExpanded()) {
                    let __VLS_40;
                    /** @ts-ignore @type {typeof __VLS_components.MagnifyingGlassMinusIcon} */
                    MagnifyingGlassMinusIcon;
                    // @ts-ignore
                    const __VLS_41 = __VLS_asFunctionalComponent1(__VLS_40, new __VLS_40({
                        ...{ class: "mr-1 inline-block h-4 w-4" },
                    }));
                    const __VLS_42 = __VLS_41({
                        ...{ class: "mr-1 inline-block h-4 w-4" },
                    }, ...__VLS_functionalComponentArgsRest(__VLS_41));
                    /** @type {__VLS_StyleScopedClasses['mr-1']} */ ;
                    /** @type {__VLS_StyleScopedClasses['inline-block']} */ ;
                    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
                    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
                }
                else {
                    let __VLS_45;
                    /** @ts-ignore @type {typeof __VLS_components.MagnifyingGlassPlusIcon} */
                    MagnifyingGlassPlusIcon;
                    // @ts-ignore
                    const __VLS_46 = __VLS_asFunctionalComponent1(__VLS_45, new __VLS_45({
                        ...{ class: "mr-1 inline-block h-4 w-4" },
                    }));
                    const __VLS_47 = __VLS_46({
                        ...{ class: "mr-1 inline-block h-4 w-4" },
                    }, ...__VLS_functionalComponentArgsRest(__VLS_46));
                    /** @type {__VLS_StyleScopedClasses['mr-1']} */ ;
                    /** @type {__VLS_StyleScopedClasses['inline-block']} */ ;
                    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
                    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
                }
                let __VLS_50;
                /** @ts-ignore @type {typeof __VLS_components.FlexRender} */
                FlexRender;
                // @ts-ignore
                const __VLS_51 = __VLS_asFunctionalComponent1(__VLS_50, new __VLS_50({
                    render: (cell.column.columnDef.cell),
                    props: (cell.getContext()),
                }));
                const __VLS_52 = __VLS_51({
                    render: (cell.column.columnDef.cell),
                    props: (cell.getContext()),
                }, ...__VLS_functionalComponentArgsRest(__VLS_51));
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "ml-1" },
                });
                /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
                (__VLS_ctx.rows[virtualRow.index].subRows.length);
            }
        }
        else {
            let __VLS_55;
            /** @ts-ignore @type {typeof __VLS_components.FlexRender} */
            FlexRender;
            // @ts-ignore
            const __VLS_56 = __VLS_asFunctionalComponent1(__VLS_55, new __VLS_55({
                render: (cell.getIsAggregated()
                    ? cell.column.columnDef.aggregatedCell
                    : cell.column.columnDef.cell),
                props: (cell.getContext()),
            }));
            const __VLS_57 = __VLS_56({
                render: (cell.getIsAggregated()
                    ? cell.column.columnDef.aggregatedCell
                    : cell.column.columnDef.cell),
                props: (cell.getContext()),
            }, ...__VLS_functionalComponentArgsRest(__VLS_56));
        }
        // @ts-ignore
        [isManualTable, CONNECTIONS_TABLE_ACCESSOR_KEY, CONNECTIONS_TABLE_ACCESSOR_KEY, CONNECTIONS_TABLE_ACCESSOR_KEY, CONNECTIONS_TABLE_ACCESSOR_KEY, CONNECTIONS_TABLE_ACCESSOR_KEY, CONNECTIONS_TABLE_ACCESSOR_KEY, CONNECTIONS_TABLE_ACCESSOR_KEY, rows, rows, rows, twMerge,];
    }
    // @ts-ignore
    [];
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
