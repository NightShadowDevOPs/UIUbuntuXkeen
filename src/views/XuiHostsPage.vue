<template>
  <div class="flex h-full flex-col gap-2 overflow-x-hidden overflow-y-auto p-2">
    <div class="rounded-lg border border-base-content/10 bg-base-200/50 px-3 py-2 text-sm">
      <div class="font-semibold">Хосты 3x-ui</div>
      <div class="mt-1 opacity-70">
        Здесь хранятся только адреса панелей 3x-ui для реальных хостов-провайдеров.
        Если server-side backend-маршрут недоступен, экран работает в локальном fallback-режиме: показывает сохранённые URL панелей из UI и не делает вид, что SSL-проверка уже подключена.
      </div>
    </div>

    <div v-if="backendRouteError" class="alert alert-warning text-sm">
      <span>Server-side backend route для 3x-ui Hosts сейчас недоступен: {{ backendRouteError }}. Экран работает в локальном режиме, без живой SSL-проверки.</span>
    </div>

    <div class="card gap-3 p-3">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div class="font-semibold">Контроль сертификатов 3x-ui</div>
          <div class="text-xs opacity-70">
            Дата окончания сертификата и время последней проверки читаются через текущий backend-контур проекта. Проверка идёт отдельным server-side маршрутом этого Ubuntu-хоста. В forced DIRECT backend привязывает probe к физическому интерфейсу хоста и не использует пользовательскую proxy-group. По умолчанию предупреждение срабатывает за {{ sslWarnDaysDefault }} дня(дней); для короткоживущих IP-сертификатов на 6 дней это и есть рабочий ранний сигнал.
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" class="btn btn-sm" @click="runChecksNow" :disabled="checksBusy || saving || !providerActionEnabled">
            <span v-if="checksBusy" class="loading loading-spinner loading-xs"></span>
            <span v-else>{{ t('providerSslChecksRunNow') }}</span>
          </button>
          <button type="button" class="btn btn-sm btn-outline" @click="refreshCacheNow" :disabled="cacheBusy || saving || !providerActionEnabled">
            <span v-if="cacheBusy" class="loading loading-spinner loading-xs"></span>
            <span v-else>{{ t('refreshProviderSslCache') }}</span>
          </button>
          <button type="button" class="btn btn-sm btn-ghost" @click="addRow">{{ t('add') }}</button>
          <button type="button" class="btn btn-sm btn-primary" @click="saveRows" :disabled="saving || checksBusy || cacheBusy || !dirty">
            <span v-if="saving" class="loading loading-spinner loading-xs"></span>
            <span v-else>{{ t('submit') }}</span>
          </button>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2 text-[11px]">
        <span class="badge badge-ghost badge-sm">Хостов: {{ rows.length }}</span>
        <input v-model.trim="filterText" class="input input-bordered input-xs w-48" placeholder="Фильтр по имени / URL" />
        <label class="label cursor-pointer gap-2 rounded-lg border border-base-content/10 px-2 py-1">
          <span class="label-text text-[11px]">Только проблемные</span>
          <input v-model="showOnlyIssues" type="checkbox" class="toggle toggle-xs" />
        </label>
        <span v-if="lastCheckedAtMs" class="badge badge-ghost badge-sm">{{ t('checkedAt') }}: {{ fmtTs(lastCheckedAtMs) }}</span>
        <span v-if="agentProvidersNextCheckAtMs" class="badge badge-ghost badge-sm">{{ t('providerSslChecksNextCheck') }}: {{ fmtTs(agentProvidersNextCheckAtMs) }}</span>
        <span v-if="agentProvidersSslCacheNextRefreshAtMs" class="badge badge-ghost badge-sm">Следующая автопроверка: {{ fmtTs(agentProvidersSslCacheNextRefreshAtMs) }}</span>
        <span class="badge badge-sm" :class="agentProvidersSslCacheFresh ? 'badge-success' : 'badge-warning'">{{ agentProvidersSslCacheFresh ? 'Кэш свежий' : 'Кэш ожидает обновления' }}</span>
        <span v-if="probeRouteText !== '—'" class="badge badge-ghost badge-sm">Маршрут проверки: {{ probeRouteText }}</span>
        <span v-if="agentProvidersProbeHost" class="badge badge-ghost badge-sm">Host: {{ agentProvidersProbeHost }}</span>
        <span v-if="agentProvidersProbeInterface" class="badge badge-ghost badge-sm">iface: {{ agentProvidersProbeInterface }}</span>
        <span v-if="agentProvidersProbeSourceIp" class="badge badge-ghost badge-sm">src: {{ agentProvidersProbeSourceIp }}</span>
        <span v-if="agentProvidersJobStatus" class="badge badge-sm" :class="agentProvidersJobStatus === 'ok' ? 'badge-success' : agentProvidersJobStatus === 'running' ? 'badge-info' : agentProvidersJobStatus === 'error' ? 'badge-error' : 'badge-ghost'">job: {{ agentProvidersJobStatus }}</span>
        <span v-if="agentProvidersSslRefreshing" class="badge badge-info badge-sm">{{ t('providerSslRefreshing') }}</span>
        <span v-if="visibleAgentProvidersError" class="badge badge-error badge-sm">{{ visibleAgentProvidersError }}</span>
      </div>

      <div class="overflow-x-auto">
        <table class="table table-zebra table-sm">
          <thead>
            <tr>
              <th class="w-[180px]">{{ t('provider') }}</th>
              <th>URL панели 3x-ui</th>
              <th class="w-[160px]">{{ t('providerSslStatus') }}</th>
              <th class="w-[180px]">Дата окончания</th>
              <th class="w-[160px]">{{ t('checkedAt') }}</th>
              <th class="w-[180px]">Действия</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in filteredRowsView" :key="row.id">
              <td>
                <input
                  class="input input-bordered input-xs w-full"
                  :value="row.name"
                  @input="setRowName(row.id, ($event.target as HTMLInputElement).value)"
                  placeholder="Имя провайдера"
                />
              </td>
              <td>
                <input
                  class="input input-bordered input-xs w-full font-mono"
                  :value="row.url"
                  @input="setRowUrl(row.id, ($event.target as HTMLInputElement).value)"
                  placeholder="https://panel.example:2053"
                />
              </td>
              <td class="text-xs">
                <div class="flex flex-col gap-1.5">
                  <span class="inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none shadow-sm" :class="row.status.pillCls" :title="row.status.title || row.errorText || ''">{{ row.status.text }}</span>
                  <span class="leading-4 opacity-75">{{ row.status.hint }}</span>
                </div>
              </td>
              <td class="text-xs">{{ row.status.expiresAt || '—' }}</td>
              <td class="text-xs">{{ row.status.checkedAt || '—' }}</td>
              <td>
                <div class="flex flex-wrap gap-1">
                  <button type="button" class="btn btn-ghost btn-xs" @click="openDetails(row)">Детали</button>
                  <button type="button" class="btn btn-ghost btn-xs text-error" @click="removeRow(row.id)">{{ t('delete') }}</button>
                </div>
              </td>
            </tr>
            <tr v-if="!filteredRowsView.length">
              <td colspan="6" class="text-sm opacity-70">Список 3x-ui хостов пока пуст или не совпадает с фильтром.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="detailsRow" class="rounded-xl border border-base-content/10 bg-base-100 p-3">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div class="font-semibold">SSL-детали: {{ detailsRow.name }}</div>
            <div class="mt-1 text-xs opacity-70">{{ detailsRow.url || detailsRow.panelUrl || 'URL панели не задан' }}</div>
          </div>
          <button type="button" class="btn btn-sm btn-ghost" @click="closeDetails">Закрыть</button>
        </div>

        <div class="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <div class="rounded-lg border border-base-content/10 bg-base-200/40 px-3 py-2">
            <div class="text-[11px] uppercase opacity-60">Статус</div>
            <div class="mt-1">
              <span class="inline-flex min-h-6 items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold" :class="detailsRow.status.pillCls">{{ detailsRow.status.text }}</span>
            </div>
          </div>
          <div class="rounded-lg border border-base-content/10 bg-base-200/40 px-3 py-2">
            <div class="text-[11px] uppercase opacity-60">Действует / истекает</div>
            <div class="mt-1 text-sm">{{ detailsRow.validFromLabel || '—' }} → {{ detailsRow.status.expiresAt || '—' }}</div>
            <div class="text-xs opacity-70">Дней осталось: {{ detailsRow.daysLeftLabel }}</div>
          </div>
          <div class="rounded-lg border border-base-content/10 bg-base-200/40 px-3 py-2">
            <div class="text-[11px] uppercase opacity-60">Проверено</div>
            <div class="mt-1 text-sm">{{ detailsRow.status.checkedAt || '—' }}</div>
          </div>
          <div class="rounded-lg border border-base-content/10 bg-base-200/40 px-3 py-2">
            <div class="text-[11px] uppercase opacity-60">Источник</div>
            <div class="mt-1 text-sm">{{ detailsRow.status.source || '—' }}</div>
            <div class="text-xs opacity-70">{{ probeRouteText }}</div>
          </div>
        </div>

        <div class="mt-3 grid gap-2 md:grid-cols-2">
          <div class="rounded-lg border border-base-content/10 bg-base-200/30 px-3 py-2">
            <div class="text-[11px] uppercase opacity-60">Issuer</div>
            <div class="mt-1 break-all text-xs">{{ detailsRow.issuer || '—' }}</div>
          </div>
          <div class="rounded-lg border border-base-content/10 bg-base-200/30 px-3 py-2">
            <div class="text-[11px] uppercase opacity-60">Subject</div>
            <div class="mt-1 break-all text-xs">{{ detailsRow.subject || '—' }}</div>
          </div>
          <div class="rounded-lg border border-base-content/10 bg-base-200/30 px-3 py-2 md:col-span-2">
            <div class="text-[11px] uppercase opacity-60">SAN</div>
            <div class="mt-1 break-all text-xs">{{ detailsRow.sanText || '—' }}</div>
          </div>
          <div class="rounded-lg border border-base-content/10 bg-base-200/30 px-3 py-2 md:col-span-2">
            <div class="text-[11px] uppercase opacity-60">Fingerprint SHA-256</div>
            <div class="mt-1 break-all font-mono text-[11px]">{{ detailsRow.fingerprintSha256 || '—' }}</div>
          </div>
          <div class="rounded-lg border border-base-content/10 bg-base-200/30 px-3 py-2 md:col-span-2">
            <div class="text-[11px] uppercase opacity-60">Проверка TLS / цепочки</div>
            <div class="mt-1 break-all text-xs">{{ detailsRow.verifyError || '—' }}</div>
          </div>
          <div class="rounded-lg border border-base-content/10 bg-base-200/30 px-3 py-2 md:col-span-2">
            <div class="text-[11px] uppercase opacity-60">Последняя ошибка</div>
            <div class="mt-1 break-all text-xs">{{ detailsRow.errorText || '—' }}</div>
          </div>
        </div>

        <div v-if="detailsRow.lastSuccess" class="mt-3 rounded-lg border border-success/30 bg-success/10 p-3">
          <div class="font-medium text-success">Последний успешный сертификат</div>
          <div class="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <div class="rounded-lg border border-base-content/10 bg-base-100/60 px-3 py-2">
              <div class="text-[11px] uppercase opacity-60">Действует / истекает</div>
              <div class="mt-1 text-sm">{{ detailsRow.lastSuccess.validFromLabel || '—' }} → {{ detailsRow.lastSuccess.expiresAt || '—' }}</div>
            </div>
            <div class="rounded-lg border border-base-content/10 bg-base-100/60 px-3 py-2">
              <div class="text-[11px] uppercase opacity-60">Последняя удачная проверка</div>
              <div class="mt-1 text-sm">{{ detailsRow.lastSuccess.checkedAt || '—' }}</div>
            </div>
            <div class="rounded-lg border border-base-content/10 bg-base-100/60 px-3 py-2">
              <div class="text-[11px] uppercase opacity-60">Issuer</div>
              <div class="mt-1 break-all text-xs">{{ detailsRow.lastSuccess.issuer || '—' }}</div>
            </div>
            <div class="rounded-lg border border-base-content/10 bg-base-100/60 px-3 py-2">
              <div class="text-[11px] uppercase opacity-60">SAN</div>
              <div class="mt-1 break-all text-xs">{{ detailsRow.lastSuccess.sanText || '—' }}</div>
            </div>
          </div>
        </div>

        <div class="mt-3 rounded-lg border border-base-content/10 bg-base-200/20 p-3">
          <div class="mb-2 flex items-center justify-between gap-2">
            <div class="font-medium">История последних SSL-проверок</div>
            <button type="button" class="btn btn-xs btn-outline" @click="reloadDetailsHistory" :disabled="detailsLoading">
              <span v-if="detailsLoading" class="loading loading-spinner loading-xs"></span>
              <span v-else>Обновить историю</span>
            </button>
          </div>
          <div v-if="detailsError" class="mb-2 text-xs text-error">{{ detailsError }}</div>
          <div class="overflow-x-auto">
            <table class="table table-xs">
              <thead>
                <tr>
                  <th>Проверено</th>
                  <th>Статус</th>
                  <th>Истекает</th>
                  <th>Дней</th>
                  <th>Ошибка</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in detailsHistory" :key="`${item.checkedAtSec}-${item.status}-${item.panelUrl}`">
                  <td>{{ fmtTs(item.checkedAtSec ? item.checkedAtSec * 1000 : 0) }}</td>
                  <td>{{ item.status || '—' }}</td>
                  <td>{{ formatIsoDate(item.expiresAt) }}</td>
                  <td>{{ Number.isFinite(item.daysLeft) ? item.daysLeft : '—' }}</td>
                  <td class="max-w-[320px] truncate" :title="item.error || ''">{{ item.error || '—' }}</td>
                </tr>
                <tr v-if="!detailsHistory.length && !detailsLoading">
                  <td colspan="5" class="text-xs opacity-70">История ещё не накоплена.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  fetchUbuntuProviderChecksHistoryAPI,
  fetchUbuntuProviderChecksAPI,
  fetchUbuntuProvidersAPI,
  refreshUbuntuProviderSslCacheAPI,
  runUbuntuProviderChecksAPI,
  saveUbuntuProvidersAPI,
} from '@/api/ubuntuService'
import { proxyProviderPanelUrlMap, sslNearExpiryDaysDefault } from '@/store/settings'
import { providerSslDbMeta, providerSslDbSnapshot } from '@/store/providerSslDb'
import {
  agentProviderByName,
  agentProvidersAt,
  agentProvidersError,
  agentProvidersJobStatus,
  agentProvidersNextCheckAtMs,
  agentProvidersProbeHost,
  agentProvidersProbeInterface,
  agentProvidersProbeSourceIp,
  agentProvidersProbeSource,
  agentProvidersSslCacheFresh,
  agentProvidersSslCacheNextRefreshAtMs,
  agentProvidersSslRefreshing,
  fetchAgentProviders,
  providerHealthActionsAvailable,
  refreshAgentProviderSslCache,
  runAgentProviderChecks,
} from '@/store/providerHealth'
import { getProviderSslDiagnostics } from '@/helper/providerHealth'
import { activeBackendCapabilities, activeBackendCapabilitiesError, activeBackendCapabilitiesUpdatedAt, refreshActiveBackendCapabilities } from '@/store/backendCapabilities'
import { activeBackend } from '@/store/setup'
import { detectBackendKind } from '@/helper/backend'
import { BACKEND_KINDS } from '@/config/backendContract'

const { t } = useI18n()
const checksBusy = ref(false)
const cacheBusy = ref(false)
const saving = ref(false)
const rows = ref<Array<{ id: string; name: string; url: string }>>([])
const dirty = ref(false)
const loadingBackendRows = ref(false)
const filterText = ref('')
const showOnlyIssues = ref(false)
const detailsOpenName = ref('')
const detailsHistory = ref<any[]>([])
const detailsLoading = ref(false)
const detailsError = ref('')

const useBackendProviders = computed(() => {
  if (detectBackendKind(activeBackend.value) === BACKEND_KINDS.UBUNTU_SERVICE) return true
  const caps = activeBackendCapabilities.value || {}
  return Boolean(caps.providers || caps.providerChecks || caps.providerSslCacheStatus)
})

const backendRouteError = computed(() => {
  if (detectBackendKind(activeBackend.value) === BACKEND_KINDS.UBUNTU_SERVICE) return ''
  return String(activeBackendCapabilitiesError.value || '').trim()
})

const providerActionEnabled = computed(() => {
  if (detectBackendKind(activeBackend.value) === BACKEND_KINDS.UBUNTU_SERVICE) return true
  if (useBackendProviders.value) return true
  if (providerHealthActionsAvailable.value) return true
  const caps = activeBackendCapabilities.value || {}
  return Boolean((caps as any)?.providerChecksRun || (caps as any)?.providerSslCacheRefresh || (caps as any)?.providerRefresh)
})

const visibleAgentProvidersError = computed(() => {
  const raw = String(agentProvidersError.value || '').trim()
  if (!raw) return ''
  if (detectBackendKind(activeBackend.value) === BACKEND_KINDS.UBUNTU_SERVICE && raw.toLowerCase().includes('capability-missing')) return ''
  return raw
})

const normalizeUrl = (raw: string) => {
  const value = String(raw || '').trim()
  if (!value) return ''
  if (/^(https?|wss):\/\//i.test(value)) return value
  return `https://${value}`
}

const buildMergedRows = (sources: Array<Array<{ name?: string; panelUrl?: string; url?: string }>>) => {
  const byName = new Map<string, { id: string; name: string; url: string }>()

  for (const source of sources) {
    for (const item of source || []) {
      const name = String(item?.name || '').trim()
      if (!name) continue
      const nextUrl = normalizeUrl(String(item?.panelUrl || item?.url || '').trim())
      const current = byName.get(name)
      byName.set(name, {
        id: current?.id || `${name}-${byName.size}`,
        name,
        url: nextUrl || current?.url || '',
      })
    }
  }

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
}

const syncRowsFromStore = () => {
  if (useBackendProviders.value) return
  const localRows = Object.entries(proxyProviderPanelUrlMap.value || {}).map(([name, url]) => ({ name, url }))
  const agentRows = Object.keys(agentProviderByName.value || {}).map((name) => ({
    name,
    panelUrl: String((agentProviderByName.value as any)?.[name]?.panelUrl || '').trim(),
  }))
  const snapshotRows = Object.keys(providerSslDbSnapshot.value || {}).map((name) => ({
    name,
    panelUrl: String((providerSslDbSnapshot.value as any)?.[name]?.panelUrl || '').trim(),
  }))
  rows.value = buildMergedRows([agentRows, snapshotRows, localRows])
  dirty.value = false
}

watch(proxyProviderPanelUrlMap, syncRowsFromStore, { immediate: true, deep: true })

const reflectRowsToLocalCache = (items: Array<{ name: string; panelUrl?: string; url?: string }>) => {
  const next: Record<string, string> = {}
  for (const item of items) {
    const name = String(item.name || '').trim()
    const url = normalizeUrl(String(item.panelUrl || item.url || '').trim())
    if (!name || !url) continue
    next[name] = url
  }
  proxyProviderPanelUrlMap.value = next
}

const loadRowsFromBackend = async () => {
  const activeKind = detectBackendKind(activeBackend.value)

  loadingBackendRows.value = true
  try {
    const fetched = await fetchUbuntuProvidersAPI()
    const normalizedFetched = buildMergedRows([fetched as any[]])

    if (normalizedFetched.length) {
      rows.value = normalizedFetched
      reflectRowsToLocalCache(rows.value as any[])
      dirty.value = false
      return
    }

    const localRows = Object.entries(proxyProviderPanelUrlMap.value || {}).map(([name, url]) => ({ name, url }))
    const agentRows = Object.keys(agentProviderByName.value || {}).map((name) => ({
      name,
      panelUrl: String((agentProviderByName.value as any)?.[name]?.panelUrl || '').trim(),
    }))
    const snapshotRows = Object.keys(providerSslDbSnapshot.value || {}).map((name) => ({
      name,
      panelUrl: String((providerSslDbSnapshot.value as any)?.[name]?.panelUrl || '').trim(),
    }))
    let merged = buildMergedRows([agentRows, snapshotRows, localRows])
    if (!fetched.length && merged.length && activeKind === BACKEND_KINDS.UBUNTU_SERVICE) {
      try {
        const saved = await saveUbuntuProvidersAPI(merged.map((row) => ({ name: row.name, panelUrl: row.url, enabled: true })))
        merged = buildMergedRows([saved as any[]])
        await fetchAgentProviders(true)
      } catch {
        // keep merged fallback rows
      }
    }
    rows.value = merged
    reflectRowsToLocalCache(rows.value as any[])
    dirty.value = false
  } catch {
    syncRowsFromStore()
  } finally {
    loadingBackendRows.value = false
  }
}

watch(useBackendProviders, () => {
  loadRowsFromBackend()
}, { immediate: true })

watch(() => activeBackend.value?.uuid || '', () => {
  loadRowsFromBackend()
}, { immediate: true })

watch(activeBackendCapabilitiesUpdatedAt, () => {
  if (dirty.value || loadingBackendRows.value) return
  if (detectBackendKind(activeBackend.value) !== BACKEND_KINDS.UBUNTU_SERVICE) return
  loadRowsFromBackend()
})

watch(agentProvidersAt, () => {
  if (dirty.value || loadingBackendRows.value) return
  loadRowsFromBackend()
})

watch(rows, () => {
  if (detailsOpenName.value && !rows.value.some((row) => String(row.name || '').trim() === String(detailsOpenName.value || '').trim())) {
    closeDetails()
  }
}, { deep: true })

const addRow = () => {
  rows.value = [...rows.value, { id: `new-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`, name: '', url: '' }]
  dirty.value = true
}

const removeRow = (id: string) => {
  rows.value = rows.value.filter((row) => row.id !== id)
  dirty.value = true
}

const setRowName = (id: string, value: string) => {
  rows.value = rows.value.map((row) => row.id === id ? { ...row, name: value } : row)
  dirty.value = true
}

const setRowUrl = (id: string, value: string) => {
  rows.value = rows.value.map((row) => row.id === id ? { ...row, url: value } : row)
  dirty.value = true
}

const saveRows = async () => {
  saving.value = true
  try {
    const next = rows.value
      .map((row) => ({ name: String(row.name || '').trim(), panelUrl: normalizeUrl(row.url), enabled: true }))
      .filter((row) => row.name && row.panelUrl)

    if (useBackendProviders.value) {
      const saved = await saveUbuntuProvidersAPI(next)
      const agentRows = Object.keys(agentProviderByName.value || {}).map((name) => ({
        name,
        panelUrl: String((agentProviderByName.value as any)?.[name]?.panelUrl || '').trim(),
      }))
      rows.value = buildMergedRows([agentRows, saved as any[]])
      reflectRowsToLocalCache(rows.value as any[])
      dirty.value = false
      await refreshAgentProviderSslCache()
      await fetchAgentProviders(true)
      if (detailsOpenName.value) await loadProviderHistory(detailsOpenName.value)
      return
    }

    proxyProviderPanelUrlMap.value = Object.fromEntries(next.map((row) => [row.name, row.panelUrl]))
    syncRowsFromStore()
  } finally {
    saving.value = false
  }
}

const fmtTs = (value?: number) => {
  if (!value) return '—'
  return dayjs(value).format('DD.MM.YYYY HH:mm')
}

const lastCheckedAtMs = computed(() => {
  return Number(agentProvidersAt.value || providerSslDbMeta.value?.checkedAtMs || 0)
})

const formatIsoDate = (value?: string) => {
  const raw = String(value || '').trim()
  if (!raw) return '—'
  const d = dayjs(raw)
  return d.isValid() ? d.format('DD.MM.YYYY HH:mm') : raw
}

const normalizeSanText = (value: any) => {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean).join(', ')
  return String(value || '').trim()
}

const friendlyTlsError = (value: any) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const lowered = raw.toLowerCase()
  if (lowered.includes('handshake operation timed out') || lowered.includes('ssl connection timeout') || lowered.includes('handshake operation timed ot') || lowered.includes('timed out')) {
    return 'TLS timeout'
  }
  if (lowered.includes('certificate verify failed')) return 'Ошибка проверки сертификата'
  if (lowered.includes('wrong version number')) return 'Неверная версия TLS'
  if (lowered.includes('connection refused')) return 'Соединение отклонено'
  return raw
}

const sslStatusPillCls = (kind: string) => {
  if (kind === 'healthy') return 'border-success/70 bg-success text-success-content'
  if (kind === 'warning') return 'border-warning/70 bg-warning text-warning-content'
  if (kind === 'expired') return 'border-error/70 bg-error text-error-content'
  if (kind === 'refreshing') return 'border-info/70 bg-info text-info-content'
  if (kind === 'error') return 'border-error/70 bg-error text-error-content'
  return 'border-base-content/20 bg-base-200 text-base-content'
}

const extractLastSuccess = (item: any) => {
  const expiresAt = String(item?.panelSslLastSuccessNotAfter || '').trim()
  if (!expiresAt) return null
  const checkedAtSec = Number(item?.panelSslLastSuccessCheckedAtSec || 0)
  return {
    expiresAt: formatIsoDate(expiresAt),
    checkedAt: checkedAtSec > 0 ? fmtTs(checkedAtSec * 1000) : '',
    issuer: String(item?.panelSslLastSuccessIssuer || '').trim(),
    subject: String(item?.panelSslLastSuccessSubject || '').trim(),
    sanText: normalizeSanText(item?.panelSslLastSuccessSan),
    validFromLabel: formatIsoDate(String(item?.panelSslLastSuccessValidFrom || '').trim()),
  }
}

const sslWarnDaysDefault = computed(() => {
  const raw = Number(sslNearExpiryDaysDefault.value || 2)
  return Number.isFinite(raw) ? Math.max(0, Math.trunc(raw)) : 2
})

const probeRouteText = computed(() => {
  const source = String(agentProvidersProbeSource.value || '').trim()
  if (!source) return '—'
  if (source === 'forced-direct') {
    const parts = [agentProvidersProbeInterface.value, agentProvidersProbeSourceIp.value].filter(Boolean)
    return parts.length ? `forced DIRECT · ${parts.join(' · ')}` : 'forced DIRECT этого хоста'
  }
  if (source === 'system-route') return 'system route этого хоста'
  return source
})

const sourceLabel = (value: string, fromLastSuccess = false) => {
  if (fromLastSuccess) return t('providerSslSourceLastSuccess')
  if (value === 'panel-probe') return t('providerSslSourcePanelProbe')
  if (value === 'panel') return t('providerSslSourcePanelUrl')
  if (value === 'provider') return t('providerSslSourceProviderUrl')
  if (value === 'subscription') return t('providerSslSourceSubscription')
  return t('providerSslSourceUnknown')
}

const issueStatuses = new Set(['warning', 'expired', 'error'])

const loadProviderHistory = async (name: string) => {
  detailsLoading.value = true
  detailsError.value = ''
  try {
    detailsHistory.value = await fetchUbuntuProviderChecksHistoryAPI(name, 12)
  } catch (error: any) {
    detailsHistory.value = []
    detailsError.value = String(error?.message || error || 'history-load-failed')
  } finally {
    detailsLoading.value = false
  }
}

const rowsView = computed(() => {
  return rows.value.map((row) => {
    const name = String(row.name || '').trim()
    const url = normalizeUrl(row.url)
    const item = (agentProviderByName.value || {})[name] || (providerSslDbSnapshot.value || {})[name] || {}
    const diag = getProviderSslDiagnostics({}, item, {
      panelUrlOverride: url,
      sslRefreshing: agentProvidersSslRefreshing.value,
      nearExpiryDays: sslWarnDaysDefault.value,
    })

    const lastSuccess = extractLastSuccess(item)
    const friendlyError = friendlyTlsError(diag.error)
    let pillCls = sslStatusPillCls('unknown')
    let text = 'Нет данных'
    let title = ''
    let hint = lastSuccess ? 'Есть последний успешный сертификат' : 'Нет данных по сертификату'
    if (diag.status === 'refreshing') {
      pillCls = sslStatusPillCls('refreshing')
      text = t('providerSslRefreshing')
      hint = 'Идёт обновление SSL-кеша на backend'
    } else if (diag.status === 'healthy') {
      pillCls = sslStatusPillCls('healthy')
      text = 'OK'
      hint = probeRouteText.value === '—' ? 'Проверка прошла с этого хоста' : `Проверка прошла через ${probeRouteText.value}`
    } else if (diag.status === 'warning') {
      pillCls = sslStatusPillCls('warning')
      text = 'Истекает'
      hint = 'Сертификат скоро истекает'
    } else if (diag.status === 'expired') {
      pillCls = sslStatusPillCls('expired')
      text = 'Истёк'
      hint = 'Сертификат уже истёк'
    } else if (diag.error) {
      pillCls = sslStatusPillCls('error')
      const rawError = String(diag.error || '').trim().toLowerCase()
      text = friendlyError || 'Ошибка TLS'
      title = diag.error
      if (rawError.includes('timed out')) hint = `Порт отвечает, но TLS-рукопожатие не завершилось через ${probeRouteText.value || 'этот маршрут'}`
      else if (rawError.includes('connection refused')) hint = 'Удалённый endpoint отклонил соединение'
      else hint = friendlyError || 'Ошибка TLS/SSL'
    }

    return {
      ...row,
      panelUrl: String(item?.panelUrl || url || '').trim(),
      issuer: String(item?.panelSslIssuer || '').trim(),
      subject: String(item?.panelSslSubject || '').trim(),
      sanText: normalizeSanText(item?.panelSslSan),
      validFrom: String(item?.panelSslValidFrom || '').trim(),
      validFromLabel: formatIsoDate(String(item?.panelSslValidFrom || '').trim()),
      fingerprintSha256: String(item?.panelSslFingerprintSha256 || '').trim(),
      verifyError: String(item?.panelSslVerifyError || '').trim(),
      errorText: String(item?.panelSslError || diag.error || '').trim(),
      daysLeft: Number.isFinite(Number(item?.panelSslDaysLeft)) ? Number(item?.panelSslDaysLeft) : null,
      daysLeftLabel: Number.isFinite(Number(item?.panelSslDaysLeft)) ? String(Number(item?.panelSslDaysLeft)) : '—',
      lastSuccess,
      status: {
        pillCls,
        text,
        title,
        source: sourceLabel(String(diag.source || ''), Boolean(lastSuccess && !diag.dateTime)),
        key: diag.status || '',
        expiresAt: diag.dateTime ? diag.dateTime.replace(/^(\d{2})-(\d{2})-(\d{4})/, '$1.$2.$3') : '',
        checkedAt: diag.checkedAtMs ? fmtTs(diag.checkedAtMs) : fmtTs(lastCheckedAtMs.value),
        hint,
      },
    }
  })
})

const filteredRowsView = computed(() => {
  const q = String(filterText.value || '').trim().toLowerCase()
  return rowsView.value.filter((row: any) => {
    const issueMatch = !showOnlyIssues.value || issueStatuses.has(String(row?.status?.key || '').trim()) || !!String(row?.errorText || '').trim()
    if (!issueMatch) return false
    if (!q) return true
    return [row.name, row.url, row.panelUrl, row.issuer, row.subject, row.sanText].some((item: any) => String(item || '').toLowerCase().includes(q))
  })
})

const detailsRow = computed(() => rowsView.value.find((row: any) => String(row.name || '') === String(detailsOpenName.value || '')) || null)

const openDetails = async (row: any) => {
  detailsOpenName.value = String(row?.name || '')
  await loadProviderHistory(detailsOpenName.value)
}

const closeDetails = () => {
  detailsOpenName.value = ''
  detailsHistory.value = []
  detailsError.value = ''
}

const reloadDetailsHistory = async () => {
  if (!detailsOpenName.value) return
  await loadProviderHistory(detailsOpenName.value)
}

const hasProviderSslSnapshot = () => {
  return Array.isArray(agentProviders.value) && agentProviders.value.some((item: any) => {
    const expires = String((item as any)?.panelSslNotAfter || '').trim()
    const issuer = String((item as any)?.panelSslIssuer || '').trim()
    const status = String((item as any)?.panelSslStatus || '').trim()
    const error = String((item as any)?.panelSslError || '').trim()
    return Boolean(expires || issuer || error || (status && status !== 'unknown'))
  })
}

const waitForProviderRuntimeSettlement = async (timeoutMs = 90000, intervalMs = 1500) => {
  const startedAt = Date.now()
  let sawBusy = false
  while (Date.now() - startedAt < timeoutMs) {
    await fetchAgentProviders(true)
    const busy = Boolean(agentProvidersSslRefreshing.value || agentProvidersSslRefreshPending.value || agentProvidersJobStatus.value === 'running')
    if (busy) sawBusy = true
    if (sawBusy) {
      if (!busy) break
    } else if (hasProviderSslSnapshot() || agentProvidersJobStatus.value === 'ok' || visibleAgentProvidersError.value) {
      break
    }
    await new Promise((resolve) => window.setTimeout(resolve, intervalMs))
  }
}

const refreshProviderRuntimeView = async (force = true) => {
  await refreshActiveBackendCapabilities(true)
  if (useBackendProviders.value) {
    try {
      if (detectBackendKind(activeBackend.value) === BACKEND_KINDS.UBUNTU_SERVICE) {
        await fetchUbuntuProviderChecksAPI()
      }
    } catch {
      // state is refreshed below via store fetch
    }
  }
  await fetchAgentProviders(force)
  if (useBackendProviders.value) await loadRowsFromBackend()
  if (detailsOpenName.value) await loadProviderHistory(detailsOpenName.value)
}

const invokeProviderRuntimeAction = async (mode: 'checks' | 'cache') => {
  if (dirty.value) await saveRows()
  await refreshActiveBackendCapabilities(true)

  if (detectBackendKind(activeBackend.value) === BACKEND_KINDS.UBUNTU_SERVICE) {
    if (mode === 'checks') {
      await runUbuntuProviderChecksAPI()
    } else {
      await refreshUbuntuProviderSslCacheAPI()
    }
    await waitForProviderRuntimeSettlement()
    await refreshProviderRuntimeView(true)
    return
  }

  if (mode === 'checks') {
    await runAgentProviderChecks()
  } else {
    await refreshAgentProviderSslCache()
  }
  await refreshProviderRuntimeView(true)
}

const runChecksNow = async () => {
  checksBusy.value = true
  try {
    await invokeProviderRuntimeAction('checks')
  } finally {
    checksBusy.value = false
  }
}

const refreshCacheNow = async () => {
  cacheBusy.value = true
  try {
    await invokeProviderRuntimeAction('cache')
  } finally {
    cacheBusy.value = false
  }
}

onMounted(async () => {
  await loadRowsFromBackend()
  await refreshProviderRuntimeView(false)
  if (detectBackendKind(activeBackend.value) === BACKEND_KINDS.UBUNTU_SERVICE && !rows.value.length) {
    await loadRowsFromBackend()
  }
  if (useBackendProviders.value && rows.value.length && !lastCheckedAtMs.value) {
    await invokeProviderRuntimeAction('cache')
  }
})
</script>
