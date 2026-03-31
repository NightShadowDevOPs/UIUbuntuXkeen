<template>
  <div class="card mb-2 gap-3 p-3">
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div>
        <div class="font-semibold">{{ t('providerSslChecksWorkspaceTitle') }}</div>
        <div class="text-xs opacity-70">Автопроверка провайдеров каждые 4 часа + ручной запуск по кнопке. Снимок SSL и время проверки сохраняются в общей БД.</div>
      </div>
      <div class="flex items-center gap-2">
        <button type="button" class="btn btn-sm" @click="runNow" :disabled="busy || !providerHealthActionsAvailable">
          <span v-if="busy" class="loading loading-spinner loading-xs"></span>
          <span v-else>{{ t('providerSslChecksRunNow') }}</span>
        </button>
        <button type="button" class="btn btn-sm btn-ghost" @click="openUsers">{{ t('users') }}</button>
        <button type="button" class="btn btn-sm btn-ghost" @click="openTasks">{{ t('tasks') }}</button>
      </div>
    </div>

    <div class="flex flex-wrap gap-2 text-[11px]">
      <span class="badge badge-ghost badge-sm">Провайдеров: {{ rows.length }}</span>
      <span v-if="agentProvidersAt" class="badge badge-ghost badge-sm">{{ t('checkedAt') }}: {{ fmtTs(agentProvidersAt) }}</span>
      <span v-if="agentProvidersSslCacheNextRefreshAtMs" class="badge badge-ghost badge-sm">{{ t('providerSslChecksNextCacheRefresh') }}: {{ fmtTs(agentProvidersSslCacheNextRefreshAtMs) }}</span>
      <span class="badge badge-sm" :class="agentProvidersSslCacheFresh ? 'badge-success' : 'badge-warning'">{{ agentProvidersSslCacheFresh ? t('providerSslChecksCacheFresh') : t('providerSslChecksCacheStale') }}</span>
      <span v-if="agentProvidersSslRefreshing" class="badge badge-info badge-sm">{{ t('providerSslRefreshing') }}</span>
      <span v-if="agentProvidersError" class="badge badge-error badge-sm">{{ agentProvidersError }}</span>
    </div>

    <div v-if="!providerHealthAvailable && !rows.length" class="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
      {{ t('providerSslServerNotConfiguredTip') }}
    </div>

    <div v-else class="overflow-x-auto">
      <table class="table table-zebra table-sm">
        <thead>
          <tr>
            <th class="w-[180px]">{{ t('provider') }}</th>
            <th>{{ t('providerPanelUrl') }}</th>
            <th>{{ t('providerSslStatus') }}</th>
            <th class="w-[180px]">{{ t('providerSslExpiresAt') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.name">
            <td class="font-mono text-xs">{{ row.name }}</td>
            <td class="text-xs">
              <div class="flex flex-col gap-0.5">
                <span class="break-all">{{ row.panelUrl || row.url || '—' }}</span>
                <span v-if="row.url && row.panelUrl && row.url !== row.panelUrl" class="opacity-60">provider: {{ row.url }}</span>
              </div>
            </td>
            <td>
              <span class="badge badge-sm" :class="row.badgeCls">{{ row.statusText }}</span>
            </td>
            <td class="text-xs">
              <div class="flex flex-col gap-0.5">
                <span>{{ row.expiresAt || '—' }}</span>
                <span class="opacity-60">{{ row.sourceText }}</span>
              </div>
            </td>
          </tr>
          <tr v-if="!rows.length">
            <td colspan="4" class="text-sm opacity-70">{{ t('providersPanelEmpty') }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'
import { ROUTE_NAME } from '@/constant'
import { getProviderHealth, getProviderSslDiagnostics } from '@/helper/providerHealth'
import router from '@/router'
import { proxyProviederList } from '@/store/proxies'
import { providerSslDbSnapshot } from '@/store/providerSslDb'
import {
  agentProviderByName,
  agentProvidersAt,
  agentProvidersError,
  agentProvidersSslCacheFresh,
  agentProvidersSslCacheNextRefreshAtMs,
  agentProvidersSslRefreshing,
  fetchAgentProviders,
  providerHealthActionsAvailable,
  providerHealthAvailable,
  refreshAgentProviderSslCache,
} from '@/store/providerHealth'
import { proxyProviderSslWarnDaysMap, sslNearExpiryDaysDefault } from '@/store/settings'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const busy = ref(false)

const rows = computed(() => {
  return (proxyProviederList.value || [])
    .filter((provider: any) => String(provider?.name || '').trim() && String(provider?.name || '') !== 'default')
    .map((provider: any) => {
      const name = String(provider?.name || '').trim()
      const agent = (agentProviderByName.value || {})[name] || (providerSslDbSnapshot.value || {})[name]
      const override = Number((proxyProviderSslWarnDaysMap.value || {})[name])
      const nearExpiryDays = Number.isFinite(override) ? override : Number(sslNearExpiryDaysDefault.value || 2)
      const health = getProviderHealth(provider, agent, { nearExpiryDays, sslRefreshing: agentProvidersSslRefreshing.value })
      const diag = getProviderSslDiagnostics(provider, agent, { nearExpiryDays, sslRefreshing: agentProvidersSslRefreshing.value })
      const expires = diag.dateTime ? dayjs(diag.dateTime).format('DD.MM.YYYY HH:mm') : ''
      const sourceText = diag.source === 'panel-probe' ? t('providerSslSourcePanelProbe') : diag.source === 'panel' ? t('providerSslSourcePanelUrl') : diag.source === 'provider' ? t('providerSslSourceProviderUrl') : diag.source === 'subscription' ? t('providerSslSourceSubscription') : t('providerSslSourceUnknown')
      return {
        name,
        url: String(agent?.url || provider?.url || '').trim(),
        panelUrl: String(agent?.panelUrl || '').trim(),
        badgeCls: health.badgeCls,
        statusText: t(health.labelKey as any),
        expiresAt: expires,
        sourceText,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
})

const fmtTs = (value: number) => {
  if (!value) return '—'
  return dayjs(value).format('DD.MM HH:mm')
}

const runNow = async () => {
  busy.value = true
  try {
    await refreshAgentProviderSslCache()
    await fetchAgentProviders(true)
  } finally {
    busy.value = false
  }
}

const openTasks = () => {
  router.push({ name: ROUTE_NAME.tasks })
}

const openUsers = () => {
  router.push({ name: ROUTE_NAME.users })
}

onMounted(() => {
  fetchAgentProviders(false)
})
</script>
