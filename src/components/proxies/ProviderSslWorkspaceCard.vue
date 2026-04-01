<template>
  <div class="card mb-2 gap-3 p-3">
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div>
        <div class="font-semibold">{{ t('providerSslChecksWorkspaceTitle') }}</div>
        <div class="text-xs opacity-70">Автопроверка провайдеров каждые 4 часа + ручной запуск по кнопке. Проверка идёт отдельным server-side маршрутом текущего Ubuntu-хоста. В forced DIRECT backend привязывает probe к физическому интерфейсу и не использует пользовательскую proxy-group.</div>
      </div>
      <div class="flex items-center gap-2">
        <button type="button" class="btn btn-sm" @click="runChecksNow" :disabled="checksBusy || !providerHealthActionsAvailable">
          <span v-if="checksBusy" class="loading loading-spinner loading-xs"></span>
          <span v-else>{{ t('providerSslChecksRunNow') }}</span>
        </button>
        <button type="button" class="btn btn-sm btn-outline" @click="refreshCacheNow" :disabled="cacheBusy || !providerHealthActionsAvailable">
          <span v-if="cacheBusy" class="loading loading-spinner loading-xs"></span>
          <span v-else>{{ t('refreshProviderSslCache') }}</span>
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
      <span v-if="agentProvidersProbeSource" class="badge badge-ghost badge-sm">Маршрут проверки: {{ probeRouteText }}</span>
      <span v-if="agentProvidersProbeHost" class="badge badge-ghost badge-sm">Host: {{ agentProvidersProbeHost }}</span>
      <span v-if="agentProvidersProbeInterface" class="badge badge-ghost badge-sm">iface: {{ agentProvidersProbeInterface }}</span>
      <span v-if="agentProvidersProbeSourceIp" class="badge badge-ghost badge-sm">src: {{ agentProvidersProbeSourceIp }}</span>
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
            <th class="w-[220px]">{{ t('providerSslExpiresAt') }}</th>
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
            <td class="text-xs">
              <div class="flex flex-col gap-1.5">
                <span class="inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none shadow-sm" :class="row.pillCls">{{ row.statusText }}</span>
                <span class="leading-4 opacity-75">{{ row.statusHint }}</span>
              </div>
            </td>
            <td class="text-xs">
              <div class="flex flex-col gap-0.5">
                <span>{{ row.expiresAt || '—' }}</span>
                <span class="opacity-60">{{ row.sourceText }}</span>
                <span v-if="row.lastSuccessText" class="opacity-60">{{ row.lastSuccessText }}</span>
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
  agentProvidersProbeHost,
  agentProvidersProbeInterface,
  agentProvidersProbeSourceIp,
  agentProvidersProbeSource,
  agentProvidersSslCacheFresh,
  agentProvidersSslCacheNextRefreshAtMs,
  agentProvidersSslRefreshing,
  fetchAgentProviders,
  providerHealthActionsAvailable,
  providerHealthAvailable,
  refreshAgentProviderSslCache,
  runAgentProviderChecks,
} from '@/store/providerHealth'
import { proxyProviderSslWarnDaysMap, sslNearExpiryDaysDefault } from '@/store/settings'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const checksBusy = ref(false)
const cacheBusy = ref(false)

const shortTlsError = (value: any) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const lowered = raw.toLowerCase()
  if (lowered.includes('handshake operation timed out') || lowered.includes('ssl connection timeout') || lowered.includes('timed ot')) return 'TLS timeout'
  if (lowered.includes('certificate verify failed')) return 'Ошибка проверки сертификата'
  if (lowered.includes('wrong version number')) return 'Неверная версия TLS'
  if (lowered.includes('connection refused')) return 'Соединение отклонено'
  return raw
}

const sslStatusPillCls = (badgeCls: string) => {
  const raw = String(badgeCls || '').toLowerCase()
  if (raw.includes('success')) return 'border-success/70 bg-success text-success-content'
  if (raw.includes('warning')) return 'border-warning/70 bg-warning text-warning-content'
  if (raw.includes('error')) return 'border-error/70 bg-error text-error-content'
  if (raw.includes('info')) return 'border-info/70 bg-info text-info-content'
  return 'border-base-content/20 bg-base-200 text-base-content'
}

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
      const fallbackExpiry = String(agent?.panelSslLastSuccessNotAfter || '').trim()
      const fallbackCheckedAt = Number(agent?.panelSslLastSuccessCheckedAtSec || 0)
      const expires = diag.dateTime ? dayjs(diag.dateTime).format('DD.MM.YYYY HH:mm') : (fallbackExpiry ? dayjs(fallbackExpiry).format('DD.MM.YYYY HH:mm') : '')
      const sourceText = diag.dateTime
        ? (diag.source === 'panel-probe' ? t('providerSslSourcePanelProbe') : diag.source === 'panel' ? t('providerSslSourcePanelUrl') : diag.source === 'provider' ? t('providerSslSourceProviderUrl') : diag.source === 'subscription' ? t('providerSslSourceSubscription') : t('providerSslSourceUnknown'))
        : (fallbackExpiry ? t('providerSslSourceLastSuccess') : t('providerSslSourceUnknown'))
      const lastSuccessText = fallbackCheckedAt > 0 ? `${t('providerSslLastSuccessCheckedLabel')}: ${fmtTs(fallbackCheckedAt * 1000)}` : ''
      const statusHint = diag.error
        ? (String(diag.error || '').toLowerCase().includes('timed out') ? `Порт отвечает, но TLS не завершился через ${probeRouteText.value || 'этот маршрут'}` : shortTlsError(diag.error))
        : diag.status === 'healthy'
          ? 'Проверка прошла с этого хоста'
          : diag.status === 'warning'
            ? 'Сертификат скоро истекает'
            : diag.status === 'expired'
              ? 'Сертификат уже истёк'
              : diag.status === 'refreshing'
                ? 'Идёт обновление SSL-кеша'
                : (fallbackExpiry ? 'Есть последний успешный снимок' : 'Нет данных по сертификату')
      return {
        name,
        url: String(agent?.url || provider?.url || '').trim(),
        panelUrl: String(agent?.panelUrl || '').trim(),
        pillCls: sslStatusPillCls(health.badgeCls),
        statusText: diag.error ? shortTlsError(diag.error) || t(health.labelKey as any) : t(health.labelKey as any),
        statusHint,
        expiresAt: expires,
        sourceText: `${sourceText} • ${probeRouteText.value}`,
        lastSuccessText,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
})

const fmtTs = (value: number) => {
  if (!value) return '—'
  return dayjs(value).format('DD.MM HH:mm')
}

const runChecksNow = async () => {
  checksBusy.value = true
  try {
    await runAgentProviderChecks()
    await fetchAgentProviders(true)
  } finally {
    checksBusy.value = false
  }
}

const refreshCacheNow = async () => {
  cacheBusy.value = true
  try {
    await refreshAgentProviderSslCache()
    await fetchAgentProviders(true)
  } finally {
    cacheBusy.value = false
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
