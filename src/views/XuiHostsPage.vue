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
            Дата окончания сертификата и время последней проверки читаются через текущий backend-контур проекта. По умолчанию предупреждение срабатывает за {{ sslWarnDaysDefault }} дня(дней); для короткоживущих IP-сертификатов на 6 дней это и есть рабочий ранний сигнал.
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" class="btn btn-sm" @click="runChecksNow" :disabled="checksBusy || !providerHealthActionsAvailable">
            <span v-if="checksBusy" class="loading loading-spinner loading-xs"></span>
            <span v-else>{{ t('providerSslChecksRunNow') }}</span>
          </button>
          <button type="button" class="btn btn-sm btn-outline" @click="refreshCacheNow" :disabled="cacheBusy || !providerHealthActionsAvailable">
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
        <span v-if="agentProvidersJobStatus" class="badge badge-sm" :class="agentProvidersJobStatus === 'ok' ? 'badge-success' : agentProvidersJobStatus === 'running' ? 'badge-info' : agentProvidersJobStatus === 'error' ? 'badge-error' : 'badge-ghost'">job: {{ agentProvidersJobStatus }}</span>
        <span v-if="agentProvidersSslRefreshing" class="badge badge-info badge-sm">{{ t('providerSslRefreshing') }}</span>
        <span v-if="agentProvidersError" class="badge badge-error badge-sm">{{ agentProvidersError }}</span>
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
              <td>
                <span class="badge badge-sm" :class="row.status.badgeCls">{{ row.status.text }}</span>
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
              <span class="badge badge-sm" :class="detailsRow.status.badgeCls">{{ detailsRow.status.text }}</span>
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
import { fetchUbuntuProviderChecksHistoryAPI, fetchUbuntuProvidersAPI, saveUbuntuProvidersAPI } from '@/api/ubuntuService'
import { proxyProviderPanelUrlMap, sslNearExpiryDaysDefault } from '@/store/settings'
import { providerSslDbMeta, providerSslDbSnapshot } from '@/store/providerSslDb'
import {
  agentProviderByName,
  agentProvidersAt,
  agentProvidersError,
  agentProvidersJobStatus,
  agentProvidersNextCheckAtMs,
  agentProvidersSslCacheFresh,
  agentProvidersSslCacheNextRefreshAtMs,
  agentProvidersSslRefreshing,
  fetchAgentProviders,
  providerHealthActionsAvailable,
  refreshAgentProviderSslCache,
  runAgentProviderChecks,
} from '@/store/providerHealth'
import { getProviderSslDiagnostics } from '@/helper/providerHealth'
import { activeBackendCapabilities, activeBackendCapabilitiesError } from '@/store/backendCapabilities'

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
  const caps = activeBackendCapabilities.value || {}
  return Boolean(caps.providers || caps.providerChecks || caps.providerSslCacheStatus)
})

const backendRouteError = computed(() => String(activeBackendCapabilitiesError.value || '').trim())

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
  rows.value = buildMergedRows([agentRows, localRows])
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
  if (!useBackendProviders.value) {
    syncRowsFromStore()
    return
  }
  loadingBackendRows.value = true
  try {
    const items = await fetchUbuntuProvidersAPI()
    const localRows = Object.entries(proxyProviderPanelUrlMap.value || {}).map(([name, url]) => ({ name, url }))
    const agentRows = Object.keys(agentProviderByName.value || {}).map((name) => ({
      name,
      panelUrl: String((agentProviderByName.value as any)?.[name]?.panelUrl || '').trim(),
    }))
    rows.value = buildMergedRows([agentRows, items as any[], localRows])
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

const sslWarnDaysDefault = computed(() => {
  const raw = Number(sslNearExpiryDaysDefault.value || 2)
  return Number.isFinite(raw) ? Math.max(0, Math.trunc(raw)) : 2
})

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

    let badgeCls = 'badge-ghost'
    let text = 'Нет данных'
    if (diag.status === 'refreshing') {
      badgeCls = 'badge-info'
      text = t('providerSslRefreshing')
    } else if (diag.status === 'healthy') {
      badgeCls = 'badge-success'
      text = 'OK'
    } else if (diag.status === 'warning') {
      badgeCls = 'badge-warning'
      text = 'Скоро истекает'
    } else if (diag.status === 'expired') {
      badgeCls = 'badge-error'
      text = 'Просрочен'
    } else if (diag.error) {
      badgeCls = 'badge-error'
      text = diag.error
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
      status: {
        badgeCls,
        text,
        source: diag.source || '',
        key: diag.status || '',
        expiresAt: diag.dateTime ? diag.dateTime.replace(/^(\d{2})-(\d{2})-(\d{4})/, '$1.$2.$3') : '',
        checkedAt: diag.checkedAtMs ? fmtTs(diag.checkedAtMs) : fmtTs(lastCheckedAtMs.value),
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

const runChecksNow = async () => {
  checksBusy.value = true
  try {
    if (dirty.value) await saveRows()
    await runAgentProviderChecks()
    await fetchAgentProviders(true)
    if (useBackendProviders.value) await loadRowsFromBackend()
    if (detailsOpenName.value) await loadProviderHistory(detailsOpenName.value)
  } finally {
    checksBusy.value = false
  }
}

const refreshCacheNow = async () => {
  cacheBusy.value = true
  try {
    if (dirty.value) await saveRows()
    await refreshAgentProviderSslCache()
    await fetchAgentProviders(true)
    if (useBackendProviders.value) await loadRowsFromBackend()
    if (detailsOpenName.value) await loadProviderHistory(detailsOpenName.value)
  } finally {
    cacheBusy.value = false
  }
}

onMounted(async () => {
  await fetchAgentProviders(false)
  await loadRowsFromBackend()
  if (useBackendProviders.value && rows.value.length && !lastCheckedAtMs.value) {
    await refreshAgentProviderSslCache()
    await fetchAgentProviders(true)
  }
})
</script>
