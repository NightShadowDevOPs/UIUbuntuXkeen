<template>
  <div data-nav-kind="proxy-group" :data-nav-value="name">
    <CollapseCard :name="proxyGroup.name">
    <template v-slot:title>
      <div
        class="relative flex items-center gap-2"
        @contextmenu.prevent.stop="handlerLatencyTest"
      >
        <div class="flex flex-1 items-center gap-1">
          <ProxyName
            :name="name"
            :icon-size="proxyGroupIconSize"
            :icon-margin="proxyGroupIconMargin"
          />
          <span class="text-base-content/60 text-xs">
            : {{ proxyGroup.type }} ({{ proxiesCount }})
          </span>
          <button
            v-if="manageHiddenGroup"
            class="btn btn-circle btn-xs z-10 ml-1"
            @click.stop="handlerGroupToggle"
          >
            <EyeIcon
              v-if="!hiddenGroup"
              class="h-3 w-3"
            />
            <EyeSlashIcon
              v-else
              class="h-3 w-3"
            />
          </button>
        </div>
        <LatencyTag
          :class="twMerge('bg-base-200/50 hover:bg-base-200 z-10')"
          :loading="isLatencyTesting"
          :name="proxyGroup.now"
          :group-name="proxyGroup.name"
          @click.stop="handlerLatencyTest"
        />

        <!-- Topology filters for the whole group (stage: G) -->
        <div class="z-10 flex items-center gap-1">
          <button
            class="btn btn-ghost btn-circle btn-xs"
            title="Топология: только этот прокси"
            @click.stop="openTopologyWithGroup('only')"
          >
            <FunnelIcon class="h-3 w-3" />
          </button>
          <button
            class="btn btn-ghost btn-circle btn-xs"
            title="Топология: исключить этот прокси"
            @click.stop="openTopologyWithGroup('exclude')"
          >
            <NoSymbolIcon class="h-3 w-3" />
          </button>
        </div>
      </div>
      <div
        class="text-base-content/80 mt-1.5 flex items-center gap-2"
        @contextmenu.prevent.stop="handlerLatencyTest"
      >
        <div class="flex flex-1 items-center gap-1 truncate text-sm">
          <ProxyGroupNow :name="name" />
        </div>
        <div class="min-w-24 shrink-0 text-right text-xs font-mono">
          <div>{{ prettyBytesHelper(trafficTotal) }}</div>
          <div class="opacity-60">{{ prettyBytesHelper(speedTotal) }}/s</div>
        </div>
      </div>
    </template>
    <template v-slot:preview>
      <ProxyPreview
        :nodes="renderProxies"
        :now="proxyGroup.now"
        :groupName="proxyGroup.name"
        :enable-topology-filter="true"
        @nodeclick="handlerProxySelect(name, $event)"
        @nodefilter="openTopologyWithProxy"
      />
    </template>
    <template v-slot:content="{ showFullContent }">
      <Component
        :is="groupProxiesByProvider ? ProxiesByProvider : ProxiesContent"
        :name="name"
        :now="proxyGroup.now"
        :render-proxies="renderProxies"
        :show-full-content="showFullContent"
      />
    </template>
    </CollapseCard>
  </div>
</template>

<script setup lang="ts">
import { useBounceOnVisible } from '@/composables/bouncein'
import { useRenderProxies } from '@/composables/renderProxies'
import { isHiddenGroup } from '@/helper'
import { prettyBytesHelper } from '@/helper/utils'
import { activeConnections } from '@/store/connections'
import {
  handlerProxySelect,
  hiddenGroupMap,
  proxyGroupLatencyTest,
  proxyMap,
} from '@/store/proxies'
import { ROUTE_NAME } from '@/constant'
import { useRouter } from 'vue-router'
import {
  groupProxiesByProvider,
  manageHiddenGroup,
  proxyGroupIconMargin,
  proxyGroupIconSize,
} from '@/store/settings'
import { EyeIcon, EyeSlashIcon, FunnelIcon, NoSymbolIcon } from '@heroicons/vue/24/outline'
import { twMerge } from 'tailwind-merge'
import { computed, ref } from 'vue'
import CollapseCard from '../common/CollapseCard.vue'
import LatencyTag from './LatencyTag.vue'
import ProxiesByProvider from './ProxiesByProvider.vue'
import ProxiesContent from './ProxiesContent.vue'
import ProxyGroupNow from './ProxyGroupNow.vue'
import ProxyName from './ProxyName.vue'
import ProxyPreview from './ProxyPreview.vue'

const props = defineProps<{
  name: string
}>()

const router = useRouter()

const TOPOLOGY_NAV_FILTER_KEY = 'runtime/topology-pending-filter-v1'

const openTopologyWithGroup = async (mode: 'only' | 'exclude') => {
  const payload = {
    ts: Date.now(),
    mode,
    focus: { stage: 'G', kind: 'value', value: props.name },
  }

  try {
    localStorage.setItem(TOPOLOGY_NAV_FILTER_KEY, JSON.stringify(payload))
  } catch {
    // ignore
  }

  await router.push({ name: ROUTE_NAME.overview })
}

const openTopologyWithProxy = async (p: { name: string; mode: 'only' | 'exclude' }) => {
  const payload = {
    ts: Date.now(),
    mode: p.mode,
    focus: { stage: 'S', kind: 'value', value: p.name },
  }

  try {
    localStorage.setItem(TOPOLOGY_NAV_FILTER_KEY, JSON.stringify(payload))
  } catch {
    // ignore
  }

  await router.push({ name: ROUTE_NAME.overview })
}
const proxyGroup = computed(() => proxyMap.value[props.name])
const allProxies = computed(() => proxyGroup.value.all ?? [])
const { proxiesCount, renderProxies } = useRenderProxies(allProxies, props.name)
const isLatencyTesting = ref(false)
const handlerLatencyTest = async () => {
  if (isLatencyTesting.value) return

  isLatencyTesting.value = true
  try {
    await proxyGroupLatencyTest(props.name)
    isLatencyTesting.value = false
  } catch {
    isLatencyTesting.value = false
  }
}
const speedTotal = computed(() => {
  const speed = activeConnections.value
    .filter((conn) => conn.chains.includes(props.name))
    .reduce((total, conn) => total + (conn.downloadSpeed || 0) + (conn.uploadSpeed || 0), 0)

  return speed
})

const trafficTotal = computed(() => {
  const total = activeConnections.value
    .filter((conn) => conn.chains.includes(props.name))
    .reduce((sum, conn) => sum + (conn.download || 0) + (conn.upload || 0), 0)
  return total
})
const hiddenGroup = computed({
  get: () => isHiddenGroup(props.name),
  set: (value: boolean) => {
    hiddenGroupMap.value[props.name] = value
  },
})

const handlerGroupToggle = () => {
  hiddenGroup.value = !hiddenGroup.value
}

useBounceOnVisible()
</script>
