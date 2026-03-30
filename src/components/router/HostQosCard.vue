<template>
  <div class="card gap-3 p-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex flex-wrap items-center gap-2">
        <div class="font-semibold">{{ $t('hostQosTitle') }}</div>
        <span v-if="!agentEnabled" class="badge badge-ghost">{{ $t('disabled') }}</span>
        <span v-else-if="status.ok && (qos.supported || status.hostQos)" class="badge badge-success">{{ $t('online') }}</span>
        <span v-else-if="status.ok && !(qos.supported || status.hostQos)" class="badge badge-warning">no-tc</span>
        <span v-else class="badge badge-error">{{ $t('offline') }}</span>
        <span v-if="qos.qosMode === 'wan-only'" class="badge badge-info">safe qos</span>
      </div>

      <div class="flex flex-wrap items-center gap-2 text-xs opacity-70">
        <template v-for="profile in profileOrder" :key="`legend-${profile}`">
          <span v-if="hasQosDefault(profile)" class="badge badge-ghost">
            {{ profileLabel(profile) }}: {{ profileSummary(profile) }}
          </span>
        </template>
        <span class="badge badge-ghost">{{ $t('hostQosTrackedHosts', { count: rows.length }) }}</span>
        <span class="badge badge-ghost">{{ $t('hostQosAppliedHosts', { count: appliedCount }) }}</span>
        <button type="button" class="btn btn-sm btn-ghost" @click="expanded = !expanded">
          {{ expanded ? $t('collapse') : $t('expand') }}
        </button>
        <button type="button" class="btn btn-sm" @click="refreshAll" :disabled="loading">
          <span v-if="loading" class="loading loading-spinner loading-xs"></span>
          <span v-else>{{ $t('refresh') }}</span>
        </button>
      </div>
    </div>

    <div v-if="!agentEnabled" class="text-sm opacity-70">
      {{ $t('agentDisabledTip') }}
    </div>
    <div v-else-if="!status.ok" class="text-sm opacity-70">
      {{ $t('agentOfflineTip') }}
    </div>
    <div v-else-if="!(qos.supported || status.hostQos)" class="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm">
      {{ $t('hostQosNoTcTip') }}
    </div>
    <div v-else-if="!expanded" class="rounded-lg border border-base-content/10 bg-base-200/30 px-3 py-2 text-sm opacity-80">
      {{ $t('hostQosIntro') }}
    </div>
    <template v-else>
      <div class="rounded-lg border border-base-content/10 bg-base-200/30 p-3 text-sm">
        <div>{{ $t('hostQosIntro') }}</div>
        <div class="mt-1 text-xs opacity-70">{{ $t('hostQosShapeOverrideTip') }}</div>
        <div v-if="qos.qosMode === 'wan-only'" class="mt-1 text-xs text-info/80">Safe mode: uplink/WAN only</div>
      </div>

      <div class="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_220px]">
        <label class="flex min-w-0 flex-col gap-1">
          <span class="text-xs opacity-60">{{ $t('search') }}</span>
          <input v-model.trim="query" class="input input-sm w-full" :placeholder="$t('hostQosSearchPlaceholder')" />
        </label>
        <div class="rounded-lg border border-base-content/10 bg-base-200/30 px-3 py-2 text-xs opacity-70">
          <div>{{ $t('hostQosTrackedHosts', { count: rows.length }) }}</div>
          <div>{{ $t('hostQosAppliedHosts', { count: appliedCount }) }}</div>
          <div>{{ $t('hostQosLineRates', { wan: qos.wanRateMbit || '—', lan: qos.lanRateMbit || '—' }) }}</div>
          <div v-if="qos.qosMode === 'wan-only'">Safe mode: uplink/WAN only</div>
        </div>
      </div>

      <div v-if="error" class="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
        {{ error }}
      </div>

      <div class="overflow-x-auto rounded-lg border border-base-content/10 bg-base-100/50">
        <table class="table table-sm">
          <thead>
            <tr>
              <th>{{ $t('host') }}</th>
              <th>{{ $t('current') }}</th>
              <th>{{ $t('hostQosLiveRate') }}</th>
              <th>{{ $t('hostQosSetProfile') }}</th>
              <th class="text-right">{{ $t('actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in filteredRows" :key="row.ip">
              <td class="min-w-[240px]">
                <div class="flex flex-col gap-0.5">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="font-medium">{{ row.displayName || row.hostname || row.ip }}</span>
                    <span v-if="row.currentProfile" class="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium" :class="profilePillClass(row.currentProfile)">
                      <span aria-hidden="true">{{ profileIcon(row.currentProfile) }}</span>
                      <span class="opacity-80">QoS</span>
                      <span class="inline-flex items-end gap-0.5" aria-hidden="true">
                        <span
                          v-for="bar in qosIndicatorBars(row.currentProfile)"
                          :key="`${row.ip}-title-${bar.key}`"
                          class="w-1 rounded-full"
                          :class="bar.active ? profileBarClass(row.currentProfile) : 'bg-base-content/10'"
                          :style="{ height: `${bar.height}px` }"
                        />
                      </span>
                    </span>
                  </div>
                  <span class="font-mono text-[11px] opacity-70">{{ row.ip }}</span>
                  <span v-if="row.mac" class="font-mono text-[11px] opacity-50">{{ row.mac }}</span>
                </div>
              </td>
              <td>
                <span v-if="row.currentProfile" class="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium" :class="profilePillClass(row.currentProfile)">
                  <span aria-hidden="true">{{ profileIcon(row.currentProfile) }}</span>
                  <span class="opacity-80">QoS</span>
                  <span class="inline-flex items-end gap-0.5" aria-hidden="true">
                    <span
                      v-for="bar in qosIndicatorBars(row.currentProfile)"
                      :key="`${row.ip}-current-${bar.key}`"
                      class="w-1 rounded-full"
                      :class="bar.active ? profileBarClass(row.currentProfile) : 'bg-base-content/10'"
                      :style="{ height: `${bar.height}px` }"
                    />
                  </span>
                  <span>{{ profileLabel(row.currentProfile) }}</span>
                </span>
                <span v-else class="text-xs opacity-60">{{ $t('hostQosNotSet') }}</span>
                <div v-if="row.qosMeta" class="mt-1 flex flex-col gap-0.5 text-[11px] opacity-60">
                  <span>{{ $t('hostQosQueuePriority', { priority: row.qosMeta.priority ?? '—' }) }}</span>
                  <span>{{ $t('hostQosGuarantee', { up: row.qosMeta.upMinMbit || 0, down: row.qosMeta.downMinMbit || 0 }) }}</span>
                </div>
              </td>
              <td>
                <div class="flex flex-col gap-0.5 text-[11px] sm:text-xs">
                  <span>↓ {{ formatRate(row.totalDownBps) }}</span>
                  <span>↑ {{ formatRate(row.totalUpBps) }}</span>
                </div>
              </td>
              <td>
                <div class="flex flex-col gap-1">
                  <select v-model="draftProfiles[row.ip]" class="select select-sm min-w-[170px]">
                    <option v-for="profile in profileOrder" :key="`${row.ip}-${profile}`" :value="profile">{{ profileLabel(profile) }}</option>
                  </select>
                  <span class="text-[11px] opacity-60">{{ profileSummary(draftProfiles[row.ip] || 'normal') }}</span>
                  <span
                    v-if="draftProfiles[row.ip] && draftProfiles[row.ip] !== (row.currentProfile || 'normal')"
                    class="text-[11px] opacity-70"
                  >
                    {{ $t('hostQosWillApply', { profile: profileLabel(draftProfiles[row.ip]) }) }}
                  </span>
                </div>
              </td>
              <td>
                <div class="flex justify-end gap-2">
                  <button
                    type="button"
                    class="btn btn-xs"
                    @click="applyRow(row.ip)"
                    :disabled="busyIp === row.ip || !draftProfiles[row.ip]"
                  >
                    <span v-if="busyIp === row.ip" class="loading loading-spinner loading-xs"></span>
                    <span v-else>{{ $t('apply') }}</span>
                  </button>
                  <button
                    type="button"
                    class="btn btn-ghost btn-xs"
                    @click="clearRow(row.ip)"
                    :disabled="busyIp === row.ip || !row.currentProfile"
                  >
                    {{ $t('clear') }}
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!filteredRows.length">
              <td colspan="5" class="py-6 text-center text-sm opacity-60">{{ $t('hostQosNoHosts') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import {
  agentHostTrafficLiveAPI,
  agentLanHostsAPI,
  agentQosStatusAPI,
  agentRemoveHostQosAPI,
  agentSetHostQosAPI,
  agentStatusAPI,
  type AgentHostTrafficLiveItem,
  type AgentLanHost,
  type AgentQosProfile,
  type AgentQosStatus,
  type AgentQosStatusItem,
} from '@/api/agent'
import { getIPLabelFromMap } from '@/helper/sourceip'
import { prettyBytesHelper } from '@/helper/utils'
import { agentEnabled } from '@/store/agent'
import { activeConnections } from '@/store/connections'
import { mergeRouterHostQosAppliedProfiles, routerHostQosAppliedProfiles, routerHostQosDraftProfiles, routerHostQosExpanded, setRouterHostQosAppliedProfile } from '@/store/routerHostQos'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const profileOrder: AgentQosProfile[] = ['critical', 'high', 'elevated', 'normal', 'low', 'background']

type Row = AgentLanHost & AgentHostTrafficLiveItem & {
  currentProfile?: AgentQosProfile
  qosMeta?: AgentQosStatusItem
  displayName?: string
}

const { t } = useI18n()
const loading = ref(false)
const error = ref('')
const query = ref('')
const status = ref<{ ok: boolean; hostQos?: boolean }>({ ok: false })
const qos = ref<AgentQosStatus>({ ok: false, supported: false, items: [] })
const hosts = ref<AgentLanHost[]>([])
const traffic = ref<AgentHostTrafficLiveItem[]>([])
const draftProfiles = routerHostQosDraftProfiles
const appliedProfiles = routerHostQosAppliedProfiles
const busyIp = ref('')
const expanded = routerHostQosExpanded
let timer: number | undefined

const qosMap = computed<Record<string, AgentQosStatusItem>>(() => {
  const out: Record<string, AgentQosStatusItem> = {}
  for (const item of qos.value.items || []) out[item.ip] = item
  return out
})

const rows = computed<Row[]>(() => {
  const hostMap = new Map<string, AgentLanHost>()
  for (const host of hosts.value) hostMap.set(host.ip, host)
  const trafficMap = new Map<string, AgentHostTrafficLiveItem>()
  for (const item of traffic.value) trafficMap.set(item.ip, item)
  const activeConnectionIps = (activeConnections.value || [])
    .map((conn) => String(conn?.metadata?.sourceIP || '').trim())
    .filter(Boolean)

  const ips = new Set<string>([
    ...Array.from(hostMap.keys()),
    ...Array.from(trafficMap.keys()),
    ...Object.keys(qosMap.value),
    ...Object.keys(appliedProfiles.value),
    ...activeConnectionIps,
  ])
  return Array.from(ips)
    .map((ip) => {
      const host = hostMap.get(ip) || ({ ip } as AgentLanHost)
      const live = trafficMap.get(ip) || ({ ip } as AgentHostTrafficLiveItem)
      const meta = qosMap.value[ip]
      const mappedLabel = getIPLabelFromMap(ip)
      const displayName = mappedLabel && mappedLabel !== ip ? mappedLabel : host.hostname || live.hostname || ip
      return {
        ...host,
        ...live,
        ip,
        displayName,
        hostname: host.hostname || live.hostname || '',
        currentProfile: meta?.profile || appliedProfiles.value[ip],
        qosMeta: meta,
      }
    })
    .sort((a, b) => {
      const an = String(a.displayName || a.hostname || a.ip).toLowerCase()
      const bn = String(b.displayName || b.hostname || b.ip).toLowerCase()
      return an.localeCompare(bn)
    })
})

const filteredRows = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return rows.value
  return rows.value.filter((row) => {
    return [row.displayName, row.hostname, row.ip, row.mac, row.currentProfile]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q))
  })
})

const appliedCount = computed(() => (qos.value.items || []).length)

const syncAppliedProfiles = () => {
  const next: Record<string, AgentQosProfile> = {}
  for (const item of qos.value.items || []) {
    if (item?.ip && item?.profile) next[item.ip] = item.profile
  }
  mergeRouterHostQosAppliedProfiles(next)
}

const ensureDrafts = () => {
  const next = { ...draftProfiles.value }
  for (const row of rows.value) {
    if (!next[row.ip]) next[row.ip] = row.currentProfile || appliedProfiles.value[row.ip] || 'normal'
  }
  draftProfiles.value = next
}

const formatRate = (bps?: number) => {
  const n = Number(bps || 0)
  if (!Number.isFinite(n) || n <= 0) return '0 B/s'
  return `${prettyBytesHelper(n)}/s`
}

const profileLabel = (profile?: AgentQosProfile) => {
  if (profile === 'critical') return t('hostQosCritical')
  if (profile === 'high') return t('hostQosHigh')
  if (profile === 'elevated') return t('hostQosElevated')
  if (profile === 'low') return t('hostQosLow')
  if (profile === 'background') return t('hostQosBackground')
  return t('hostQosNormal')
}

const profileIcon = (profile?: AgentQosProfile) => {
  if (profile === 'critical') return '⏫'
  if (profile === 'high') return '⬆'
  if (profile === 'elevated') return '↗'
  if (profile === 'low') return '↘'
  if (profile === 'background') return '⬇'
  return '•'
}

const qosLevel = (profile?: AgentQosProfile) => {
  if (profile === 'critical') return 6
  if (profile === 'high') return 5
  if (profile === 'elevated') return 4
  if (profile === 'low') return 2
  if (profile === 'background') return 1
  return 3
}

const profileBadgeClass = (profile: AgentQosProfile) => {
  if (profile === 'critical') return 'badge-error'
  if (profile === 'high') return 'badge-success'
  if (profile === 'elevated') return 'badge-accent'
  if (profile === 'low') return 'badge-warning'
  if (profile === 'background') return 'badge-ghost'
  return 'badge-info'
}

const profilePillClass = (profile: AgentQosProfile) => {
  if (profile === 'critical') return 'border-error/30 bg-error/10 text-error'
  if (profile === 'high') return 'border-success/30 bg-success/10 text-success'
  if (profile === 'elevated') return 'border-accent/30 bg-accent/10 text-accent'
  if (profile === 'low') return 'border-warning/30 bg-warning/10 text-warning'
  if (profile === 'background') return 'border-base-content/10 bg-base-200/50 text-base-content/70'
  return 'border-info/30 bg-info/10 text-info'
}

const profileBarClass = (profile: AgentQosProfile) => {
  if (profile === 'critical') return 'bg-error'
  if (profile === 'high') return 'bg-success'
  if (profile === 'elevated') return 'bg-accent'
  if (profile === 'low') return 'bg-warning'
  if (profile === 'background') return 'bg-base-content/45'
  return 'bg-info'
}

const qosIndicatorBars = (profile?: AgentQosProfile) => {
  const active = qosLevel(profile)
  return [6, 8, 10, 12, 14, 16].map((height, index) => ({
    key: String(index),
    height,
    active: index < active,
  }))
}

const hasQosDefault = (profile: AgentQosProfile) => Boolean(qos.value.defaults?.[profile])

const profileSummary = (profile: AgentQosProfile) => {
  const item = qos.value.defaults?.[profile]
  if (!item) return '—'
  return `${item.pct || 0}% · prio ${item.priority ?? '—'}`
}

const refreshAll = async () => {
  if (!agentEnabled.value) return
  loading.value = true
  error.value = ''
  try {
    const [st, q, h, tr] = await Promise.all([
      agentStatusAPI(),
      agentQosStatusAPI(),
      agentLanHostsAPI(),
      agentHostTrafficLiveAPI(),
    ])
    status.value = { ok: !!st.ok, hostQos: !!st.hostQos }
    qos.value = q.ok ? q : { ok: false, supported: false, items: [], error: q.error }
    if (q.ok) syncAppliedProfiles()
    hosts.value = h.ok && h.items ? h.items : []
    traffic.value = tr.ok && tr.items ? tr.items : []
    ensureDrafts()
    if (!st.ok) error.value = st.error || t('agentOfflineTip')
    else if (!q.ok) error.value = q.error || t('hostQosStatusFailed')
  } finally {
    loading.value = false
  }
}

const applyRow = async (ip: string) => {
  const profile = draftProfiles.value[ip]
  if (!profile) return
  busyIp.value = ip
  error.value = ''
  try {
    const res = await agentSetHostQosAPI({ ip, profile })
    if (!res.ok) {
      error.value = res.error || t('hostQosApplyFailed')
      return
    }
    setRouterHostQosAppliedProfile(ip, profile)
    draftProfiles.value = { ...draftProfiles.value, [ip]: profile }
    await refreshAll()
  } finally {
    busyIp.value = ''
  }
}

const clearRow = async (ip: string) => {
  busyIp.value = ip
  error.value = ''
  try {
    const res = await agentRemoveHostQosAPI(ip)
    if (!res.ok) {
      error.value = res.error || t('hostQosApplyFailed')
      return
    }
    setRouterHostQosAppliedProfile(ip)
    draftProfiles.value = { ...draftProfiles.value, [ip]: 'normal' }
    await refreshAll()
  } finally {
    busyIp.value = ''
  }
}


watch(rows, () => {
  ensureDrafts()
}, { deep: true })

watch(appliedProfiles, () => {
  ensureDrafts()
}, { deep: true })

const restartPolling = () => {
  if (timer) window.clearInterval(timer)
  timer = undefined
  if (!expanded.value) return
  timer = window.setInterval(() => {
    void refreshAll()
  }, 8000)
}

watch(expanded, async (value) => {
  restartPolling()
  if (value) await refreshAll()
})

onMounted(async () => {
  await refreshAll()
  restartPolling()
})

onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer)
})
</script>
