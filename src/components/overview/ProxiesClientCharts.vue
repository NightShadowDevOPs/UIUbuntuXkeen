<template>
  <div
    :class="twMerge('relative h-96 w-full overflow-hidden')"
    @mousemove.stop
    @touchmove.stop
  >
    <div ref="chart" class="h-full w-full" />
    <span class="border-base-content/30 text-base-content/10 bg-base-100/70 hidden" ref="colorRef" />

    <button
      :class="
        twMerge(
          'btn btn-ghost btn-circle btn-sm absolute right-1 bottom-1',
          isFullScreen ? 'fixed right-4 bottom-4 mb-[env(safe-area-inset-bottom)]' : '',
        )
      "
      @click="isFullScreen = !isFullScreen"
    >
      <component :is="isFullScreen ? ArrowsPointingInIcon : ArrowsPointingOutIcon" class="h-4 w-4" />
    </button>
  </div>

  <Teleport to="body">
    <div
      v-if="isFullScreen"
      class="bg-base-100 custom-background fixed inset-0 z-[9999] h-screen w-screen bg-cover bg-center"
      :class="`blur-intensity-${blurIntensity} custom-background-${dashboardTransparent}`"
      :style="backgroundImage"
    >
      <div ref="fullScreenChart" class="bg-base-100 h-full w-full" :style="fullChartStyle" />
      <button
        class="btn btn-ghost btn-circle btn-sm fixed right-4 bottom-4 mb-[env(safe-area-inset-bottom)]"
        @click="isFullScreen = false"
      >
        <ArrowsPointingInIcon class="h-4 w-4" />
      </button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { backgroundImage } from '@/helper/indexeddb'
import { prettyBytesHelper } from '@/helper/utils'
import type { Connection } from '@/types'
import { isSourceIpScopeVisible } from '@/helper/sourceip'
import { activeConnections } from '@/store/connections'
import { proxyProviederList } from '@/store/proxies'
import {
  blurIntensity,
  dashboardTransparent,
  font,
  proxiesRelationshipColorMode,
  proxiesRelationshipPaused,
  proxiesRelationshipRefreshNonce,
  proxiesRelationshipRefreshSec,
  proxiesRelationshipTopN,
  proxiesRelationshipTopNChain,
  proxiesRelationshipWeightMode,
  sourceIPLabelList,
  theme,
} from '@/store/settings'
import { ArrowsPointingInIcon, ArrowsPointingOutIcon } from '@heroicons/vue/24/outline'
import { useElementSize } from '@vueuse/core'
import { SankeyChart } from 'echarts/charts'
import { TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { debounce } from 'lodash'
import { twMerge } from 'tailwind-merge'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

echarts.use([SankeyChart, TooltipComponent, CanvasRenderer])

const { t } = useI18n()

const isFullScreen = ref(false)
const chart = ref()
const fullScreenChart = ref()
const colorRef = ref()

const fullChartStyle = computed(() => `backdrop-filter: blur(${blurIntensity.value}px);`)

const colorSet = { baseContent30: '', baseContent: '', base70: '' }
let fontFamily = ''

const updateColorSet = () => {
  const cs = getComputedStyle(colorRef.value)
  colorSet.baseContent = cs.getPropertyValue('--color-base-content').trim()
  colorSet.baseContent30 = cs.borderColor
  colorSet.base70 = cs.backgroundColor
}
const updateFontFamily = () => {
  fontFamily = getComputedStyle(colorRef.value).fontFamily
}

const { width } = useElementSize(chart)
const labelFontSize = computed(() => {
  const w = Number(width.value) || 0
  return isFullScreen.value ? 14 : w >= 1100 ? 13 : w >= 800 ? 12 : 11
})

const labelForIp = (ip: string) => {
  const item = sourceIPLabelList.value.find((x) => {
    if (x.key !== ip) return false
    return isSourceIpScopeVisible(x.scope as string[] | undefined)
  })
  return item?.label || ''
}

const normalize = (s: string) => (s || '').trim() || '-'
const shortLabel = (name: string) => {
  if (!name) return ''
  const max = isFullScreen.value ? 46 : 32
  return name.length > max ? `${name.slice(0, max - 1)}…` : name
}

const providerMap = computed(() => {
  const m = new Map<string, string>()
  for (const p of proxyProviederList.value) {
    for (const proxy of p.proxies || []) {
      m.set(proxy.name, p.name)
    }
  }
  return m
})

const providerOf = (name: string) => providerMap.value.get(name) || ''

const colorFromKey = (key: string) => {
  const s = key || 'unknown'
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return `hsl(${h % 360} 70% 55%)`
}

// ----- snapshot & pause -----
const snapshot = ref<Connection[]>([])
const deltaBytesById = ref<Record<string, number>>({})
const prevTotalsById = new Map<string, number>()
let lastSnapshotAt = Date.now()

let timer: number | undefined

const refreshSnapshot = () => {
  const now = Date.now()
  const dt = Math.max(1, (now - lastSnapshotAt) / 1000)
  lastSnapshotAt = now

  const conns = activeConnections.value.slice()
  const deltas: Record<string, number> = {}

  for (const c of conns) {
    const id = (c as any).id || ''
    if (!id) continue

    const total = (Number((c as any).download) || 0) + (Number((c as any).upload) || 0)
    const prev = prevTotalsById.get(id)
    let delta = prev === undefined ? 0 : Math.max(0, total - prev)

    // если дельта 0 (например, первое обновление) — оценим по скорости за интервал
    if (delta === 0) {
      const sp = (Number((c as any).downloadSpeed) || 0) + (Number((c as any).uploadSpeed) || 0)
      if (sp > 0) delta = sp * dt
    }

    deltas[id] = delta
    prevTotalsById.set(id, total)
  }

  // чистим старые id
  for (const id of Array.from(prevTotalsById.keys())) {
    if (!(id in deltas)) prevTotalsById.delete(id)
  }

  deltaBytesById.value = deltas
  snapshot.value = conns
}

const stopTimer = () => {
  if (timer) {
    clearInterval(timer)
    timer = undefined
  }
}

const startTimer = () => {
  stopTimer()
  const sec = Math.max(1, Number(proxiesRelationshipRefreshSec.value) || 5)
  timer = window.setInterval(() => {
    if (!proxiesRelationshipPaused.value) refreshSnapshot()
  }, sec * 1000)
}

watch(proxiesRelationshipPaused, (p) => {
  if (p) stopTimer()
  else {
    refreshSnapshot()
    startTimer()
  }
})

watch(proxiesRelationshipRefreshSec, () => {
  if (!proxiesRelationshipPaused.value) startTimer()
})

watch(proxiesRelationshipRefreshNonce, () => {
  refreshSnapshot()
})

type LinkAgg = {
  value: number
  bytes: number
  count: number
  colorVotes: Record<string, number>
}

type NodeMeta = { bytes: number; count: number; provider?: string }

const sankeyData = computed(() => {
  const conns = snapshot.value || []
  const topClientsN = Math.max(10, Number(proxiesRelationshipTopN.value) || 40)
  const topChainN = Math.max(10, Number(proxiesRelationshipTopNChain.value) || 18)

  const bytes = (c: Connection) => {
    const id = (c as any).id || ''
    return (id && deltaBytesById.value[id]) ? deltaBytesById.value[id] : 0
  }
  const hasTraffic = conns.some((c) => bytes(c) > 0)

  const weight = (c: Connection) => {
    if (proxiesRelationshipWeightMode.value === 'count') return 1
    if (!hasTraffic) return 1
    // компрессия, чтобы крупные потоки не раздували диаграмму
    return Math.min(1 + Math.log1p(bytes(c) / 1024), 60)
  }

  const totals = new Map<string, number>()
  const chain0Totals = new Map<string, number>()
  const chain1Totals = new Map<string, number>()

  for (const c of conns) {
    const ip = c.metadata?.sourceIP || ''
    if (!ip) continue
    const v = weight(c)
    totals.set(ip, (totals.get(ip) || 0) + v)

    const c0 = normalize(c.chains?.[0] || 'DIRECT')
    chain0Totals.set(c0, (chain0Totals.get(c0) || 0) + v)

    const c1 = c.chains?.[1] ? normalize(c.chains[1]) : ''
    if (c1) chain1Totals.set(c1, (chain1Totals.get(c1) || 0) + v)
  }

  const top = new Set(
    Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topClientsN)
      .map(([k]) => k),
  )

  const topChain0 = new Set(
    Array.from(chain0Totals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topChainN)
      .map(([k]) => k),
  )

  const topChain1 = new Set(
    Array.from(chain1Totals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topChainN)
      .map(([k]) => k),
  )

  const OTHER_CLIENT = 'other'
  const OTHER_C0 = 'other-out'
  const OTHER_C1 = 'other-node'

  const linkAgg = new Map<string, LinkAgg>()
  const nodeMeta = new Map<string, NodeMeta>()

  const addNodeMeta = (name: string, b: number, cnt: number) => {
    const cur = nodeMeta.get(name) || { bytes: 0, count: 0 }
    cur.bytes += b
    cur.count += cnt
    if (!cur.provider) {
      const p = providerOf(name)
      if (p) cur.provider = p
    }
    nodeMeta.set(name, cur)
  }

  const voteColor = (agg: LinkAgg, key: string, v: number) => {
    if (!key) return
    agg.colorVotes[key] = (agg.colorVotes[key] || 0) + v
  }

  const add = (s: string, t: string, c: Connection) => {
    const b = bytes(c)
    const v = weight(c)
    const key = `${s}\u0000${t}`
    const agg = linkAgg.get(key) || { value: 0, bytes: 0, count: 0, colorVotes: {} }
    agg.value += v
    agg.bytes += b
    agg.count += 1

    const cm = proxiesRelationshipColorMode.value
    if (cm === 'rule') {
      voteColor(agg, normalize(c.rule), v)
    } else if (cm === 'provider') {
      const pk = providerOf(t)
      voteColor(agg, pk || 'unknown', v)
    } else if (cm === 'proxy') {
      const arr = (c.chains || []).map(normalize).filter((x) => x && x !== '-')
      const server = arr[arr.length - 1] || arr[0] || 'DIRECT'
      voteColor(agg, server, v)
    }

    linkAgg.set(key, agg)
    addNodeMeta(s, b, 1)
    addNodeMeta(t, b, 1)
  }

  for (const c of conns) {
    const v = weight(c)
    if (v <= 0) continue

    const ip0 = c.metadata?.sourceIP || ''
    if (!ip0) continue
    const ip = top.has(ip0) ? ip0 : OTHER_CLIENT
    const lbl = ip === OTHER_CLIENT ? OTHER_CLIENT : labelForIp(ip)
    const client = ip === OTHER_CLIENT ? OTHER_CLIENT : lbl ? `${lbl} (${ip})` : ip

    const rawC0 = normalize(c.chains?.[0] || 'DIRECT')
    const chain0 = topChain0.has(rawC0) ? rawC0 : OTHER_C0

    const rawC1 = c.chains?.[1] ? normalize(c.chains[1]) : ''
    const chain1 = rawC1 ? (topChain1.has(rawC1) ? rawC1 : OTHER_C1) : ''

    add(client, chain0, c)
    if (chain1) add(chain0, chain1, c)
  }

  const nodesSet = new Set<string>()
  const links = Array.from(linkAgg.entries()).map(([k, a]) => {
    const [source, target] = k.split('\u0000')
    nodesSet.add(source)
    nodesSet.add(target)

    let color = colorSet.baseContent30
    if (proxiesRelationshipColorMode.value !== 'none') {
      const entries = Object.entries(a.colorVotes)
      if (entries.length) {
        entries.sort((x, y) => y[1] - x[1])
        color = colorFromKey(entries[0][0])
      }
    }

    return {
      source,
      target,
      value: a.value,
      bytes: a.bytes,
      count: a.count,
      lineStyle: { color, opacity: 0.45 },
    }
  })

  const nodes = Array.from(nodesSet)
    .sort((a, b) => a.localeCompare(b))
    // NOTE: Do NOT set node.value here.
    // ECharts will size nodes based on link values. Setting node.value to bytes
    // makes the chart extremely disproportionate (giant blocks), especially when
    // one client flow dominates.
    .map((name) => ({ name }))

  const linksSorted = links.sort((a: any, b: any) => {
    const s = a.source.localeCompare(b.source)
    if (s) return s
    return a.target.localeCompare(b.target)
  })

  return { nodes, links: linksSorted, nodeMeta }
})

const tooltipFormatter = (p: any) => {
  if (p?.dataType === 'edge') {
    const d = p.data || {}
    const cnt = Number(d.count) || 0
    const b = Number(d.bytes) || 0
    return `
      <div style="max-width: 420px">
        <div style="font-weight:600">${shortLabel(d.source)} → ${shortLabel(d.target)}</div>
        <div>${t('count')}: <b>${cnt}</b></div>
        <div>${t('traffic')}: <b>${prettyBytesHelper(b)}</b></div>
      </div>
    `
  }

  const name = p?.name || ''
  const meta = sankeyData.value.nodeMeta.get(name)
  const provider = meta?.provider ? ` (${t('provider')}: ${meta.provider})` : ''
  const cnt = meta?.count || 0
  const b = meta?.bytes || 0

  return `
    <div style="max-width: 420px">
      <div style="font-weight:600">${shortLabel(name)}${provider}</div>
      <div>${t('count')}: <b>${cnt}</b></div>
      <div>${t('traffic')}: <b>${prettyBytesHelper(b)}</b></div>
    </div>
  `
}

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
        formatter: (pp: any) => shortLabel(pp?.name || ''),
      },
    },
  ],
}))

let mainChart: echarts.ECharts | null = null
let fsChart: echarts.ECharts | null = null

const render = (force = false) => {
  if (!mainChart) return
  mainChart.setOption(options.value as any, { notMerge: force, lazyUpdate: true })
  if (isFullScreen.value && fsChart) fsChart.setOption(options.value as any, { notMerge: force, lazyUpdate: true })
}

onMounted(() => {
  updateColorSet()
  updateFontFamily()

  refreshSnapshot()
  if (!proxiesRelationshipPaused.value) startTimer()

  watch(theme, updateColorSet)
  watch(font, updateFontFamily)

  mainChart = echarts.init(chart.value)
  mainChart.setOption(options.value as any)

  watch(options, () => render(false))

  watch(isFullScreen, async (v) => {
    if (v) {
      await nextTick()
      if (!fsChart) fsChart = echarts.init(fullScreenChart.value)
      render(true)
    } else {
      fsChart?.dispose()
      fsChart = null
    }
  })

  const resize = debounce(() => {
    mainChart?.resize()
    fsChart?.resize()
  }, 100)
  watch(width, resize)
})

onBeforeUnmount(() => {
  stopTimer()
  mainChart?.dispose()
  fsChart?.dispose()
  mainChart = null
  fsChart = null
})
</script>
