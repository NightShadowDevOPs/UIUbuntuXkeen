<template>
  <div class="card gap-3 p-3">
    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <div class="font-semibold">{{ $t('routerResources') }}</div>
        <span v-if="agentEnabled && status.ok" class="badge badge-success">{{ $t('online') }}</span>
        <span v-else-if="agentEnabled && !status.ok" class="badge badge-error">{{ $t('offline') }}</span>
        <span v-else class="badge badge-ghost">{{ $t('disabled') }}</span>
      </div>

      <button type="button" class="btn btn-sm" @click="refresh" :disabled="!agentEnabled">
        {{ $t('refresh') }}
      </button>
    </div>

    <div v-if="!agentEnabled" class="text-sm opacity-70">
      {{ $t('agentDisabledTip') }}
    </div>
    <div v-else-if="agentEnabled && !status.ok" class="text-sm opacity-70">
      {{ $t('agentOfflineTip') }}
    </div>

    <template v-else>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div class="flex flex-col gap-1">
          <div class="flex items-center justify-between">
            <div class="text-xs opacity-70">CPU</div>
            <div class="text-sm font-mono">{{ cpuPctText }}</div>
          </div>
          <progress class="progress w-full" :value="status.cpuPct || 0" max="100" />
          <div class="text-[11px] opacity-70">
            {{ $t('loadAvg1m') }}: <span class="font-mono">{{ status.load1 ?? '—' }}</span>
            <span class="opacity-50">·</span>
            {{ $t('loadAvg5m') }}: <span class="font-mono">{{ status.load5 ?? '—' }}</span>
            <span class="opacity-50">·</span>
            {{ $t('loadAvg15m') }}: <span class="font-mono">{{ status.load15 ?? '—' }}</span>
            <span class="opacity-50">·</span>
            {{ $t('uptime') }}: <span class="font-mono">{{ uptimeText }}</span>
          </div>
        </div>

        <div class="flex flex-col gap-1">
          <div class="flex items-center justify-between">
            <div class="text-xs opacity-70">{{ $t('memoryUsage') }}</div>
            <div class="text-sm font-mono">{{ memPctText }}</div>
          </div>
          <progress class="progress w-full" :value="status.memUsedPct || 0" max="100" />
          <div class="text-[11px] opacity-70">
            <span class="font-mono">{{ prettyBytes(status.memUsed) }}</span>
            <span class="opacity-50">/</span>
            <span class="font-mono">{{ prettyBytes(status.memTotal) }}</span>
            <span class="opacity-50">·</span>
            {{ $t('freeMemory') }}: <span class="font-mono">{{ prettyBytes(status.memFree) }}</span>
          </div>
        </div>
      </div>

      <div class="rounded-lg border border-base-content/10 bg-base-200/30 p-3">
        <div class="mb-3 rounded-lg border border-base-content/10 bg-base-100/40 p-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div class="font-medium">{{ $t('firmwareUpdateCheck') }}</div>
              <div class="text-xs opacity-60">{{ $t('firmwareUpdateCheckTip') }}</div>
            </div>
            <div class="flex items-center gap-2">
              <span v-if="firmwareCheck.checkedAt" class="text-[11px] opacity-60">{{ $t('lastCheck') }}: {{ firmwareCheck.checkedAt }}</span>
              <button type="button" class="btn btn-xs" @click="refreshFirmware(true)" :disabled="!agentEnabled || firmwareLoading">
                <span v-if="firmwareLoading" class="loading loading-spinner loading-xs"></span>
                <span v-else>{{ $t('refresh') }}</span>
              </button>
            </div>
          </div>

          <div class="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span class="badge badge-ghost">{{ $t('firmware') }}: {{ firmwareCurrentLabel }}</span>
            <span class="badge" :class="firmwareBadgeClass">{{ firmwareBadgeText }}</span>
            <span v-if="firmwareCheck.latestVersion" class="badge badge-info">site: {{ firmwareCheck.latestVersion }}</span>
            <span v-if="firmwareCheck.mainLatestVersion" class="badge badge-ghost">main: {{ firmwareCheck.mainLatestVersion }}</span>
            <span v-if="firmwareCheck.previewLatestVersion" class="badge badge-ghost">preview: {{ firmwareCheck.previewLatestVersion }}</span>
            <span v-if="firmwareCheck.devLatestVersion" class="badge badge-ghost">dev: {{ firmwareCheck.devLatestVersion }}</span>
            <span v-if="firmwareCheck.channel" class="badge badge-ghost">{{ firmwareCheck.channel }}</span>
            <a v-if="firmwareCheck.sourceUrl" class="link link-hover text-xs" :href="firmwareCheck.sourceUrl" target="_blank" rel="noreferrer">{{ $t('open') }}</a>
          </div>

          <div v-if="firmwareCheck.updateAvailable" class="mt-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
            {{ $t('firmwareUpdateAvailable', { version: firmwareCheck.latestVersion || '—' }) }}
          </div>
          <div v-else-if="firmwareCheck.ok && firmwareCheck.latestVersion" class="mt-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm">
            {{ $t('firmwareUpToDate') }}
          </div>
          <div v-else-if="firmwareCheck.error" class="mt-2 rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm">
            {{ firmwareCheck.error }}
          </div>
        </div>
        <div class="mb-2 flex items-center justify-between gap-2">
          <div class="font-medium">{{ $t('routerInfo') }}</div>
          <div class="text-xs opacity-60">{{ $t('routerInfoTip') }}</div>
        </div>
        <div class="grid grid-cols-1 gap-x-4 gap-y-2 text-sm md:grid-cols-2 xl:grid-cols-3">
          <div v-for="item in infoItems" :key="item.key" class="rounded-lg border border-base-content/10 bg-base-100/40 px-3 py-2">
            <div class="text-[11px] uppercase tracking-wide opacity-60">{{ item.label }}</div>
            <div class="mt-1 break-all font-mono text-xs sm:text-sm">{{ item.value }}</div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { agentFirmwareCheckAPI, agentStatusAPI } from '@/api/agent'
import { version as backendVersion } from '@/api'
import { prettyBytesHelper } from '@/helper/utils'
import { agentEnabled } from '@/store/agent'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

type AgentStatusExt = {
  ok: boolean
  version?: string
  serverVersion?: string
  cpuPct?: number
  load1?: string
  load5?: string
  load15?: string
  uptimeSec?: number
  memTotal?: number
  memUsed?: number
  memFree?: number
  memUsedPct?: number
  storagePath?: string
  storageTotal?: number
  storageUsed?: number
  storageFree?: number
  tempC?: string
  hostname?: string
  model?: string
  firmware?: string
  kernel?: string
  arch?: string
  xkeenVersion?: string
  mihomoBinVersion?: string
  error?: string
}

type FirmwareCheckState = {
  ok: boolean
  currentVersion?: string
  latestVersion?: string
  mainLatestVersion?: string
  previewLatestVersion?: string
  devLatestVersion?: string
  updateAvailable?: boolean
  checkedAt?: string
  sourceUrl?: string
  channel?: string
  cached?: boolean
  stale?: boolean
  error?: string
}

const { t } = useI18n()
const status = ref<AgentStatusExt>({ ok: false })
const firmwareCheck = ref<FirmwareCheckState>({ ok: false })
const firmwareLoading = ref(false)

const prettyBytes = (v: any) => {
  const n = Number(v || 0)
  return prettyBytesHelper(Number.isFinite(n) ? n : 0)
}

const cpuPctText = computed(() => {
  const v = Number(status.value.cpuPct)
  if (!Number.isFinite(v)) return '—'
  return `${Math.round(v)}%`
})

const memPctText = computed(() => {
  const v = Number(status.value.memUsedPct)
  if (!Number.isFinite(v)) return '—'
  return `${Math.round(v)}%`
})

const uptimeText = computed(() => {
  const s = Number(status.value.uptimeSec)
  if (!Number.isFinite(s) || s <= 0) return '—'
  const sec = Math.floor(s)
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (d > 0) return `${d}d ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
})

const firmwareCurrentLabel = computed(() => firmwareCheck.value.currentVersion || status.value.firmware || '—')

const firmwareBadgeClass = computed(() => {
  if (firmwareLoading.value) return 'badge-ghost'
  if (firmwareCheck.value.updateAvailable) return 'badge-warning'
  if (firmwareCheck.value.ok && firmwareCheck.value.latestVersion) return 'badge-success'
  if (firmwareCheck.value.error) return 'badge-error'
  return 'badge-ghost'
})

const firmwareBadgeText = computed(() => {
  if (firmwareLoading.value) return t('checking')
  if (firmwareCheck.value.updateAvailable) return t('firmwareUpdateAvailableShort')
  if (firmwareCheck.value.ok && firmwareCheck.value.latestVersion) return t('firmwareUpToDateShort')
  if (firmwareCheck.value.error) return t('firmwareCheckFailed')
  return t('firmwareCheckUnknown')
})

const refreshFirmware = async (force = false) => {
  if (!agentEnabled.value) {
    firmwareCheck.value = { ok: false }
    return
  }
  firmwareLoading.value = true
  try {
    firmwareCheck.value = await agentFirmwareCheckAPI(force)
  } finally {
    firmwareLoading.value = false
  }
}

const infoItems = computed(() => {
  const backendVer = String(backendVersion.value || '').trim()
  return [
    { key: 'hostname', label: t('hostname'), value: status.value.hostname || '—' },
    { key: 'model', label: t('model'), value: status.value.model || '—' },
    { key: 'agentVersion', label: t('agentVersion'), value: status.value.version || '—' },
    { key: 'agentServerVersion', label: t('agentServerVersion'), value: status.value.serverVersion || '—' },
    { key: 'firmware', label: t('firmware'), value: status.value.firmware || firmwareCheck.value.currentVersion || '—' },
    { key: 'kernel', label: t('kernel'), value: status.value.kernel || '—' },
    { key: 'arch', label: t('architecture'), value: status.value.arch || '—' },
    { key: 'mihomo', label: t('mihomoVersion'), value: status.value.mihomoBinVersion || backendVer || '—' },
    { key: 'xkeen', label: t('xkeenVersion'), value: status.value.xkeenVersion || '—' },
    { key: 'temperature', label: t('temperature'), value: status.value.tempC ? `${status.value.tempC} °C` : '—' },
    { key: 'memoryFree', label: t('freeMemory'), value: prettyBytes(status.value.memFree) },
    { key: 'storage', label: t('storage'), value: status.value.storageTotal
      ? `${prettyBytes(status.value.storageUsed)} / ${prettyBytes(status.value.storageTotal)} · ${t('free')}: ${prettyBytes(status.value.storageFree)}${status.value.storagePath ? ` · ${status.value.storagePath}` : ''}`
      : '—' },
  ]
})

const refresh = async () => {
  if (!agentEnabled.value) {
    status.value = { ok: false }
    return
  }
  status.value = (await agentStatusAPI()) as any
}

let timer: any = null

onMounted(() => {
  refresh()
  refreshFirmware(false)
  timer = setInterval(() => {
    if (agentEnabled.value) refresh()
  }, 10_000)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>
