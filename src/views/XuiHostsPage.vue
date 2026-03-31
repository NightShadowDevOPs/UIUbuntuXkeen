<template>
  <div class="flex h-full flex-col gap-2 overflow-x-hidden overflow-y-auto p-2">
    <div class="rounded-lg border border-base-content/10 bg-base-200/50 px-3 py-2 text-sm">
      <div class="font-semibold">Хосты 3x-ui</div>
      <div class="mt-1 opacity-70">
        Здесь хранятся только адреса панелей 3x-ui для реальных хостов-провайдеров.
        Проверка сертификатов должна выполняться текущим серверным backend-контуром проекта. Этот экран пока работает как безопасная база: список 3x-ui хостов хранится в UI и готов к подключению существующего backend без отдельного выдуманного service.
      </div>
    </div>

    <div class="card gap-3 p-3">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div class="font-semibold">Контроль сертификатов 3x-ui</div>
          <div class="text-xs opacity-70">
            Дата окончания сертификата и время последней проверки должны приходить из существующего backend-а проекта. Автопроверка планируется раз в 4 часа, ручной запуск — по кнопке, когда backend endpoint уже доступен.
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" class="btn btn-sm" @click="runNow" :disabled="busy || !providerHealthActionsAvailable">
            <span v-if="busy" class="loading loading-spinner loading-xs"></span>
            <span v-else>{{ t('refreshProviderSslCache') }}</span>
          </button>
          <button type="button" class="btn btn-sm btn-ghost" @click="addRow">{{ t('add') }}</button>
          <button type="button" class="btn btn-sm btn-primary" @click="saveRows" :disabled="saving || !dirty">
            <span v-if="saving" class="loading loading-spinner loading-xs"></span>
            <span v-else>{{ t('submit') }}</span>
          </button>
        </div>
      </div>

      <div class="flex flex-wrap gap-2 text-[11px]">
        <span class="badge badge-ghost badge-sm">Хостов: {{ rows.length }}</span>
        <span v-if="lastCheckedAtMs" class="badge badge-ghost badge-sm">{{ t('checkedAt') }}: {{ fmtTs(lastCheckedAtMs) }}</span>
        <span v-if="agentProvidersSslCacheNextRefreshAtMs" class="badge badge-ghost badge-sm">Следующая автопроверка: {{ fmtTs(agentProvidersSslCacheNextRefreshAtMs) }}</span>
        <span class="badge badge-sm" :class="agentProvidersSslCacheFresh ? 'badge-success' : 'badge-warning'">{{ agentProvidersSslCacheFresh ? 'Кэш свежий' : 'Кэш ожидает обновления' }}</span>
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
              <th class="w-[80px]"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rowsView" :key="row.id">
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
                <button type="button" class="btn btn-ghost btn-xs" @click="removeRow(row.id)">{{ t('delete') }}</button>
              </td>
            </tr>
            <tr v-if="!rows.length">
              <td colspan="6" class="text-sm opacity-70">Список 3x-ui хостов пока пуст. Добавьте имя провайдера и URL панели.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchUbuntuProvidersAPI, saveUbuntuProvidersAPI } from '@/api/ubuntuService'
import { proxyProviderPanelUrlMap } from '@/store/settings'
import { providerSslDbMeta, providerSslDbSnapshot } from '@/store/providerSslDb'
import {
  agentProviderByName,
  agentProvidersAt,
  agentProvidersError,
  agentProvidersSslCacheFresh,
  agentProvidersSslCacheNextRefreshAtMs,
  agentProvidersSslRefreshing,
  fetchAgentProviders,
  providerHealthActionsAvailable,
  refreshAgentProviderSslCache,
} from '@/store/providerHealth'
import { getProviderSslDiagnostics } from '@/helper/providerHealth'
import { activeBackend } from '@/store/setup'
import { activeBackendCapabilities } from '@/store/backendCapabilities'

const { t } = useI18n()
const busy = ref(false)
const saving = ref(false)
const rows = ref<Array<{ id: string; name: string; url: string }>>([])
const dirty = ref(false)
const loadingBackendRows = ref(false)

const useBackendProviders = computed(() => {
  const caps = activeBackendCapabilities.value || {}
  return Boolean(caps.providers || caps.providerChecks || caps.providerSslCacheStatus)
})

const normalizeUrl = (raw: string) => {
  const value = String(raw || '').trim()
  if (!value) return ''
  if (/^(https?|wss):\/\//i.test(value)) return value
  return `https://${value}`
}

const syncRowsFromStore = () => {
  if (useBackendProviders.value) return
  rows.value = Object.entries(proxyProviderPanelUrlMap.value || {})
    .map(([name, url], idx) => ({ id: `${name || 'row'}-${idx}`, name: String(name || '').trim(), url: String(url || '').trim() }))
    .sort((a, b) => a.name.localeCompare(b.name))
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
    rows.value = items
      .map((item, idx) => ({
        id: `${String(item.name || 'row').trim() || 'row'}-${idx}`,
        name: String(item.name || '').trim(),
        url: normalizeUrl(String(item.panelUrl || item.url || '').trim()),
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
    reflectRowsToLocalCache(items)
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
      rows.value = saved
        .map((item, idx) => ({
          id: `${String(item.name || 'row').trim() || 'row'}-${idx}`,
          name: String(item.name || '').trim(),
          url: normalizeUrl(String(item.panelUrl || item.url || '').trim()),
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
      reflectRowsToLocalCache(saved)
      dirty.value = false
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

const rowsView = computed(() => {
  return rows.value.map((row) => {
    const name = String(row.name || '').trim()
    const url = normalizeUrl(row.url)
    const item = (agentProviderByName.value || {})[name] || (providerSslDbSnapshot.value || {})[name] || {}
    const diag = getProviderSslDiagnostics({}, item, {
      panelUrlOverride: url,
      sslRefreshing: agentProvidersSslRefreshing.value,
      nearExpiryDays: 7,
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
      status: {
        badgeCls,
        text,
        expiresAt: diag.dateTime ? diag.dateTime.replace(/^(\d{2})-(\d{2})-(\d{4})/, '$1.$2.$3') : '',
        checkedAt: diag.checkedAtMs ? fmtTs(diag.checkedAtMs) : fmtTs(lastCheckedAtMs.value),
      },
    }
  })
})

const runNow = async () => {
  busy.value = true
  try {
    if (dirty.value) await saveRows()
    await refreshAgentProviderSslCache()
    await fetchAgentProviders(true)
    if (useBackendProviders.value) await loadRowsFromBackend()
  } finally {
    busy.value = false
  }
}

onMounted(() => {
  fetchAgentProviders(false)
})
</script>
