<script setup lang="ts">
import { getProviderHealth, getProviderSslDiagnostics } from '@/helper/providerHealth'
import { activeBackend } from '@/store/setup'
import { proxyProviederList } from '@/store/proxies'
import {
  agentProviderByName,
  agentProviders,
  agentProvidersAt,
  agentProvidersError,
  agentProvidersJobStatus,
  agentProvidersLoading,
  agentProvidersNextCheckAtMs,
  agentProvidersSslCacheNextRefreshAtMs,
  agentProvidersSslCacheReady,
  agentProvidersSslCacheFresh,
  agentProvidersSslRefreshPending,
  agentProvidersSslRefreshing,
  fetchAgentProviders,
  panelSslCheckedAt,
  panelSslErrorByName,
  panelSslNotAfterByName,
  panelSslProbeError,
  panelSslUrlByName,
  probePanelSsl,
  providerHealthActionsAvailable,
  providerHealthAvailable,
  refreshAgentProviderSslCache,
} from '@/store/providerHealth'
import { proxyProviderPanelUrlMap, proxyProviderSslWarnDaysMap, sslNearExpiryDaysDefault } from '@/store/settings'
import dayjs from 'dayjs'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const search = ref('')
const problemsOnly = ref(false)
const refreshingNow = ref(false)
const checkingNow = ref(false)

const backendSourceLabel = computed(() =>
  activeBackend.value?.kind === 'ubuntu-service'
    ? t('providerSslSourceUbuntuService')
    : t('providerSslSourceCompatibilityBridge'),
)

const providerByName = computed<Record<string, any>>(() => {
  const out: Record<string, any> = {}
  for (const provider of proxyProviederList.value || []) {
    const name = String((provider as any)?.name || '').trim()
    if (name) out[name] = provider
  }
  return out
})

const rows = computed(() => {
  const names = new Set<string>()
  for (const provider of proxyProviederList.value || []) {
    const name = String((provider as any)?.name || '').trim()
    if (name) names.add(name)
  }
  for (const provider of agentProviders.value || []) {
    const name = String((provider as any)?.name || '').trim()
    if (name) names.add(name)
  }
  for (const name of Object.keys(proxyProviderPanelUrlMap.value || {})) {
    const trimmed = String(name || '').trim()
    if (trimmed) names.add(trimmed)
  }

  const mapped = Array.from(names)
    .map((name) => {
      const provider = providerByName.value[name] || { name }
      const agentProvider = agentProviderByName.value[name] || {}
      const overrideWarnDays = Number((proxyProviderSslWarnDaysMap.value || {})[name])
      const globalWarnDays = Number(sslNearExpiryDaysDefault.value)
      const nearExpiryDays = Number.isFinite(overrideWarnDays)
        ? overrideWarnDays
        : Number.isFinite(globalWarnDays)
          ? globalWarnDays
          : 14

      const diagnostics = getProviderSslDiagnostics(provider, agentProvider, {
        panelProbeNotAfter: panelSslNotAfterByName.value[name],
        panelProbeError: panelSslErrorByName.value[name],
        panelProbeCheckedAtMs: panelSslCheckedAt.value,
        panelProbeUrl: panelSslUrlByName.value[name],
        panelUrlOverride: (proxyProviderPanelUrlMap.value || {})[name],
        nearExpiryDays,
        sslRefreshing: agentProvidersSslRefreshing.value || agentProvidersSslRefreshPending.value,
      })
      const health = getProviderHealth(provider, agentProvider, {
        nearExpiryDays,
        sslRefreshing: agentProvidersSslRefreshing.value || agentProvidersSslRefreshPending.value,
        panelSslNotAfter: panelSslNotAfterByName.value[name],
      })

      const directUrl = String((provider as any)?.url || '').trim()
      const panelUrl = String((proxyProviderPanelUrlMap.value || {})[name] || (agentProvider as any)?.panelUrl || '').trim()
      const effectiveUrl = diagnostics.sourceUrl || panelUrl || String((agentProvider as any)?.url || '').trim() || directUrl
      const certRelevant = Boolean(diagnostics.notAfter || diagnostics.hasHttpsSource)
      const checkedAtMs = Number(diagnostics.checkedAtMs || panelSslCheckedAt.value || agentProvidersAt.value || 0)
      const hasProblem = certRelevant
        ? ['expired', 'warning', 'unavailable'].includes(diagnostics.status) || Boolean(diagnostics.error)
        : false
      const sortSeverity = diagnostics.status === 'expired'
        ? 1
        : diagnostics.status === 'warning'
          ? 2
          : diagnostics.status === 'unavailable'
            ? 3
            : diagnostics.status === 'refreshing'
              ? 4
              : certRelevant
                ? 5
                : 6

      return {
        name,
        provider,
        agentProvider,
        health,
        diagnostics,
        nearExpiryDays,
        effectiveUrl,
        panelUrl,
        certRelevant,
        checkedAtMs,
        hasProblem,
        sortSeverity,
      }
    })
    .sort((a, b) => {
      if (a.sortSeverity !== b.sortSeverity) return a.sortSeverity - b.sortSeverity
      if (a.checkedAtMs !== b.checkedAtMs) return b.checkedAtMs - a.checkedAtMs
      return a.name.localeCompare(b.name)
    })

  const q = String(search.value || '').trim().toLowerCase()
  return mapped.filter((row) => {
    if (problemsOnly.value && !row.hasProblem) return false
    if (!q) return true
    return [row.name, row.effectiveUrl, row.panelUrl, row.diagnostics.issuer, row.diagnostics.subject]
      .join(' ')
      .toLowerCase()
      .includes(q)
  })
})

const summary = computed(() => {
  const out = {
    total: 0,
    checked: 0,
    healthy: 0,
    warning: 0,
    expired: 0,
    refreshing: 0,
    unavailable: 0,
    unsupported: 0,
    errors: 0,
  }

  for (const row of rows.value) {
    out.total += 1
    if (!row.certRelevant) {
      out.unsupported += 1
      continue
    }
    out.checked += 1
    if (row.diagnostics.error) out.errors += 1
    if (row.diagnostics.status === 'healthy') out.healthy += 1
    else if (row.diagnostics.status === 'warning') out.warning += 1
    else if (row.diagnostics.status === 'expired') out.expired += 1
    else if (row.diagnostics.status === 'refreshing') out.refreshing += 1
    else out.unavailable += 1
  }

  return out
})

const fmtDateTime = (value: number | string | undefined | null) => {
  const raw = Number(value || 0)
  if (!Number.isFinite(raw) || raw <= 0) return '—'
  return dayjs(raw).format('DD-MM-YYYY HH:mm:ss')
}

const fmtExpiry = (row: (typeof rows.value)[number]) => {
  if (!row.certRelevant) return t('providerSslChecksNoHttps')
  if (row.diagnostics.status === 'refreshing') return t('providerSslRefreshing')
  if (!row.diagnostics.dateTime) return '—'
  if (row.diagnostics.days === null) return row.diagnostics.dateTime
  return row.diagnostics.days < 0
    ? `${row.diagnostics.dateTime} (${t('providerSslStatusExpired')})`
    : `${row.diagnostics.dateTime} (${row.diagnostics.days}${t('daysShort')})`
}

const statusBadge = (row: (typeof rows.value)[number]) => {
  if (!row.certRelevant) {
    return { cls: 'badge-ghost', text: t('providerSslChecksNoHttpsShort') }
  }
  if (row.diagnostics.status === 'healthy') return { cls: 'badge-success badge-outline', text: t('providerSslStatusHealthy') }
  if (row.diagnostics.status === 'warning') return { cls: 'badge-warning', text: t('providerSslStatusNearExpiry') }
  if (row.diagnostics.status === 'expired') return { cls: 'badge-error', text: t('providerSslStatusExpired') }
  if (row.diagnostics.status === 'refreshing') return { cls: 'badge-info badge-outline', text: t('providerSslRefreshing') }
  return { cls: 'badge-error badge-outline', text: t('providerSslStatusUnavailable') }
}

const runChecksNow = async () => {
  if (!providerHealthAvailable.value || checkingNow.value) return
  checkingNow.value = true
  try {
    await Promise.allSettled([fetchAgentProviders(true), probePanelSsl(true)])
  } finally {
    checkingNow.value = false
  }
}

const refreshSslCacheNow = async () => {
  if (!providerHealthAvailable.value || !providerHealthActionsAvailable.value || refreshingNow.value) return
  refreshingNow.value = true
  try {
    await refreshAgentProviderSslCache()
    await Promise.allSettled([fetchAgentProviders(true), probePanelSsl(true)])
  } finally {
    refreshingNow.value = false
  }
}

onMounted(() => {
  if (!providerHealthAvailable.value) return
  if (!agentProviders.value.length) fetchAgentProviders(false)
  if (!panelSslCheckedAt.value) probePanelSsl(false)
})
</script>

<template>
  <section class="card mt-3 gap-3 p-3">
    <div class="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
      <div>
        <div class="font-semibold">{{ $t('providerSslChecksWorkspaceTitle') }}</div>
        <div class="text-sm opacity-70">{{ $t('providerSslChecksWorkspaceTip') }}</div>
      </div>

      <div class="flex flex-wrap items-center gap-2 text-xs opacity-75">
        <span class="badge badge-ghost">{{ backendSourceLabel }}</span>
        <span v-if="agentProvidersJobStatus" class="badge badge-ghost">
          {{ $t('providerSslChecksJob') }}: {{ agentProvidersJobStatus }}
        </span>
        <span class="badge badge-ghost">
          {{ $t('checkedAt') }}: {{ fmtDateTime(agentProvidersAt) }}
        </span>
      </div>
    </div>

    <div v-if="!providerHealthAvailable" class="alert alert-warning text-sm">
      <span>{{ $t('providerHealthBackendUnavailable') }}</span>
    </div>

    <template v-else>
      <div class="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-5">
        <div class="rounded-xl border border-base-content/10 bg-base-200/40 p-3">
          <div class="text-xs uppercase tracking-[0.12em] opacity-60">{{ $t('providerSslChecksProviders') }}</div>
          <div class="mt-1 text-2xl font-semibold">{{ summary.total }}</div>
          <div class="mt-1 text-xs opacity-70">{{ $t('providerSslChecksProvidersTip', { count: summary.checked }) }}</div>
        </div>
        <div class="rounded-xl border border-success/20 bg-success/5 p-3">
          <div class="text-xs uppercase tracking-[0.12em] opacity-60">{{ $t('providerSslChecksHealthy') }}</div>
          <div class="mt-1 text-2xl font-semibold">{{ summary.healthy }}</div>
          <div class="mt-1 text-xs opacity-70">{{ $t('providerSslChecksHealthyTip') }}</div>
        </div>
        <div class="rounded-xl border border-warning/20 bg-warning/5 p-3">
          <div class="text-xs uppercase tracking-[0.12em] opacity-60">{{ $t('providerSslChecksWarning') }}</div>
          <div class="mt-1 text-2xl font-semibold">{{ summary.warning + summary.expired }}</div>
          <div class="mt-1 text-xs opacity-70">{{ $t('providerSslChecksWarningTip', { count: summary.expired }) }}</div>
        </div>
        <div class="rounded-xl border border-error/20 bg-error/5 p-3">
          <div class="text-xs uppercase tracking-[0.12em] opacity-60">{{ $t('providerSslChecksUnavailable') }}</div>
          <div class="mt-1 text-2xl font-semibold">{{ summary.unavailable }}</div>
          <div class="mt-1 text-xs opacity-70">{{ $t('providerSslChecksUnavailableTip', { count: summary.errors }) }}</div>
        </div>
        <div class="rounded-xl border border-base-content/10 bg-base-200/40 p-3">
          <div class="text-xs uppercase tracking-[0.12em] opacity-60">{{ $t('providerSslChecksCache') }}</div>
          <div class="mt-1 flex flex-wrap gap-1.5">
            <span class="badge" :class="agentProvidersSslCacheReady ? 'badge-success badge-outline' : 'badge-ghost'">
              {{ agentProvidersSslCacheReady ? $t('providerSslChecksCacheReady') : $t('providerSslChecksCachePending') }}
            </span>
            <span class="badge" :class="agentProvidersSslCacheFresh ? 'badge-info badge-outline' : 'badge-ghost'">
              {{ agentProvidersSslCacheFresh ? $t('providerSslChecksCacheFresh') : $t('providerSslChecksCacheStale') }}
            </span>
          </div>
          <div class="mt-1 text-xs opacity-70">
            {{ $t('providerSslChecksNextCheck') }}: {{ fmtDateTime(agentProvidersNextCheckAtMs) }}
          </div>
          <div class="text-xs opacity-70">
            {{ $t('providerSslChecksNextCacheRefresh') }}: {{ fmtDateTime(agentProvidersSslCacheNextRefreshAtMs) }}
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" class="btn btn-sm" :disabled="agentProvidersLoading || checkingNow" @click="runChecksNow">
            <span v-if="agentProvidersLoading || checkingNow" class="loading loading-spinner loading-xs"></span>
            <span v-else>{{ $t('providerSslChecksRunNow') }}</span>
          </button>
          <button type="button" class="btn btn-sm btn-ghost" :disabled="!providerHealthActionsAvailable || refreshingNow" @click="refreshSslCacheNow">
            <span v-if="refreshingNow" class="loading loading-spinner loading-xs"></span>
            <span v-else>{{ $t('providerSslChecksRefreshCache') }}</span>
          </button>
          <label class="label cursor-pointer gap-2 rounded-lg border border-base-content/10 px-3 py-2 text-sm">
            <span>{{ $t('providerSslChecksProblemsOnly') }}</span>
            <input v-model="problemsOnly" type="checkbox" class="toggle toggle-sm" />
          </label>
        </div>

        <div class="flex w-full flex-col gap-2 xl:w-auto xl:min-w-[22rem]">
          <input
            v-model="search"
            type="text"
            class="input input-bordered input-sm w-full"
            :placeholder="$t('providerSslChecksSearchPlaceholder')"
          />
        </div>
      </div>

      <div v-if="panelSslProbeError || agentProvidersError" class="alert alert-warning text-sm">
        <span>
          {{ $t('providerSslChecksProbeWarning') }}
          <template v-if="panelSslProbeError"> • panel probe: {{ panelSslProbeError }}</template>
          <template v-if="agentProvidersError"> • provider checks: {{ agentProvidersError }}</template>
        </span>
      </div>

      <div class="overflow-x-auto rounded-xl border border-base-content/10">
        <table class="table table-sm">
          <thead>
            <tr>
              <th>{{ $t('provider') }}</th>
              <th>{{ $t('providerSslStatus') }}</th>
              <th>{{ $t('providerSslExpiresAt') }}</th>
              <th>{{ $t('providerSslSourceLabel') }}</th>
              <th>{{ $t('providerSslCheckedLabel') }}</th>
              <th>{{ $t('providerSslUrlLabel') }}</th>
              <th>{{ $t('providerSslError') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.name">
              <td class="align-top">
                <div class="font-medium">{{ row.name }}</div>
                <div v-if="row.diagnostics.issuer" class="text-xs opacity-65">{{ row.diagnostics.issuer }}</div>
              </td>
              <td class="align-top">
                <span class="badge whitespace-nowrap" :class="statusBadge(row).cls">
                  {{ statusBadge(row).text }}
                </span>
              </td>
              <td class="align-top text-sm">{{ fmtExpiry(row) }}</td>
              <td class="align-top text-sm">
                <div>
                  <template v-if="row.diagnostics.source === 'subscription'">{{ $t('providerSslSourceSubscription') }}</template>
                  <template v-else-if="row.diagnostics.source === 'panel-probe'">{{ $t('providerSslSourcePanelProbe') }}</template>
                  <template v-else-if="row.diagnostics.source === 'panel'">{{ $t('providerSslSourcePanelUrl') }}</template>
                  <template v-else-if="row.diagnostics.source === 'provider'">{{ $t('providerSslSourceProviderUrl') }}</template>
                  <template v-else>{{ $t('providerSslSourceUnknown') }}</template>
                </div>
                <div class="text-xs opacity-65">{{ backendSourceLabel }}</div>
              </td>
              <td class="align-top text-sm">{{ fmtDateTime(row.checkedAtMs) }}</td>
              <td class="align-top text-sm">
                <div v-if="row.effectiveUrl" class="max-w-[22rem] break-all font-mono text-xs">{{ row.effectiveUrl }}</div>
                <div v-else class="opacity-50">—</div>
              </td>
              <td class="align-top text-sm">
                <div v-if="row.diagnostics.error" class="max-w-[20rem] break-words text-error">{{ row.diagnostics.error }}</div>
                <div v-else-if="!row.certRelevant" class="opacity-65">{{ $t('providerSslChecksNoHttps') }}</div>
                <div v-else class="opacity-50">—</div>
              </td>
            </tr>
            <tr v-if="!rows.length">
              <td colspan="7" class="py-6 text-center text-sm opacity-70">{{ $t('providerNoMatches') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>
