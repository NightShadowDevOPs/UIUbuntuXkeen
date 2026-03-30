<template>
  <div class="card gap-3 p-3">
    <div class="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <div class="font-semibold">{{ t('hostRuntimeCardTitle') }}</div>
        <div class="text-sm opacity-70">{{ t('hostRuntimeCardTip') }}</div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <span class="badge" :class="status.ok ? 'badge-success' : 'badge-warning'">
          {{ status.ok ? t('online') : t('offline') }}
        </span>
        <span class="badge" :class="mihomoBadgeClass">{{ mihomoBadgeText }}</span>
        <span v-if="resourceSnapshotAtText" class="badge badge-ghost">{{ resourceSnapshotAtText }}</span>
        <button type="button" class="btn btn-sm" @click="refreshAll" :disabled="loading">
          <span v-if="loading" class="loading loading-spinner loading-xs"></span>
          <span v-else>{{ t('refresh') }}</span>
        </button>
      </div>
    </div>

    <div v-if="noticeText" class="rounded-lg border border-base-content/10 bg-base-200/40 px-3 py-2 text-sm opacity-80">
      {{ noticeText }}
    </div>

    <div v-if="errorText" class="alert alert-warning p-2 text-sm">
      <span>{{ errorText }}</span>
    </div>

    <div class="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
      <div class="rounded-lg border border-base-content/10 bg-base-100/50 p-3">
        <div class="text-xs uppercase tracking-[0.12em] opacity-55">CPU</div>
        <div class="mt-2 text-2xl font-semibold">{{ cpuPctText }}</div>
        <div class="mt-2 text-xs opacity-70">
          {{ t('loadAvg1m') }}: <span class="font-mono">{{ load1Text }}</span>
          <span class="opacity-50">·</span>
          {{ t('loadAvg5m') }}: <span class="font-mono">{{ load5Text }}</span>
          <span class="opacity-50">·</span>
          {{ t('loadAvg15m') }}: <span class="font-mono">{{ load15Text }}</span>
        </div>
      </div>

      <div class="rounded-lg border border-base-content/10 bg-base-100/50 p-3">
        <div class="text-xs uppercase tracking-[0.12em] opacity-55">RAM</div>
        <div class="mt-2 text-2xl font-semibold">{{ memPctText }}</div>
        <div class="mt-2 text-xs opacity-70">
          <span class="font-mono">{{ prettyBytes(resources.memUsedBytes) }}</span>
          <span class="opacity-50">/</span>
          <span class="font-mono">{{ prettyBytes(resources.memTotalBytes) }}</span>
          <span class="opacity-50">·</span>
          {{ t('freeMemory') }}: <span class="font-mono">{{ prettyBytes(resources.memAvailableBytes) }}</span>
        </div>
      </div>

      <div class="rounded-lg border border-base-content/10 bg-base-100/50 p-3">
        <div class="text-xs uppercase tracking-[0.12em] opacity-55">{{ t('storage') }}</div>
        <div class="mt-2 text-2xl font-semibold">{{ diskPctText }}</div>
        <div class="mt-2 text-xs opacity-70">
          <span class="font-mono">{{ prettyBytes(resources.diskUsedBytes) }}</span>
          <span class="opacity-50">/</span>
          <span class="font-mono">{{ prettyBytes(resources.diskTotalBytes) }}</span>
          <span class="opacity-50">·</span>
          {{ t('free') }}: <span class="font-mono">{{ prettyBytes(resources.diskFreeBytes) }}</span>
        </div>
        <div v-if="resources.diskPath" class="mt-1 text-[11px] font-mono opacity-60">{{ resources.diskPath }}</div>
      </div>

      <div class="rounded-lg border border-base-content/10 bg-base-100/50 p-3">
        <div class="text-xs uppercase tracking-[0.12em] opacity-55">{{ t('uptime') }}</div>
        <div class="mt-2 text-2xl font-semibold">{{ uptimeText }}</div>
        <div class="mt-2 text-xs opacity-70">
          <span v-if="status.startedAtSec">{{ t('startedAt') }}: {{ startedAtText }}</span>
          <span v-else>{{ t('hostRuntimeNoStartedAt') }}</span>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
      <div v-for="item in infoItems" :key="item.key" class="rounded-lg border border-base-content/10 bg-base-100/40 px-3 py-2">
        <div class="text-[11px] uppercase tracking-wide opacity-60">{{ item.label }}</div>
        <div class="mt-1 break-all font-mono text-xs sm:text-sm">{{ item.value }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  fetchUbuntuSystemResourcesAPI,
  fetchUbuntuSystemStatusAPI,
  type UbuntuSystemResources,
  type UbuntuSystemStatus,
} from '@/api/ubuntuService'
import { fetchVersionSilentAPI } from '@/api'
import { agentStatusAPI } from '@/api/agent'
import { UBUNTU_PATHS } from '@/config/project'
import { isUbuntuServiceBackend } from '@/helper/backend'
import { prettyBytesHelper } from '@/helper/utils'
import { activeBackend } from '@/store/setup'
import { useI18n } from 'vue-i18n'
import dayjs from 'dayjs'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const { t } = useI18n()

const loading = ref(false)
const status = ref<UbuntuSystemStatus>({ ok: false })
const resources = ref<UbuntuSystemResources>({ ok: false })
const isUbuntuService = computed(() => isUbuntuServiceBackend(activeBackend.value))

const prettyBytes = (value: any) => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? prettyBytesHelper(n) : '—'
}

const pctText = (value: any) => {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return '—'
  return `${Math.round(n)}%`
}

const cpuPctText = computed(() => pctText(resources.value.cpuPct))
const memPctText = computed(() => pctText(resources.value.memUsedPct))
const diskPctText = computed(() => pctText(resources.value.diskUsedPct))
const load1Text = computed(() => resources.value.load1 || '—')
const load5Text = computed(() => resources.value.load5 || '—')
const load15Text = computed(() => resources.value.load15 || '—')

const uptimeText = computed(() => {
  const sec = Number(resources.value.uptimeSec || status.value.uptimeSec || 0)
  if (!Number.isFinite(sec) || sec <= 0) return '—'
  const total = Math.floor(sec)
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  if (days > 0) return `${days}d ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
})

const startedAtText = computed(() => {
  const sec = Number(status.value.startedAtSec || 0)
  if (!Number.isFinite(sec) || sec <= 0) return '—'
  return dayjs.unix(sec).format('YYYY-MM-DD HH:mm:ss')
})

const resourceSnapshotAtText = computed(() => {
  const sec = Number(resources.value.updatedAtSec || status.value.updatedAtSec || 0)
  if (!Number.isFinite(sec) || sec <= 0) return ''
  return `${t('lastUpdate')}: ${dayjs.unix(sec).format('HH:mm:ss')}`
})

const mihomoBadgeClass = computed(() => {
  if (status.value.mihomoRunning) return 'badge-success'
  if (status.value.mihomoRunning === false) return 'badge-warning'
  return 'badge-ghost'
})

const mihomoBadgeText = computed(() => {
  if (status.value.mihomoRunning) return t('hostRuntimeMihomoRunning')
  if (status.value.mihomoRunning === false) return t('hostRuntimeMihomoStopped')
  return t('hostRuntimeMihomoUnknown')
})

const noticeText = computed(() => {
  if (!resources.value.ok && status.value.ok) return t('hostRuntimeResourcesPending')
  return ''
})

const errorText = computed(() => {
  const parts = [status.value.error, resources.value.error].map((item) => String(item || '').trim()).filter(Boolean)
  return parts.join(' · ')
})

const infoItems = computed(() => [
  { key: 'hostname', label: t('hostname'), value: status.value.hostname || resources.value.hostname || '—' },
  { key: 'serviceVersion', label: t('agentVersion'), value: status.value.serviceVersion || status.value.version || '—' },
  { key: 'mihomoVersion', label: t('mihomoVersion'), value: status.value.mihomoVersion || '—' },
  { key: 'serviceUnit', label: t('hostRuntimeServiceUnit'), value: status.value.serviceUnit || (isUbuntuService.value ? 'ultra-ui-ubuntu.service' : 'compatibility-bridge') },
  { key: 'platform', label: t('model'), value: resources.value.platform || status.value.platform || '—' },
  { key: 'kernel', label: t('kernel'), value: resources.value.kernel || status.value.kernel || '—' },
  { key: 'arch', label: t('architecture'), value: resources.value.arch || status.value.arch || '—' },
  { key: 'logPath', label: t('hostRuntimeCanonicalLog'), value: status.value.mihomoLogPath || UBUNTU_PATHS.mihomoLog },
  { key: 'serviceStatus', label: t('status'), value: status.value.serviceStatus || '—' },
])

const refreshUbuntu = async () => {
  const [statusPayload, resourcePayload] = await Promise.allSettled([
    fetchUbuntuSystemStatusAPI(),
    fetchUbuntuSystemResourcesAPI(),
  ])

  status.value = statusPayload.status === 'fulfilled' ? statusPayload.value : { ok: false, error: String(statusPayload.reason || 'status-failed') }
  resources.value = resourcePayload.status === 'fulfilled' ? resourcePayload.value : { ok: false, error: String(resourcePayload.reason || 'resources-failed') }
}

const refreshCompatibility = async () => {
  const [agentPayload, versionPayload] = await Promise.allSettled([
    agentStatusAPI(),
    fetchVersionSilentAPI(),
  ])

  const agent = agentPayload.status === 'fulfilled' ? (agentPayload.value || {}) : { ok: false, error: String(agentPayload.reason || 'agent-offline') }
  const versionRes = versionPayload.status === 'fulfilled' ? versionPayload.value : null
  const mihomoVersion = String(versionRes?.data?.version || agent.mihomoBinVersion || '').trim()
  const nowSec = Math.floor(Date.now() / 1000)
  const resourcesOk = Boolean(agent.ok && (agent.cpuPct !== undefined || agent.memTotal !== undefined || agent.storageTotal !== undefined))

  status.value = {
    ok: Boolean(agent.ok || mihomoVersion),
    hostname: agent.hostname,
    serviceVersion: agent.version || agent.serverVersion,
    version: agent.serverVersion || agent.version,
    mihomoVersion: mihomoVersion || undefined,
    mihomoRunning: Boolean(mihomoVersion),
    serviceStatus: agent.ok ? 'active' : mihomoVersion ? 'degraded' : 'offline',
    serviceUnit: 'compatibility-bridge',
    platform: agent.model,
    kernel: agent.kernel,
    arch: agent.arch,
    updatedAtSec: nowSec,
    mihomoLogPath: UBUNTU_PATHS.mihomoLog,
    error: agent.ok || mihomoVersion ? '' : String(agent.error || 'compatibility-bridge-offline'),
  }

  resources.value = {
    ok: resourcesOk,
    hostname: agent.hostname,
    cpuPct: Number.isFinite(Number(agent.cpuPct)) ? Number(agent.cpuPct) : undefined,
    load1: agent.load1,
    load5: agent.load5,
    load15: agent.load15,
    memTotalBytes: Number.isFinite(Number(agent.memTotal)) ? Number(agent.memTotal) : undefined,
    memUsedBytes: Number.isFinite(Number(agent.memUsed)) ? Number(agent.memUsed) : undefined,
    memAvailableBytes: Number.isFinite(Number(agent.memFree)) ? Number(agent.memFree) : undefined,
    memUsedPct: Number.isFinite(Number(agent.memUsedPct)) ? Number(agent.memUsedPct) : undefined,
    diskTotalBytes: Number.isFinite(Number(agent.storageTotal)) ? Number(agent.storageTotal) : undefined,
    diskUsedBytes: Number.isFinite(Number(agent.storageUsed)) ? Number(agent.storageUsed) : undefined,
    diskFreeBytes: Number.isFinite(Number(agent.storageFree)) ? Number(agent.storageFree) : undefined,
    diskUsedPct: Number.isFinite(Number(agent.storageTotal)) && Number(agent.storageTotal) > 0 && Number.isFinite(Number(agent.storageUsed))
      ? (Number(agent.storageUsed) / Number(agent.storageTotal)) * 100
      : undefined,
    diskPath: agent.storagePath,
    uptimeSec: Number.isFinite(Number(agent.uptimeSec)) ? Number(agent.uptimeSec) : 0,
    kernel: agent.kernel,
    arch: agent.arch,
    platform: agent.model,
    updatedAtSec: nowSec,
    error: resourcesOk ? '' : String(agent.error || ''),
  }
}

const refreshAll = async () => {
  loading.value = true
  try {
    if (isUbuntuService.value) {
      await refreshUbuntu()
    } else {
      await refreshCompatibility()
    }
  } finally {
    loading.value = false
  }
}

let timer: number | null = null

onMounted(() => {
  refreshAll()
  timer = window.setInterval(() => {
    refreshAll()
  }, 15000)
})

onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer)
})
</script>
