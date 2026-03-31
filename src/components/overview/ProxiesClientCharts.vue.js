/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { backgroundImage } from '@/helper/indexeddb';
import { prettyBytesHelper } from '@/helper/utils';
import { isSourceIpScopeVisible } from '@/helper/sourceip';
import { activeConnections } from '@/store/connections';
import { proxyProviederList } from '@/store/proxies';
import { blurIntensity, dashboardTransparent, font, proxiesRelationshipColorMode, proxiesRelationshipPaused, proxiesRelationshipRefreshNonce, proxiesRelationshipRefreshSec, proxiesRelationshipTopN, proxiesRelationshipTopNChain, proxiesRelationshipWeightMode, sourceIPLabelList, theme, } from '@/store/settings';
import { ArrowsPointingInIcon, ArrowsPointingOutIcon } from '@heroicons/vue/24/outline';
import { useElementSize } from '@vueuse/core';
import { SankeyChart } from 'echarts/charts';
import { TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { debounce } from 'lodash';
import { twMerge } from 'tailwind-merge';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
echarts.use([SankeyChart, TooltipComponent, CanvasRenderer]);
const { t } = useI18n();
const isFullScreen = ref(false);
const chart = ref();
const fullScreenChart = ref();
const colorRef = ref();
const fullChartStyle = computed(() => `backdrop-filter: blur(${blurIntensity.value}px);`);
const colorSet = { baseContent30: '', baseContent: '', base70: '' };
let fontFamily = '';
const updateColorSet = () => {
    const cs = getComputedStyle(colorRef.value);
    colorSet.baseContent = cs.getPropertyValue('--color-base-content').trim();
    colorSet.baseContent30 = cs.borderColor;
    colorSet.base70 = cs.backgroundColor;
};
const updateFontFamily = () => {
    fontFamily = getComputedStyle(colorRef.value).fontFamily;
};
const { width } = useElementSize(chart);
const labelFontSize = computed(() => {
    const w = Number(width.value) || 0;
    return isFullScreen.value ? 14 : w >= 1100 ? 13 : w >= 800 ? 12 : 11;
});
const labelForIp = (ip) => {
    const item = sourceIPLabelList.value.find((x) => {
        if (x.key !== ip)
            return false;
        return isSourceIpScopeVisible(x.scope);
    });
    return item?.label || '';
};
const normalize = (s) => (s || '').trim() || '-';
const shortLabel = (name) => {
    if (!name)
        return '';
    const max = isFullScreen.value ? 46 : 32;
    return name.length > max ? `${name.slice(0, max - 1)}…` : name;
};
const providerMap = computed(() => {
    const m = new Map();
    for (const p of proxyProviederList.value) {
        for (const proxy of p.proxies || []) {
            m.set(proxy.name, p.name);
        }
    }
    return m;
});
const providerOf = (name) => providerMap.value.get(name) || '';
const colorFromKey = (key) => {
    const s = key || 'unknown';
    let h = 0;
    for (let i = 0; i < s.length; i++)
        h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return `hsl(${h % 360} 70% 55%)`;
};
// ----- snapshot & pause -----
const snapshot = ref([]);
const deltaBytesById = ref({});
const prevTotalsById = new Map();
let lastSnapshotAt = Date.now();
let timer;
const refreshSnapshot = () => {
    const now = Date.now();
    const dt = Math.max(1, (now - lastSnapshotAt) / 1000);
    lastSnapshotAt = now;
    const conns = activeConnections.value.slice();
    const deltas = {};
    for (const c of conns) {
        const id = c.id || '';
        if (!id)
            continue;
        const total = (Number(c.download) || 0) + (Number(c.upload) || 0);
        const prev = prevTotalsById.get(id);
        let delta = prev === undefined ? 0 : Math.max(0, total - prev);
        // если дельта 0 (например, первое обновление) — оценим по скорости за интервал
        if (delta === 0) {
            const sp = (Number(c.downloadSpeed) || 0) + (Number(c.uploadSpeed) || 0);
            if (sp > 0)
                delta = sp * dt;
        }
        deltas[id] = delta;
        prevTotalsById.set(id, total);
    }
    // чистим старые id
    for (const id of Array.from(prevTotalsById.keys())) {
        if (!(id in deltas))
            prevTotalsById.delete(id);
    }
    deltaBytesById.value = deltas;
    snapshot.value = conns;
};
const stopTimer = () => {
    if (timer) {
        clearInterval(timer);
        timer = undefined;
    }
};
const startTimer = () => {
    stopTimer();
    const sec = Math.max(1, Number(proxiesRelationshipRefreshSec.value) || 5);
    timer = window.setInterval(() => {
        if (!proxiesRelationshipPaused.value)
            refreshSnapshot();
    }, sec * 1000);
};
watch(proxiesRelationshipPaused, (p) => {
    if (p)
        stopTimer();
    else {
        refreshSnapshot();
        startTimer();
    }
});
watch(proxiesRelationshipRefreshSec, () => {
    if (!proxiesRelationshipPaused.value)
        startTimer();
});
watch(proxiesRelationshipRefreshNonce, () => {
    refreshSnapshot();
});
const sankeyData = computed(() => {
    const conns = snapshot.value || [];
    const topClientsN = Math.max(10, Number(proxiesRelationshipTopN.value) || 40);
    const topChainN = Math.max(10, Number(proxiesRelationshipTopNChain.value) || 18);
    const bytes = (c) => {
        const id = c.id || '';
        return (id && deltaBytesById.value[id]) ? deltaBytesById.value[id] : 0;
    };
    const hasTraffic = conns.some((c) => bytes(c) > 0);
    const weight = (c) => {
        if (proxiesRelationshipWeightMode.value === 'count')
            return 1;
        if (!hasTraffic)
            return 1;
        // компрессия, чтобы крупные потоки не раздували диаграмму
        return Math.min(1 + Math.log1p(bytes(c) / 1024), 60);
    };
    const totals = new Map();
    const chain0Totals = new Map();
    const chain1Totals = new Map();
    for (const c of conns) {
        const ip = c.metadata?.sourceIP || '';
        if (!ip)
            continue;
        const v = weight(c);
        totals.set(ip, (totals.get(ip) || 0) + v);
        const c0 = normalize(c.chains?.[0] || 'DIRECT');
        chain0Totals.set(c0, (chain0Totals.get(c0) || 0) + v);
        const c1 = c.chains?.[1] ? normalize(c.chains[1]) : '';
        if (c1)
            chain1Totals.set(c1, (chain1Totals.get(c1) || 0) + v);
    }
    const top = new Set(Array.from(totals.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, topClientsN)
        .map(([k]) => k));
    const topChain0 = new Set(Array.from(chain0Totals.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, topChainN)
        .map(([k]) => k));
    const topChain1 = new Set(Array.from(chain1Totals.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, topChainN)
        .map(([k]) => k));
    const OTHER_CLIENT = 'other';
    const OTHER_C0 = 'other-out';
    const OTHER_C1 = 'other-node';
    const linkAgg = new Map();
    const nodeMeta = new Map();
    const addNodeMeta = (name, b, cnt) => {
        const cur = nodeMeta.get(name) || { bytes: 0, count: 0 };
        cur.bytes += b;
        cur.count += cnt;
        if (!cur.provider) {
            const p = providerOf(name);
            if (p)
                cur.provider = p;
        }
        nodeMeta.set(name, cur);
    };
    const voteColor = (agg, key, v) => {
        if (!key)
            return;
        agg.colorVotes[key] = (agg.colorVotes[key] || 0) + v;
    };
    const add = (s, t, c) => {
        const b = bytes(c);
        const v = weight(c);
        const key = `${s}\u0000${t}`;
        const agg = linkAgg.get(key) || { value: 0, bytes: 0, count: 0, colorVotes: {} };
        agg.value += v;
        agg.bytes += b;
        agg.count += 1;
        const cm = proxiesRelationshipColorMode.value;
        if (cm === 'rule') {
            voteColor(agg, normalize(c.rule), v);
        }
        else if (cm === 'provider') {
            const pk = providerOf(t);
            voteColor(agg, pk || 'unknown', v);
        }
        else if (cm === 'proxy') {
            const arr = (c.chains || []).map(normalize).filter((x) => x && x !== '-');
            const server = arr[arr.length - 1] || arr[0] || 'DIRECT';
            voteColor(agg, server, v);
        }
        linkAgg.set(key, agg);
        addNodeMeta(s, b, 1);
        addNodeMeta(t, b, 1);
    };
    for (const c of conns) {
        const v = weight(c);
        if (v <= 0)
            continue;
        const ip0 = c.metadata?.sourceIP || '';
        if (!ip0)
            continue;
        const ip = top.has(ip0) ? ip0 : OTHER_CLIENT;
        const lbl = ip === OTHER_CLIENT ? OTHER_CLIENT : labelForIp(ip);
        const client = ip === OTHER_CLIENT ? OTHER_CLIENT : lbl ? `${lbl} (${ip})` : ip;
        const rawC0 = normalize(c.chains?.[0] || 'DIRECT');
        const chain0 = topChain0.has(rawC0) ? rawC0 : OTHER_C0;
        const rawC1 = c.chains?.[1] ? normalize(c.chains[1]) : '';
        const chain1 = rawC1 ? (topChain1.has(rawC1) ? rawC1 : OTHER_C1) : '';
        add(client, chain0, c);
        if (chain1)
            add(chain0, chain1, c);
    }
    const nodesSet = new Set();
    const links = Array.from(linkAgg.entries()).map(([k, a]) => {
        const [source, target] = k.split('\u0000');
        nodesSet.add(source);
        nodesSet.add(target);
        let color = colorSet.baseContent30;
        if (proxiesRelationshipColorMode.value !== 'none') {
            const entries = Object.entries(a.colorVotes);
            if (entries.length) {
                entries.sort((x, y) => y[1] - x[1]);
                color = colorFromKey(entries[0][0]);
            }
        }
        return {
            source,
            target,
            value: a.value,
            bytes: a.bytes,
            count: a.count,
            lineStyle: { color, opacity: 0.45 },
        };
    });
    const nodes = Array.from(nodesSet)
        .sort((a, b) => a.localeCompare(b))
        // NOTE: Do NOT set node.value here.
        // ECharts will size nodes based on link values. Setting node.value to bytes
        // makes the chart extremely disproportionate (giant blocks), especially when
        // one client flow dominates.
        .map((name) => ({ name }));
    const linksSorted = links.sort((a, b) => {
        const s = a.source.localeCompare(b.source);
        if (s)
            return s;
        return a.target.localeCompare(b.target);
    });
    return { nodes, links: linksSorted, nodeMeta };
});
const tooltipFormatter = (p) => {
    if (p?.dataType === 'edge') {
        const d = p.data || {};
        const cnt = Number(d.count) || 0;
        const b = Number(d.bytes) || 0;
        return `
      <div style="max-width: 420px">
        <div style="font-weight:600">${shortLabel(d.source)} → ${shortLabel(d.target)}</div>
        <div>${t('count')}: <b>${cnt}</b></div>
        <div>${t('traffic')}: <b>${prettyBytesHelper(b)}</b></div>
      </div>
    `;
    }
    const name = p?.name || '';
    const meta = sankeyData.value.nodeMeta.get(name);
    const provider = meta?.provider ? ` (${t('provider')}: ${meta.provider})` : '';
    const cnt = meta?.count || 0;
    const b = meta?.bytes || 0;
    return `
    <div style="max-width: 420px">
      <div style="font-weight:600">${shortLabel(name)}${provider}</div>
      <div>${t('count')}: <b>${cnt}</b></div>
      <div>${t('traffic')}: <b>${prettyBytesHelper(b)}</b></div>
    </div>
  `;
};
const options = computed(() => ({
    animation: true,
    animationDuration: 250,
    animationDurationUpdate: 550,
    animationEasingUpdate: 'cubicOut',
    tooltip: {
        trigger: 'item',
        triggerOn: 'mousemove',
        formatter: tooltipFormatter,
        backgroundColor: colorSet.base70,
        borderColor: colorSet.base70,
        confine: true,
        padding: [6, 8],
        textStyle: { color: colorSet.baseContent, fontFamily, fontSize: Math.max(11, labelFontSize.value) },
    },
    series: [
        {
            id: 'sankey-clients',
            type: 'sankey',
            data: sankeyData.value.nodes,
            links: sankeyData.value.links,
            nodeAlign: 'justify',
            nodeWidth: isFullScreen.value ? 14 : 12,
            nodeGap: isFullScreen.value ? 6 : 4,
            emphasis: { focus: 'adjacency' },
            lineStyle: { curveness: 0.5, opacity: 0.45 },
            label: {
                color: colorSet.baseContent,
                fontFamily,
                fontSize: labelFontSize.value,
                overflow: 'truncate',
                width: isFullScreen.value ? 260 : 180,
                formatter: (pp) => shortLabel(pp?.name || ''),
            },
        },
    ],
}));
let mainChart = null;
let fsChart = null;
const render = (force = false) => {
    if (!mainChart)
        return;
    mainChart.setOption(options.value, { notMerge: force, lazyUpdate: true });
    if (isFullScreen.value && fsChart)
        fsChart.setOption(options.value, { notMerge: force, lazyUpdate: true });
};
onMounted(() => {
    updateColorSet();
    updateFontFamily();
    refreshSnapshot();
    if (!proxiesRelationshipPaused.value)
        startTimer();
    watch(theme, updateColorSet);
    watch(font, updateFontFamily);
    mainChart = echarts.init(chart.value);
    mainChart.setOption(options.value);
    watch(options, () => render(false));
    watch(isFullScreen, async (v) => {
        if (v) {
            await nextTick();
            if (!fsChart)
                fsChart = echarts.init(fullScreenChart.value);
            render(true);
        }
        else {
            fsChart?.dispose();
            fsChart = null;
        }
    });
    const resize = debounce(() => {
        mainChart?.resize();
        fsChart?.resize();
    }, 100);
    watch(width, resize);
});
onBeforeUnmount(() => {
    stopTimer();
    mainChart?.dispose();
    fsChart?.dispose();
    mainChart = null;
    fsChart = null;
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ onMousemove: () => { } },
    ...{ onTouchmove: () => { } },
    ...{ class: (__VLS_ctx.twMerge('relative h-96 w-full overflow-hidden')) },
});
__VLS_asFunctionalElement1(__VLS_intrinsics.div)({
    ref: "chart",
    ...{ class: "h-full w-full" },
});
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span)({
    ...{ class: "border-base-content/30 text-base-content/10 bg-base-100/70 hidden" },
    ref: "colorRef",
});
/** @type {__VLS_StyleScopedClasses['border-base-content/30']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/10']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.isFullScreen = !__VLS_ctx.isFullScreen;
            // @ts-ignore
            [twMerge, isFullScreen, isFullScreen,];
        } },
    ...{ class: (__VLS_ctx.twMerge('btn btn-ghost btn-circle btn-sm absolute right-1 bottom-1', __VLS_ctx.isFullScreen ? 'fixed right-4 bottom-4 mb-[env(safe-area-inset-bottom)]' : '')) },
});
const __VLS_0 = (__VLS_ctx.isFullScreen ? __VLS_ctx.ArrowsPointingInIcon : __VLS_ctx.ArrowsPointingOutIcon);
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    ...{ class: "h-4 w-4" },
}));
const __VLS_2 = __VLS_1({
    ...{ class: "h-4 w-4" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
let __VLS_5;
/** @ts-ignore @type {typeof __VLS_components.Teleport | typeof __VLS_components.Teleport} */
Teleport;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
    to: "body",
}));
const __VLS_7 = __VLS_6({
    to: "body",
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
const { default: __VLS_10 } = __VLS_8.slots;
if (__VLS_ctx.isFullScreen) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "bg-base-100 custom-background fixed inset-0 z-[9999] h-screen w-screen bg-cover bg-center" },
        ...{ class: (`blur-intensity-${__VLS_ctx.blurIntensity} custom-background-${__VLS_ctx.dashboardTransparent}`) },
        ...{ style: (__VLS_ctx.backgroundImage) },
    });
    /** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
    /** @type {__VLS_StyleScopedClasses['custom-background']} */ ;
    /** @type {__VLS_StyleScopedClasses['fixed']} */ ;
    /** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['z-[9999]']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-screen']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-screen']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-cover']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-center']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
        ref: "fullScreenChart",
        ...{ class: "bg-base-100 h-full w-full" },
        ...{ style: (__VLS_ctx.fullChartStyle) },
    });
    /** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.isFullScreen))
                    return;
                __VLS_ctx.isFullScreen = false;
                // @ts-ignore
                [twMerge, isFullScreen, isFullScreen, isFullScreen, isFullScreen, ArrowsPointingInIcon, ArrowsPointingOutIcon, blurIntensity, dashboardTransparent, backgroundImage, fullChartStyle,];
            } },
        ...{ class: "btn btn-ghost btn-circle btn-sm fixed right-4 bottom-4 mb-[env(safe-area-inset-bottom)]" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['fixed']} */ ;
    /** @type {__VLS_StyleScopedClasses['right-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['bottom-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['mb-[env(safe-area-inset-bottom)]']} */ ;
    let __VLS_11;
    /** @ts-ignore @type {typeof __VLS_components.ArrowsPointingInIcon} */
    ArrowsPointingInIcon;
    // @ts-ignore
    const __VLS_12 = __VLS_asFunctionalComponent1(__VLS_11, new __VLS_11({
        ...{ class: "h-4 w-4" },
    }));
    const __VLS_13 = __VLS_12({
        ...{ class: "h-4 w-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_12));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
}
// @ts-ignore
[];
var __VLS_8;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
