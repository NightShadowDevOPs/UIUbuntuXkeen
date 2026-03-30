<template>
  <div
    ref="previewRef"
    class="flex flex-wrap"
    :class="[(showDots || showSquares) ? 'gap-1 pt-3' : 'gap-2 pt-4 pb-1']"
  >
    <template v-if="showDots || showSquares">
      <div
        v-for="node in nodesLatency"
        :key="node.name"
        class="relative group flex h-5 w-5 items-center justify-center transition hover:scale-110"
        :class="[
          showSquares ? 'rounded-md' : 'rounded-full',
          getBgColor(node.latency),
          highlightNodeName === node.name
            ? 'ring-4 ring-warning ring-offset-2 ring-offset-base-100'
            : '',
        ]"
        ref="dotsRef"
        @mouseenter="(e) => makeTippy(e, node)"
        @click.stop="$emit('nodeclick', node.name)"
      >
        <component :is="iconForLatency(node.latency)" class="h-3.5 w-3.5 text-white/90" />

        <!-- Topology filter quick actions (Only / Exclude) -->
        <div
          v-if="enableTopologyFilter"
          class="absolute left-1/2 top-full z-50 hidden -translate-x-1/2 pt-1 group-hover:block"
        >
          <div class="flex items-center gap-0.5 rounded-md bg-base-200/95 p-0.5 ring-1 ring-base-300 shadow">
            <button
              type="button"
              class="btn btn-ghost btn-xs h-5 min-h-0 w-5 px-0"
              :title="t('topologyOnlyThis')"
              @click.stop.prevent="$emit('nodefilter', { name: node.name, mode: 'only' })"
            >
              <FunnelIcon class="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              class="btn btn-ghost btn-xs h-5 min-h-0 w-5 px-0"
              :title="t('topologyExcludeThis')"
              @click.stop.prevent="$emit('nodefilter', { name: node.name, mode: 'exclude' })"
            >
              <NoSymbolIcon class="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <span
          v-if="highlightNodeName === node.name"
          class="pointer-events-none absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-warning ring-2 ring-base-100 shadow"
        />
      </div>
    </template>
    <div
      v-else
      class="flex flex-1 items-center justify-center overflow-hidden rounded-2xl *:h-2"
    >
      <div
        :class="getBgColor(lowLatency - 1)"
        :style="{
          width: `${(goodsCounts * 100) / nodes.length}%`, // cant use tw class, otherwise dynamic classname won't be generated
        }"
      />
      <div
        :class="getBgColor(mediumLatency - 1)"
        :style="{
          width: `${(mediumCounts * 100) / nodes.length}%`,
        }"
      />
      <div
        :class="getBgColor(mediumLatency + 1)"
        :style="{
          width: `${(badCounts * 100) / nodes.length}%`,
        }"
      />
      <div
        :class="getBgColor(NOT_CONNECTED)"
        :style="{
          width: `${(notConnectedCounts * 100) / nodes.length}%`,
        }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { NOT_CONNECTED, PROXY_PREVIEW_TYPE } from '@/constant'
import { getColorForLatency } from '@/helper'
import { useTooltip } from '@/helper/tooltip'
import { activeConnections } from '@/store/connections'
import { getLatencyByName, getNowProxyNodeName } from '@/store/proxies'
import { lowLatency, mediumLatency, proxyPreviewType } from '@/store/settings'
import { useElementSize } from '@vueuse/core'
import { BoltIcon, FunnelIcon, NoSymbolIcon, PauseCircleIcon, PlayCircleIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

defineEmits<{
  (e: 'nodeclick', name: string): void
  (e: 'nodefilter', payload: { name: string; mode: 'only' | 'exclude' }): void
}>()

const props = defineProps<{
  nodes: string[]
  now?: string
  groupName?: string
  enableTopologyFilter?: boolean
}>()

const { t } = useI18n()

const { showTip } = useTooltip()
const previewRef = ref<HTMLElement | null>(null)
const { width } = useElementSize(previewRef)

const widthEnough = computed(() => {
  return width.value > 20 * props.nodes.length
})

const makeTippy = (e: Event, node: { name: string; latency: number }) => {
  const tag = document.createElement('div')
  const name = document.createElement('div')

  name.textContent = node.name
  tag.append(name)

  if (node.latency !== NOT_CONNECTED) {
    const latency = document.createElement('div')

    latency.textContent = `${node.latency}ms`
    latency.classList.add(getColorForLatency(node.latency))
    tag.append(latency)
  }

  tag.classList.add('flex', 'items-center', 'gap-2')
  showTip(e, tag)
}

const showSquares = computed(() => {
  return proxyPreviewType.value === PROXY_PREVIEW_TYPE.SQUARES
})

const showDots = computed(() => {
  return (
    proxyPreviewType.value === PROXY_PREVIEW_TYPE.DOTS ||
    (proxyPreviewType.value === PROXY_PREVIEW_TYPE.AUTO && widthEnough.value)
  )
})

const enableTopologyFilter = computed(() => !!props.enableTopologyFilter)

const nodesLatency = computed(() =>
  props.nodes.map((name) => {
    return {
      latency: getLatencyByName(name, props.groupName),
      name: name,
    }
  }),
)

/**
 * "now" in Mihomo can be a group (e.g. selector -> loadbalance group),
 * while the preview often shows concrete proxies.
 * To highlight the actually used proxy, we:
 * 1) prefer a proxy found in active connections chain for this group
 * 2) fallback to resolved now node name
 * 3) fallback to now itself
 */
const highlightNodeName = computed(() => {
  const now = props.now || ''

  // direct match
  if (now && props.nodes.includes(now)) return now

  // try to infer the real hop from active connections
  if (props.groupName) {
    const best = activeConnections.value
      .filter((c) => Array.isArray((c as any).chains) && (c as any).chains.includes(props.groupName))
      .map((c) => {
        const chains = (c as any).chains as string[]
        const leaf = chains?.[chains.length - 1] || ''
        const total = (Number((c as any).download) || 0) + (Number((c as any).upload) || 0)
        return { leaf, total }
      })
      .filter((x) => x.leaf && props.nodes.includes(x.leaf))
      .sort((a, b) => b.total - a.total)[0]

    if (best?.leaf) return best.leaf
  }

  // resolve through now-chains (selector -> urltest -> proxy)
  if (now) {
    const resolved = getNowProxyNodeName(now)
    if (resolved && props.nodes.includes(resolved)) return resolved
  }

  return now
})
const getBgColor = (latency: number) => {
  if (latency === NOT_CONNECTED) {
    return 'bg-base-content/60'
  } else if (latency < lowLatency.value) {
    return 'bg-low-latency'
  } else if (latency < mediumLatency.value) {
    return 'bg-medium-latency'
  } else {
    return 'bg-high-latency'
  }
}

const iconForLatency = (latency: number) => {
  if (latency === NOT_CONNECTED) return XMarkIcon
  if (latency < lowLatency.value) return BoltIcon
  if (latency < mediumLatency.value) return PlayCircleIcon
  return PauseCircleIcon
}

const goodsCounts = computed(() => {
  return nodesLatency.value.filter(
    (node) => node.latency < lowLatency.value && node.latency > NOT_CONNECTED,
  ).length
})
const mediumCounts = computed(() => {
  return nodesLatency.value.filter(
    (node) => node.latency >= lowLatency.value && node.latency < mediumLatency.value,
  ).length
})
const badCounts = computed(() => {
  return nodesLatency.value.filter((node) => node.latency >= mediumLatency.value).length
})
const notConnectedCounts = computed(() => {
  return nodesLatency.value.filter((node) => node.latency === NOT_CONNECTED).length
})
</script>

<style scoped>
.tooltip:before {
  left: 0;
  transform: translateX(-10px);
}
</style>