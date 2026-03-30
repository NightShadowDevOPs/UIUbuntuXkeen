<template>
  <div
    ref="cardRef"
    data-nav-kind="proxy-node"
    :data-nav-value="name"
    :data-nav-group="groupName || ''"
    :class="
      twMerge(
        'bg-base-200 flex cursor-pointer flex-col items-start rounded-md',
        active ? 'bg-primary text-primary-content sm:hover:bg-primary/95' : 'sm:hover:bg-base-300',
        isSmallCard ? 'gap-1 p-1' : 'gap-2 p-2',
        latencyTipAnimationClass,
      )
    "
    @contextmenu.stop.prevent="handlerLatencyTest"
  >
    <div class="flex w-full flex-1 items-center">
      <ProxyIcon
        v-if="node?.icon"
        class="shrink-0"
        :icon="node.icon"
        :fill="active ? 'fill-primary-content' : 'fill-base-content'"
      />
      <span
        :class="twMerge('text-sm', truncateProxyName && 'truncate')"
        @mouseenter="checkTruncation"
      >
        {{ node.name }}
      </span>
    </div>

    <div class="flex h-4 w-full items-center justify-between select-none">
      <span
        :class="`truncate text-xs tracking-tight ${active ? 'text-primary-content' : 'text-base-content/60'}`"
        @mouseenter="checkTruncation"
      >
        {{ typeDescription }}
      </span>
      <div class="flex items-center gap-1">
        <button
          type="button"
          class="btn btn-ghost btn-xs h-5 min-h-0 px-1"
          :title="i18n.global.t('topologyOnlyThis')"
          @click.stop="() => openTopologyWithProxy('only')"
        >
          <FunnelIcon class="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-xs h-5 min-h-0 px-1"
          :title="i18n.global.t('topologyExcludeThis')"
          @click.stop="() => openTopologyWithProxy('exclude')"
        >
          <NoSymbolIcon class="h-3.5 w-3.5" />
        </button>
        <LatencyTag
          :class="[isSmallCard && 'h-4! w-8! rounded-md!', 'shrink-0', active && 'hover:bg-base-300']"
          :name="node.name"
          :loading="isLatencyTesting"
          :group-name="groupName"
          @click.stop="handlerLatencyTest"
        />
      </div>
    </div>


    <div
      v-if="trafficText"
      :class="twMerge('w-full text-xs tracking-tight', active ? 'text-primary-content/80' : 'text-base-content/60')"
    >
      {{ trafficText }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { PROXY_CARD_SIZE, PROXY_SORT_TYPE, ROUTE_NAME } from '@/constant'
import { checkTruncation } from '@/helper/tooltip'
import { prettyBytesHelper, scrollIntoCenter } from '@/helper/utils'
import { i18n } from '@/i18n'
import router from '@/router'
import { activeConnections } from '@/store/connections'
import { getIPv6ByName, getTestUrl, proxyLatencyTest, proxyMap } from '@/store/proxies'
import { IPv6test, proxyCardSize, proxySortType, truncateProxyName } from '@/store/settings'
import { smartWeightsMap } from '@/store/smart'
import { FunnelIcon, NoSymbolIcon } from '@heroicons/vue/24/outline'
import { twMerge } from 'tailwind-merge'
import { computed, onMounted, ref } from 'vue'
import LatencyTag from './LatencyTag.vue'
import ProxyIcon from './ProxyIcon.vue'

const props = defineProps<{
  name: string
  active?: boolean
  groupName?: string
}>()

const cardRef = ref()
const node = computed(() => proxyMap.value[props.name])
const isLatencyTesting = ref(false)
const typeFormatter = (type: string) => {
  type = type.toLowerCase()
  type = type.replace('shadowsocks', 'ss')
  type = type.replace('hysteria', 'hy')
  type = type.replace('wireguard', 'wg')

  return type
}
const isSmallCard = computed(() => proxyCardSize.value === PROXY_CARD_SIZE.SMALL)
const typeDescription = computed(() => {
  const type = typeFormatter(node.value.type)
  const smartUsage = smartWeightsMap.value[props.groupName ?? '']?.[props.name]
  const smartDesc = smartUsage ? i18n.global.t(smartUsage) : ''
  const isV6 = IPv6test.value && getIPv6ByName(node.value.name) ? 'IPv6' : ''
  const isUDP = node.value.udp ? (node.value.xudp ? 'xudp' : 'udp') : ''

  return [type, isUDP, smartDesc, isV6].filter(Boolean).join(isSmallCard.value ? '/' : ' / ')
})

const trafficStat = computed(() => {
  const name = props.name
  let bytes = 0
  let speed = 0
  let count = 0
  for (const c of activeConnections.value) {
    const chains = (c as any).chains || []
    if (!Array.isArray(chains) || !chains.includes(name)) continue
    count += 1
    bytes += (c.download || 0) + (c.upload || 0)
    speed += (c.downloadSpeed || 0) + (c.uploadSpeed || 0)
  }
  return { bytes, speed, count }
})

const trafficText = computed(() => {
  if (!trafficStat.value.count) return ''
  const b = prettyBytesHelper(trafficStat.value.bytes)
  const s = prettyBytesHelper(trafficStat.value.speed)
  return isSmallCard.value ? b : (b + ' · ' + s + '/s')
})

const latencyTipAnimationClass = ref<string[]>([])

const TOPOLOGY_NAV_FILTER_KEY = 'runtime/topology-pending-filter-v1'

const openTopologyWithProxy = async (mode: 'only' | 'exclude' = 'only') => {
  const payload = {
    ts: Date.now(),
    mode: mode,
    focus: { stage: 'S', kind: 'value', value: props.name },
  }

  try {
    localStorage.setItem(TOPOLOGY_NAV_FILTER_KEY, JSON.stringify(payload))
  } catch {
    // ignore
  }

  await router.push({ name: ROUTE_NAME.overview })
}

const handlerLatencyTest = async () => {
  if (isLatencyTesting.value) return

  isLatencyTesting.value = true
  try {
    await proxyLatencyTest(props.name, getTestUrl(props.groupName))
    isLatencyTesting.value = false
  } catch {
    isLatencyTesting.value = false
  }

  if (
    [PROXY_SORT_TYPE.LATENCY_ASC, PROXY_SORT_TYPE.LATENCY_DESC].includes(proxySortType.value) &&
    cardRef.value
  ) {
    const classList = ['bg-info/20!', 'transition-colors', 'duration-1500']

    scrollIntoCenter(cardRef.value)
    latencyTipAnimationClass.value = classList
    setTimeout(() => {
      latencyTipAnimationClass.value = []
    }, 1500)
  }
}

onMounted(() => {
  if (props.active) {
    setTimeout(() => {
      scrollIntoCenter(cardRef.value)
    }, 300)
  }
})
</script>

<style scoped>
.tooltip:before {
  z-index: 20;
}
</style>
