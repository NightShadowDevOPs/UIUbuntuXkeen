<template>
  <div class="card gap-3 p-3">
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div>
        <div class="font-semibold">{{ $t('trafficClientStateTitle') }}</div>
        <div class="text-sm opacity-70">{{ $t('trafficClientStateTip') }}</div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <label class="input input-sm flex items-center gap-2">
          <span class="opacity-60">{{ $t('search') }}</span>
          <input v-model.trim="query" class="grow bg-transparent" type="text" :placeholder="$t('trafficClientStateSearchPlaceholder')" />
        </label>
        <button type="button" class="btn btn-sm" @click="refreshAll" :disabled="loading">
          <span v-if="loading" class="loading loading-spinner loading-xs"></span>
          <span v-else>{{ $t('refresh') }}</span>
        </button>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-2 text-xs opacity-80">
      <span class="badge badge-ghost">Mihomo WS</span>
      <span class="badge" :class="agentLive ? 'badge-info' : 'badge-ghost'">{{ agentLive ? $t('trafficDataSourceAgentLive') : $t('trafficDataSourceMihomoOnly') }}</span>
      <span v-if="hostsKnown" class="badge badge-ghost">{{ $t('trafficDataSourceLanHosts') }} · {{ hostsKnown }}</span>
      <span class="badge badge-ghost">{{ $t('updated') }} · {{ updatedLabel }}</span>
    </div>

    <div v-if="notice" class="rounded-lg border border-base-content/10 bg-base-200/20 px-3 py-2 text-sm opacity-80">
      {{ notice }}
    </div>

    <div v-if="error" class="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm">
      {{ error }}
    </div>

    <div class="overflow-x-auto rounded-lg border border-base-content/10 bg-base-100/40">
      <table class="table table-sm">
        <thead>
          <tr>
            <th>{{ $t('host') }}</th>
            <th>{{ $t('trafficClientStateTitle') }}</th>
            <th>{{ $t('trafficClientStateConnections') }}</th>
            <th>{{ $t('trafficClientStateHostTraffic') }}</th>
            <th>{{ $t('trafficClientStateMihomoTraffic') }}</th>
            <th>{{ $t('trafficClientStateRoute') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in filteredRows" :key="row.ip">
            <td class="min-w-[220px]">
              <div class="flex flex-col gap-0.5">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="font-medium">{{ row.displayName }}</span>
                                  </div>
                <span class="font-mono text-[11px] opacity-70">{{ row.ip }}</span>
                <span v-if="row.mac" class="font-mono text-[11px] opacity-50">{{ row.mac }}</span>
              </div>
            </td>
            <td>
              <div class="flex flex-wrap gap-1">
                <span v-for="badge in row.badges" :key="`${row.ip}-${badge.key}`" class="badge badge-xs" :class="badge.className">
                  {{ badge.label }}
                </span>
                <span v-if="!row.badges.length" class="badge badge-ghost badge-xs">{{ $t('idle') }}</span>
              </div>
            </td>
            <td>
              <div class="text-xs sm:text-sm">
                <div>{{ $t('activeConnections') }}: <span class="font-medium">{{ row.activeConnections }}</span></div>
                <div class="opacity-70">{{ $t('closedConnections') }}: {{ row.closedConnections }}</div>
              </div>
            </td>
            <td>
              <div class="text-xs sm:text-sm">
                <div>↓ {{ formatRate(row.hostDownBps) }}</div>
                <div>↑ {{ formatRate(row.hostUpBps) }}</div>
                <div v-if="row.vpnDownBps || row.vpnUpBps" class="opacity-70">{{ $t('routerTrafficVpn') }}: ↓ {{ formatRate(row.vpnDownBps) }} · ↑ {{ formatRate(row.vpnUpBps) }}</div>
                <div v-if="row.bypassDownBps || row.bypassUpBps" class="opacity-70">{{ $t('routerTrafficBypass') }}: ↓ {{ formatRate(row.bypassDownBps) }} · ↑ {{ formatRate(row.bypassUpBps) }}</div>
              </div>
            </td>
            <td>
              <div class="text-xs sm:text-sm">
                <div>↓ {{ formatRate(row.mihomoDownBps) }}</div>
                <div>↑ {{ formatRate(row.mihomoUpBps) }}</div>
                <div class="opacity-70">Σ {{ formatBytes(row.mihomoTotalBytes) }}</div>
              </div>
            </td>
            <td class="min-w-[220px]">
              <div class="flex flex-col gap-0.5 text-xs sm:text-sm">
                <span class="font-medium">{{ row.topRoute || '—' }}</span>
                <span class="opacity-70">{{ row.topTarget || '—' }}</span>
              </div>
            </td>
          </tr>
          <tr v-if="!filteredRows.length">
            <td colspan="6" class="py-6 text-center text-sm opacity-60">{{ $t('trafficClientStateNoRows') }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { agentHostTrafficLiveAPI, agentLanHostsAPI, type AgentHostTrafficLiveItem, type AgentLanHost } from '@/api/agent'
import { getChainsStringFromConnection, getHostFromConnection } from '@/helper'
import { getIPLabelFromMap } from '@/helper/sourceip'
import { prettyBytesHelper } from '@/helper/utils'
import { agentEnabled } from '@/store/agent'
import { activeConnections, closedConnections, lastConnectionsTick } from '@/store/connections'
import type { Connection } from '@/types'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

type Badge = { key: string; label: string; className: string }

type Row = {
  ip: string
  displayName: string
  isLabelOnly: boolean
  mac: string
  activeConnections: number
  closedConnections: number
  hostDownBps: number
  hostUpBps: number
  bypassDownBps: number
  bypassUpBps: number
  vpnDownBps: number
  vpnUpBps: number
  mihomoDownBps: number
  mihomoUpBps: number
  mihomoTotalBytes: number
  topRoute: string
  topTarget: string
  badges: Badge[]
}

const { t } = useI18n()
const query = ref('')
const loading = ref(false)
const error = ref('')
const notice = ref('')
const hostTraffic = ref<AgentHostTrafficLiveItem[]>([])
const lanHosts = ref<AgentLanHost[]>([])
const lastAgentUpdateAt = ref(0)
const agentLive = ref(false)
let timer: number | undefined

const formatRate = (bytes: number) => `${prettyBytesHelper(bytes || 0)}/s`
const formatBytes = (bytes: number) => prettyBytesHelper(bytes || 0)

const isLikelySystemOrSyntheticIp = (ip: string) => {
  const value = String(ip || '').trim().toLowerCase()
  if (!value) return true
  if (value === '0.0.0.0' || value === '::' || value === '::1') return true
  if (/^127\./.test(value)) return true
  if (/^169\.254\./.test(value)) return true
  if (/^198\.(18|19)\./.test(value)) return true
  return false
}

const normalizeOptionalAgentError = (message: string) => {
  const raw = String(message || '').trim()
  if (!raw) return t('trafficHostTelemetryUnavailable')
  const low = raw.toLowerCase()
  if (
    low === 'network error'
    || low.includes('timeout')
    || low.includes('failed')
    || low.includes('offline')
    || low.includes('not found')
    || low.includes('404')
    || low.includes('cmd')
  ) {
    return t('trafficHostTelemetryUnavailable')
  }
  return raw
}

const refreshAll = async () => {
  if (!agentEnabled.value) {
    agentLive.value = false
    error.value = ''
    notice.value = ''
    hostTraffic.value = []
    lanHosts.value = []
    return
  }

  loading.value = true
  notice.value = ''
  error.value = ''
  try {
    const [trafficRes, hostsRes] = await Promise.allSettled([agentHostTrafficLiveAPI(), agentLanHostsAPI()])

    if (trafficRes.status === 'fulfilled' && trafficRes.value?.ok) {
      hostTraffic.value = trafficRes.value.items || []
      lastAgentUpdateAt.value = Date.now()
      agentLive.value = true
    } else {
      hostTraffic.value = []
      agentLive.value = false
      const rawError = trafficRes.status === 'fulfilled'
        ? String(trafficRes.value?.error || '')
        : String(trafficRes.reason?.message || '')
      notice.value = normalizeOptionalAgentError(rawError)
    }

    if (hostsRes.status === 'fulfilled' && hostsRes.value?.ok) {
      lanHosts.value = hostsRes.value.items || []
    } else {
      lanHosts.value = []
    }
  } catch (e: any) {
    agentLive.value = false
    hostTraffic.value = []
    lanHosts.value = []
    error.value = normalizeOptionalAgentError(e?.message || 'agent host_traffic_live failed')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  refreshAll()
  timer = window.setInterval(() => {
    refreshAll()
  }, 5000)
})

onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer)
})

const hostsKnown = computed(() => lanHosts.value.length)
const updatedLabel = computed(() => {
  const use = Math.max(Number(lastAgentUpdateAt.value || 0), Number(lastConnectionsTick.value || 0))
  if (!use) return '—'
  const diff = Math.max(0, Math.round((Date.now() - use) / 1000))
  if (diff < 5) return '0s'
  if (diff < 60) return `${diff}s`
  return `${Math.round(diff / 60)}m`
})

const rows = computed<Row[]>(() => {
  const hostsMap = new Map<string, AgentLanHost>()
  for (const host of lanHosts.value || []) {
    if (host?.ip) hostsMap.set(host.ip, host)
  }

  const trafficMap = new Map<string, AgentHostTrafficLiveItem>()
  for (const item of hostTraffic.value || []) {
    if (item?.ip) trafficMap.set(item.ip, item)
  }

  const activeByIp = new Map<string, Connection[]>()
  for (const conn of activeConnections.value || []) {
    const ip = String(conn.metadata.sourceIP || '').trim()
    if (!ip) continue
    const list = activeByIp.get(ip) || []
    list.push(conn)
    activeByIp.set(ip, list)
  }

  const closedCountByIp = new Map<string, number>()
  for (const conn of closedConnections.value || []) {
    const ip = String(conn.metadata.sourceIP || '').trim()
    if (!ip) continue
    closedCountByIp.set(ip, (closedCountByIp.get(ip) || 0) + 1)
  }

  const keys = new Set<string>()
  for (const ip of activeByIp.keys()) keys.add(ip)
  for (const ip of trafficMap.keys()) keys.add(ip)

  const list: Row[] = []

  for (const ip of keys) {
    const active = activeByIp.get(ip) || []
    const host = hostsMap.get(ip)
    const traffic = trafficMap.get(ip)
    const label = getIPLabelFromMap(ip)

    if (!host && !traffic && isLikelySystemOrSyntheticIp(ip)) continue
    const mihomoDownBps = active.reduce((sum, conn) => sum + Number(conn.downloadSpeed || 0), 0)
    const mihomoUpBps = active.reduce((sum, conn) => sum + Number(conn.uploadSpeed || 0), 0)
    const mihomoTotalBytes = active.reduce((sum, conn) => sum + Number(conn.download || 0) + Number(conn.upload || 0), 0)

    const chainStats = new Map<string, number>()
    const targetStats = new Map<string, number>()
    for (const conn of active) {
      const chain = getChainsStringFromConnection(conn)
      chainStats.set(chain, (chainStats.get(chain) || 0) + 1)
      const target = getHostFromConnection(conn)
      targetStats.set(target, (targetStats.get(target) || 0) + 1)
    }

    const topRoute = Array.from(chainStats.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || ''
    const topTarget = Array.from(targetStats.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || ''

    const hostDownBps = Number(traffic?.totalDownBps || 0)
    const hostUpBps = Number(traffic?.totalUpBps || 0)
    const bypassDownBps = Number(traffic?.bypassDownBps || 0)
    const bypassUpBps = Number(traffic?.bypassUpBps || 0)
    const vpnDownBps = Number(traffic?.vpnDownBps || 0)
    const vpnUpBps = Number(traffic?.vpnUpBps || 0)

    const badges: Badge[] = []
    if (active.length) badges.push({ key: 'mihomo', label: t('trafficStateMihomo'), className: 'badge-success badge-outline' })
    if (vpnDownBps > 0 || vpnUpBps > 0) badges.push({ key: 'vpn', label: t('routerTrafficVpn'), className: 'badge-info badge-outline' })
    if (bypassDownBps > 0 || bypassUpBps > 0) badges.push({ key: 'bypass', label: t('routerTrafficBypass'), className: 'badge-warning badge-outline' })
    if (!badges.length && (hostDownBps > 0 || hostUpBps > 0)) badges.push({ key: 'observed', label: t('trafficStateObserved'), className: 'badge-ghost' })

    list.push({
      ip,
      displayName: host?.hostname || (label && label !== ip ? label : ip),
      isLabelOnly: !!label && label !== ip && !host?.hostname,
      mac: String(host?.mac || traffic?.mac || ''),
      activeConnections: active.length,
      closedConnections: Number(closedCountByIp.get(ip) || 0),
      hostDownBps,
      hostUpBps,
      bypassDownBps,
      bypassUpBps,
      vpnDownBps,
      vpnUpBps,
      mihomoDownBps,
      mihomoUpBps,
      mihomoTotalBytes,
      topRoute,
      topTarget,
      badges,
    })
  }

  return list.sort((a, b) => {
    const aWeight = a.activeConnections * 1_000_000 + a.hostDownBps + a.hostUpBps + a.mihomoDownBps + a.mihomoUpBps
    const bWeight = b.activeConnections * 1_000_000 + b.hostDownBps + b.hostUpBps + b.mihomoDownBps + b.mihomoUpBps
    return bWeight - aWeight
  })
})

const filteredRows = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return rows.value
  return rows.value.filter((row) => {
    const haystack = [row.displayName, row.ip, row.mac, row.topRoute, row.topTarget]
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
})

defineExpose({
  rows,
  agentLive,
  lastAgentUpdateAt,
  notice,
  error,
  refreshAll,
})
</script>
