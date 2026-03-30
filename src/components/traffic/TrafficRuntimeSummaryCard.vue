<template>
  <div class="card gap-3 p-3">
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div>
        <div class="font-semibold">{{ $t('trafficRuntimeSummaryTitle') }}</div>
        <div class="text-sm opacity-70">{{ $t('trafficRuntimeSummaryTip') }}</div>
      </div>

      <div class="flex flex-wrap items-center gap-2 text-xs opacity-80">
        <span class="badge" :class="connectionsFresh ? 'badge-success' : 'badge-warning'">
          {{ $t('connections') }} · {{ connectionsFresh ? $t('online') : $t('stale') }}
        </span>
        <span class="badge" :class="agentLive ? 'badge-info' : 'badge-ghost'">
          {{ agentLive ? $t('trafficDataSourceAgentLive') : $t('trafficDataSourceMihomoOnly') }}
        </span>
        <span class="badge badge-ghost">
          {{ $t('updated') }} · {{ lastUpdateLabel }}
        </span>
      </div>
    </div>

    <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      <div class="rounded-lg border border-base-content/10 bg-base-200/20 px-3 py-2">
        <div class="text-xs opacity-60">{{ $t('trafficActiveClients') }}</div>
        <div class="mt-1 text-2xl font-semibold">{{ activeClientCount }}</div>
        <div class="mt-1 text-xs opacity-60">{{ $t('trafficUniqueSources') }}: {{ uniqueSourceCount }}</div>
      </div>

      <div class="rounded-lg border border-base-content/10 bg-base-200/20 px-3 py-2">
        <div class="text-xs opacity-60">{{ $t('connections') }}</div>
        <div class="mt-1 text-2xl font-semibold">{{ activeCount }}</div>
        <div class="mt-1 text-xs opacity-60">{{ $t('closedConnections') }}: {{ closedCount }}</div>
      </div>

      <div class="rounded-lg border border-base-content/10 bg-base-200/20 px-3 py-2">
        <div class="text-xs opacity-60">{{ $t('download') }}</div>
        <div class="mt-1 text-2xl font-semibold">{{ downloadLabel }}</div>
        <div class="mt-1 text-xs opacity-60">{{ $t('upload') }}: {{ uploadLabel }}</div>
      </div>

      <div class="rounded-lg border border-base-content/10 bg-base-200/20 px-3 py-2">
        <div class="text-xs opacity-60">{{ $t('trafficClientStateTitle') }}</div>
        <div class="mt-1 flex flex-wrap gap-2 text-xs">
          <span class="badge badge-success badge-outline">{{ $t('trafficStateMihomo') }} · {{ mihomoClientCount }}</span>
          <span class="badge badge-info badge-outline">{{ $t('routerTrafficVpn') }} · {{ vpnClientCount }}</span>
          <span class="badge badge-warning badge-outline">{{ $t('routerTrafficBypass') }} · {{ bypassClientCount }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { activeConnections, closedConnections, downloadTotal, lastConnectionsTick, uploadTotal } from '@/store/connections'
import { computed } from 'vue'
import { prettyBytesHelper } from '@/helper/utils'

type ClientRuntimeItem = {
  ip: string
  activeConnections: number
  bypassDownBps: number
  bypassUpBps: number
  vpnDownBps: number
  vpnUpBps: number
}

const props = defineProps<{
  items: ClientRuntimeItem[]
  agentLive?: boolean
  lastAgentUpdateAt?: number
}>()

const activeCount = computed(() => activeConnections.value.length)
const closedCount = computed(() => closedConnections.value.length)
const uniqueSourceCount = computed(() => new Set((activeConnections.value || []).map((item) => item.metadata.sourceIP).filter(Boolean)).size)
const activeClientCount = computed(() => props.items.length || uniqueSourceCount.value)
const downloadLabel = computed(() => `${prettyBytesHelper(downloadTotal.value)}/s`)
const uploadLabel = computed(() => `${prettyBytesHelper(uploadTotal.value)}/s`)
const connectionsFresh = computed(() => {
  const ts = Number(lastConnectionsTick.value || 0)
  return !!ts && Date.now() - ts < 12_000
})
const lastUpdateTs = computed(() => Math.max(Number(lastConnectionsTick.value || 0), Number(props.lastAgentUpdateAt || 0)))
const lastUpdateLabel = computed(() => {
  const ts = lastUpdateTs.value
  if (!ts) return '—'
  const diff = Math.max(0, Math.round((Date.now() - ts) / 1000))
  if (diff < 5) return '0s'
  if (diff < 60) return `${diff}s`
  const mins = Math.round(diff / 60)
  return `${mins}m`
})
const agentLive = computed(() => !!props.agentLive)
const mihomoClientCount = computed(() => props.items.filter((item) => item.activeConnections > 0).length)
const vpnClientCount = computed(() => props.items.filter((item) => item.vpnDownBps > 0 || item.vpnUpBps > 0).length)
const bypassClientCount = computed(() => props.items.filter((item) => item.bypassDownBps > 0 || item.bypassUpBps > 0).length)
</script>
