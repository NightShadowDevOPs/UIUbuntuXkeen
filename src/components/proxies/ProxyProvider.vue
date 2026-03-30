<template>
  <div v-if="proxyProvider" data-nav-kind="proxy-provider" :data-nav-value="proxyProvider.name">
    <CollapseCard
      :name="proxyProvider.name"
      class="provider-collapse-card border border-base-content/10 shadow-lg"
      :style="providerCardSurfaceStyle"
    >
    <template v-slot:title="{ open }">
      <div class="flex items-center justify-between gap-2 rounded-xl px-2 py-1" :class="open ? 'bg-base-200 ring-1 ring-base-300' : ''">
        <div class="text-xl font-medium">
          <ProviderIconBadge v-if="providerIconRaw" :icon="providerIconRaw" size="sm" class="mr-1 align-middle" />
          {{ proxyProvider.name }}
          <span
            v-if="providerTypeCounts.length"
            class="ml-2 inline-flex flex-wrap items-center gap-1 align-middle"
            :title="providerTypesTooltip"
          >
            <span
              v-for="b in providerTypeBadges"
              :key="b.key"
              class="badge badge-sm opacity-70"
            >
              {{ b.label }}<template v-if="b.count > 1">×{{ b.count }}</template>
            </span>
            <span v-if="providerTypeOverflow" class="badge badge-sm opacity-70">+{{ providerTypeOverflow }}</span>
          </span>
          <span
            v-if="providerHealth"
            class="badge badge-sm ml-2 align-middle"
            :class="providerHealth.badgeCls"
            :title="providerHealth.tip"
          >
            {{ $t(providerHealth.labelKey) }}
          </span>
          <span
            v-if="sslExpireBadge"
            class="badge badge-sm ml-2 align-middle"
            :class="sslExpireBadge.badgeCls"
            :title="sslExpireBadge.tip"
          >
            {{ sslExpireBadge.text }}
          </span>
          <span
            class="badge badge-sm ml-2 align-middle"
            :class="providerStats.active ? 'badge-success' : 'badge-ghost opacity-70'"
            :title="providerStats.active ? $t('providerActiveNowTip') : $t('providerInactiveNowTip')"
          >
            {{ providerStats.active ? $t('providerActiveNow') : $t('providerInactiveNow') }}
          </span>
          <span class="text-base-content/60 text-sm font-normal"> ({{ proxiesCount }}) </span>
        </div>
        <div class="flex gap-2">
          <button
            type="button"
            :class="twMerge('btn btn-circle btn-sm z-30')"
            :disabled="providerStats.killableConnections <= 0 || isKilling"
            @click.stop.prevent="killSessionsClickHandler"
            :title="providerStats.killableConnections > 0 ? $t('killProviderSessions') : $t('killProviderSessionsNone')"
          >
            <span
              v-if="isKilling"
              class="loading loading-spinner loading-xs"
            ></span>
            <XMarkIcon
              v-else
              class="h-4 w-4"
            />
          </button>
          <button
            type="button"
            :class="twMerge('btn btn-circle btn-sm z-30')"
            @click.stop.prevent="healthCheckClickHandler"
          >
            <span
              v-if="isHealthChecking"
              class="loading loading-spinner loading-xs"
            ></span>
            <BoltIcon
              v-else
              class="h-4 w-4"
            />
          </button>
          <button
            type="button"
            v-if="proxyProvider.vehicleType !== 'Inline'"
            :class="twMerge('btn btn-circle btn-sm z-30', isUpdating ? 'animate-spin' : '')"
            @click.stop.prevent="updateProviderClickHandler"
          >
            <ArrowPathIcon class="h-4 w-4" />
          </button>
        </div>
      </div>
      <div
        class="text-base-content/60 flex items-end justify-between text-sm max-sm:flex-col max-sm:items-start"
      >
        <div class="min-h-10">
          <div v-if="subscriptionInfo">
            {{ subscriptionInfo.expireStr }}
          </div>
          <div v-if="subscriptionInfo" class="flex items-center gap-2">
            <span>{{ subscriptionInfo.usageStr }}</span>
            <button
              v-if="subscriptionInfo.totalLabel === '—'"
              type="button"
              class="btn btn-ghost btn-xs"
              @click.stop="showRawSub = !showRawSub"
              :title="'subscriptionInfo'"
            >
              raw
            </button>
          </div>
          <progress
            v-if="subscriptionInfo?.percent != null"
            class="progress progress-info w-full max-w-72"
            :value="subscriptionInfo?.percent ?? 0"
            max="100"
          ></progress>

          <div v-if="sslExpireInfo" class="mt-1 text-xs font-medium" :class="sslExpireInfo.cls" :title="sslExpireInfo.tip">
            {{ $t('sslExpire') }}: {{ sslExpireInfo.label }}
          </div>

          <!-- Shared 3x-ui subscription URL (synced via router-agent users DB) -->
          <div v-if="open" class="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span class="opacity-70">{{ $t('providerPanelUrl') }}:</span>
            <input
              class="input input-bordered input-xs w-72 max-w-full"
              v-model="panelUrlDraft"
              :placeholder="$t('providerPanelUrlPlaceholder')"
              @keydown.enter.stop.prevent="savePanelUrl"
              @blur="savePanelUrl"
            />
            <button
              type="button"
              class="btn btn-ghost btn-xs"
              :disabled="!panelUrl"
              @click.stop="openPanelUrl"
              :title="$t('openPanel')"
            >
              <ArrowTopRightOnSquareIcon class="h-4 w-4" />
            </button>
          </div>

          <div v-if="open" class="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <div class="rounded-xl border border-base-content/10 bg-base-200/60 p-3">
              <div class="text-[11px] uppercase tracking-wide opacity-60">{{ $t('providerSslStatus') }}</div>
              <div class="mt-1 text-sm font-semibold" :class="sslDiagnosticsCard.statusCls">{{ sslDiagnosticsCard.statusLabel }}</div>
              <div class="mt-1 text-xs opacity-70">{{ sslDiagnosticsCard.expiresLabel }}</div>
            </div>
            <div class="rounded-xl border border-base-content/10 bg-base-200/60 p-3">
              <div class="text-[11px] uppercase tracking-wide opacity-60">{{ $t('providerSslSourceLabel') }}</div>
              <div class="mt-1 text-sm font-medium">{{ sslDiagnosticsCard.sourceLabel }}</div>
              <div class="mt-1 text-xs opacity-70">{{ sslDiagnosticsCard.checkedLabel }}</div>
            </div>
            <div class="rounded-xl border border-base-content/10 bg-base-200/60 p-3 sm:col-span-2 xl:col-span-1">
              <div class="text-[11px] uppercase tracking-wide opacity-60">{{ $t('providerSslUrlLabel') }}</div>
              <div class="mt-1 break-all text-xs font-mono opacity-80">{{ sslDiagnosticsCard.urlLabel }}</div>
            </div>
            <div v-if="sslDiagnosticsCard.issuer" class="rounded-xl border border-base-content/10 bg-base-200/60 p-3">
              <div class="text-[11px] uppercase tracking-wide opacity-60">{{ $t('providerSslIssuer') }}</div>
              <div class="mt-1 break-words text-xs">{{ sslDiagnosticsCard.issuer }}</div>
            </div>
            <div v-if="sslDiagnosticsCard.subject" class="rounded-xl border border-base-content/10 bg-base-200/60 p-3">
              <div class="text-[11px] uppercase tracking-wide opacity-60">{{ $t('providerSslSubject') }}</div>
              <div class="mt-1 break-words text-xs">{{ sslDiagnosticsCard.subject }}</div>
            </div>
            <div v-if="sslDiagnosticsCard.san.length" class="rounded-xl border border-base-content/10 bg-base-200/60 p-3 sm:col-span-2 xl:col-span-1">
              <div class="text-[11px] uppercase tracking-wide opacity-60">{{ $t('providerSslSan') }}</div>
              <div class="mt-1 break-words text-xs">{{ sslDiagnosticsCard.san.join(', ') }}</div>
            </div>
            <div v-if="sslDiagnosticsCard.error" class="rounded-xl border border-error/30 bg-error/10 p-3 text-error sm:col-span-2 xl:col-span-3">
              <div class="text-[11px] uppercase tracking-wide opacity-80">{{ $t('providerSslError') }}</div>
              <div class="mt-1 break-words text-xs">{{ sslDiagnosticsCard.error }}</div>
            </div>
          </div>

          <pre
            v-if="subscriptionInfo?.totalLabel === '—' && showRawSub"
            class="mt-2 text-xs opacity-70 whitespace-pre-wrap break-all"
          >{{ subscriptionInfo.raw }}</pre>

          <div
            v-if="providerStats.active || providerStats.bytes > 0 || providerStats.todayBytes > 0 || providerStats.currentBytes > 0"
            class="mt-1 text-xs opacity-70"
          >
            {{ $t('connections') }}: {{ providerStats.connections }}
            <template v-if="providerStats.killableConnections > 0 && providerStats.killableConnections !== providerStats.connections">
              · {{ $t('killableConnections') }}: {{ providerStats.killableConnections }}
            </template>
            · {{ $t('proxies') }}: {{ proxiesCount }}
            · {{ $t('providerTrafficToday') }}: {{ prettyBytesHelper(providerStats.todayBytes, { binary: true }) }}
            · {{ $t('providerTrafficSinceReset') }}: {{ prettyBytesHelper(providerStats.bytes, { binary: true }) }}
            <template v-if="providerStats.currentBytes > 0">
              · {{ $t('providerTrafficLive') }}: {{ prettyBytesHelper(providerStats.currentBytes, { binary: true }) }}
            </template>
            <template v-if="providerStats.speed > 0">
              ({{ prettyBytesHelper(providerStats.speed, { binary: true }) }}/s)
            </template>
          </div>
        </div>
        <div class="flex flex-col items-end gap-1 max-sm:items-start">
          <details v-if="open" class="dropdown dropdown-end">
            <summary
              class="list-none cursor-pointer select-none flex items-center gap-1.5 text-xs"
              @click.stop
            >
              <span class="opacity-70">{{ activeProxy ? $t('activeProxy') : $t('bestLatencyProxy') }}:</span>
              <span
                class="font-mono truncate max-w-[18rem]"
                :class="activeProxy ? '' : 'opacity-70'"
                :title="displayProxyName || ''"
              >
                {{ displayProxyName || '—' }}
              </span>
              <ChevronDownIcon class="h-4 w-4 opacity-60" />
            </summary>

            <div class="dropdown-content z-[999] mt-2 w-72 rounded-box bg-base-200 bg-opacity-100 p-2 shadow ring-1 ring-base-300">
              <div class="text-xs mb-2">
                <span class="opacity-70">{{ activeProxy ? $t('activeProxy') : $t('bestLatencyProxy') }}:</span>
                <span class="font-mono break-all">{{ displayProxyName || '—' }}</span>
              </div>

              <div class="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  class="btn btn-ghost btn-xs btn-circle"
                  @click.stop="copyActiveName"
                  :disabled="!displayProxyName"
                  :title="$t('copyProxyName')"
                >
                  <ClipboardDocumentIcon class="h-4 w-4" />
                </button>

                <button
                  type="button"
                  class="btn btn-ghost btn-xs btn-circle"
                  @click.stop="testActiveNode"
                  :disabled="isActiveTesting || !displayProxyName"
                  :title="$t('testProxyLatency')"
                >
                  <span
                    v-if="isActiveTesting"
                    class="loading loading-spinner loading-xs"
                  ></span>
                  <BoltIcon v-else class="h-4 w-4" />
                </button>

                <button
                  v-if="activeProxyUri"
                  type="button"
                  class="btn btn-ghost btn-xs btn-circle"
                  @click.stop="copyActiveUri"
                  :title="$t('copyProxyUri')"
                >
                  <LinkIcon class="h-4 w-4" />
                </button>

                <button
                  type="button"
                  class="btn btn-ghost btn-xs btn-circle"
                  @click.stop="openTopologyWithProvider"
                  :title="$t('showInTopology')"
                >
                  <PresentationChartLineIcon class="h-4 w-4" />
                </button>

                <button
                  v-if="panelUrl"
                  type="button"
                  class="btn btn-ghost btn-xs btn-circle"
                  @click.stop="openPanelUrl"
                  :title="$t('openPanel')"
                >
                  <ArrowTopRightOnSquareIcon class="h-4 w-4" />
                </button>
              </div>
            </div>
          </details>
          <div>{{ $t('updated') }} {{ fromNow(proxyProvider.updatedAt) }}</div>
        </div>
      </div>
    </template>
    <template v-slot:preview>
      <div class="flex flex-col gap-2">
        <ProxyPreview
          :nodes="renderProxies"
          :now="displayProxyName"
          :group-name="proxyProvider.name"
          :enable-topology-filter="true"
          @nodefilter="openTopologyWithProxy"
        />

        <details class="dropdown dropdown-end">
          <summary
            class="list-none cursor-pointer select-none flex items-center gap-1.5 text-xs"
            @click.stop
          >
            <span class="opacity-70">{{ activeProxy ? $t('activeProxy') : $t('bestLatencyProxy') }}:</span>
            <span
              class="font-mono truncate max-w-[18rem]"
              :class="activeProxy ? '' : 'opacity-70'"
              :title="displayProxyName || ''"
            >
              {{ displayProxyName || '—' }}
            </span>
            <ChevronDownIcon class="h-4 w-4 opacity-60" />
          </summary>

          <div class="dropdown-content z-[999] mt-2 w-72 rounded-box bg-base-200 bg-opacity-100 p-2 shadow ring-1 ring-base-300">
            <div class="text-xs mb-2">
              <span class="opacity-70">{{ activeProxy ? $t('activeProxy') : $t('bestLatencyProxy') }}:</span>
              <span class="font-mono break-all">{{ displayProxyName || '—' }}</span>
            </div>

            <div class="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                class="btn btn-ghost btn-xs btn-circle"
                @click.stop="copyActiveName"
                :disabled="!displayProxyName"
                :title="$t('copyProxyName')"
              >
                <ClipboardDocumentIcon class="h-4 w-4" />
              </button>

              <button
                type="button"
                class="btn btn-ghost btn-xs btn-circle"
                @click.stop="testActiveNode"
                :disabled="isActiveTesting || !displayProxyName"
                :title="$t('testProxyLatency')"
              >
                <span
                  v-if="isActiveTesting"
                  class="loading loading-spinner loading-xs"
                ></span>
                <BoltIcon
                  v-else
                  class="h-4 w-4"
                />
              </button>

              <button
                v-if="activeProxyUri"
                type="button"
                class="btn btn-ghost btn-xs btn-circle"
                @click.stop="copyActiveUri"
                :title="$t('copyProxyUri')"
              >
                <LinkIcon class="h-4 w-4" />
              </button>

              <button
                type="button"
                class="btn btn-ghost btn-xs btn-circle"
                @click.stop="openTopologyWithProvider"
                :title="$t('showInTopology')"
              >
                <PresentationChartLineIcon class="h-4 w-4" />
              </button>

              <button
                v-if="panelUrl"
                type="button"
                class="btn btn-ghost btn-xs btn-circle"
                @click.stop="openPanelUrl"
                :title="$t('openPanel')"
              >
                <ArrowTopRightOnSquareIcon class="h-4 w-4" />
              </button>
            </div>
          </div>
        </details>
      </div>
    </template>
    <template v-slot:content="{ showFullContent }">
      <ProxyNodeGrid>
        <ProxyNodeCard
          v-for="node in showFullContent
            ? renderProxies
            : renderProxies.slice(0, twoColumnProxyGroup ? 48 : 96)"
          :key="node"
          :name="node"
          :group-name="name"
        />
      </ProxyNodeGrid>
    </template>
    </CollapseCard>
  </div>

  <!-- Defensive fallback: avoid a totally blank page if provider is missing/mismatched -->
  <div
    v-else
    class="rounded-box border border-base-content/10 p-4 text-sm opacity-80 shadow-lg"
    :style="providerCardSurfaceStyle"
  >
    Провайдер не найден: <span class="font-mono">{{ name }}</span>
  </div>
</template>

<script setup lang="ts">
import { disconnectByIdSilentAPI, proxyProviderHealthCheckAPI, updateProxyProviderAPI } from '@/api'
import { getProviderHealth, getProviderSslDiagnostics } from '@/helper/providerHealth'
import {
  agentProviderByName,
  agentProvidersSslRefreshPending,
  agentProvidersSslRefreshing,
  fetchAgentProviders,
  panelSslCheckedAt,
  panelSslErrorByName,
  panelSslNotAfterByName,
  panelSslUrlByName,
} from '@/store/providerHealth'
import { useBounceOnVisible } from '@/composables/bouncein'
import { useRenderProxies } from '@/composables/renderProxies'
import { fromNow, prettyBytesHelper } from '@/helper/utils'
import { showNotification } from '@/helper/notification'
import { normalizeProviderIcon } from '@/helper/providerIcon'
import { normalizeProxyProtoKey, protoLabel } from '@/helper/proxyProto'
import { fetchProxyProviderByNameOnly, getLatencyByName, getTestUrl, proxyLatencyTest, proxyMap, proxyProviederList } from '@/store/proxies'
import { activeConnections } from '@/store/connections'
import { connectionMatchesProviderProxyNames, providerActivityByName, providerLiveStatusByName } from '@/store/providerActivity'
import { NOT_CONNECTED, ROUTE_NAME } from '@/constant'
import { activeBackend } from '@/store/setup'
import {
  proxyProviderCardOpacity,
  proxyProviderIconMap,
  proxyProviderPanelUrlMap,
  proxyProviderSslWarnDaysMap,
  sslNearExpiryDaysDefault,
  twoColumnProxyGroup,
} from '@/store/settings'
import ProviderIconBadge from '@/components/common/ProviderIconBadge.vue'
import { BACKEND_KINDS } from '@/config/backendContract'
import { ArrowPathIcon, ArrowTopRightOnSquareIcon, BoltIcon, ClipboardDocumentIcon, LinkIcon, PresentationChartLineIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { ChevronDownIcon } from '@heroicons/vue/20/solid'
import dayjs from 'dayjs'
import { twMerge } from 'tailwind-merge'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import CollapseCard from '../common/CollapseCard.vue'
import ProxyNodeCard from './ProxyNodeCard.vue'
import ProxyNodeGrid from './ProxyNodeGrid.vue'
import ProxyPreview from './ProxyPreview.vue'

const props = defineProps<{
  name: string
}>()

const clampPercent = (value: number, min = 45, max = 100) => {
  if (!Number.isFinite(value)) return max
  return Math.max(min, Math.min(max, Math.trunc(value)))
}

const providerCardSurfaceStyle = computed(() => {
  const alpha = clampPercent(Number(proxyProviderCardOpacity.value), 45, 100) / 100
  return {
    backgroundColor: `oklch(var(--b1) / ${alpha})`,
    borderColor: 'oklch(var(--bc) / 0.12)',
  }
})

const router = useRouter()
const { t } = useI18n()
const activeBackendKind = computed(() => activeBackend.value?.kind)
const sslProbeServiceLabel = computed(() => activeBackendKind.value === BACKEND_KINDS.UBUNTU_SERVICE ? t('providerSslSourceUbuntuService') : t('providerSslSourceCompatibilityBridge'))

// Provider list can refresh/reorder; be defensive to avoid blank screens if a provider is
// temporarily missing (or name mismatched).
const proxyProvider = computed(() => proxyProviederList.value.find((group) => group.name === props.name))

// Different cores/APIs may shape provider.proxies as an array OR as an object map.
// Normalize to an array to keep rendering stable.
const providerProxyItems = computed<any[]>(() => {
  const v = (proxyProvider.value as any)?.proxies
  if (Array.isArray(v)) return v
  if (v && typeof v === 'object') return Object.values(v)
  return []
})

const providerIconRaw = computed(() => normalizeProviderIcon((proxyProviderIconMap.value || {})[props.name]))

const providerTypeCounts = computed(() => {
  const m = new Map<string, number>()
	for (const p of providerProxyItems.value) {
		const t0 = typeof (p as any) === 'string' ? (proxyMap.value as any)?.[(p as any)]?.type : (p as any)?.type
		const k = normalizeProxyProtoKey(t0)
    if (!k) continue
    m.set(k, (m.get(k) || 0) + 1)
  }
  const arr = Array.from(m.entries()).map(([key, count]) => ({
    key,
    label: protoLabel(key),
    count,
  }))
  arr.sort((a, b) => (b.count - a.count) || a.key.localeCompare(b.key))
  return arr
})

const providerTypeBadges = computed(() => providerTypeCounts.value.slice(0, 4))
const providerTypeOverflow = computed(() => Math.max(0, providerTypeCounts.value.length - providerTypeBadges.value.length))
const providerTypesTooltip = computed(() => {
  return providerTypeCounts.value
    .map((x) => x.label + (x.count > 1 ? ('\u00D7' + String(x.count)) : ''))
    .join(' / ')
})
const allProxies = computed(() =>
  providerProxyItems.value
    .map((node: any) => (typeof node === 'string' ? node : node?.name))
    .filter(Boolean),
)
const { renderProxies, proxiesCount } = useRenderProxies(allProxies)

// best-effort: ensure cache is populated when provider cards mount
fetchAgentProviders(false)

const sslWarnDays = computed(() => {
  const override = Number((proxyProviderSslWarnDaysMap.value || {})[props.name])
  const base = Number(sslNearExpiryDaysDefault.value)
  const v = Number.isFinite(override) ? override : Number.isFinite(base) ? base : 2
  return Math.max(0, Math.min(365, Math.trunc(v)))
})

const providerHealth = computed(() => {
  const ap = agentProviderByName.value[props.name]
  return getProviderHealth(proxyProvider.value as any, ap, { nearExpiryDays: sslWarnDays.value, sslRefreshing: agentProvidersSslRefreshing.value || agentProvidersSslRefreshPending.value })
})

const activeConnectionTargets = computed(() => {
  const set = new Set(allProxies.value || [])
  if (!set.size) return [] as any[]
  return (activeConnections.value || []).filter((c: any) => !!connectionMatchesProviderProxyNames(c, set))
})

const providerStats = computed(() => {
  const rec = (providerActivityByName.value || {})[props.name]
  const live = (providerLiveStatusByName.value || {})[props.name]
  const mappedConnections = Number((rec as any)?.connections || 0)
  const liveConnections = Number((live as any)?.connections || 0)
  const connections = Math.max(mappedConnections, liveConnections)
  const bytes = Number((rec as any)?.bytes || 0)
  const todayBytes = Number((rec as any)?.todayBytes || 0)
  const speed = Number((rec as any)?.speed || 0)
  const currentBytes = Number((rec as any)?.currentBytes || 0)
  const killableConnections = activeConnectionTargets.value.length
  const active = Boolean((live as any)?.active)
    || Boolean((rec as any)?.active)
    || killableConnections > 0
    || connections > 0
    || currentBytes > 0
    || speed > 0
    || todayBytes > 0
  return {
    active,
    connections,
    killableConnections,
    bytes,
    todayBytes,
    speed,
    currentBytes,
    download: Number((rec as any)?.download || 0),
    upload: Number((rec as any)?.upload || 0),
    todayDownload: Number((rec as any)?.todayDownload || 0),
    todayUpload: Number((rec as any)?.todayUpload || 0),
  }
})

// Highlight the "currently used" proxy inside this provider.
// Best-effort: infer from active connections using specialProxy first,
// then fall back to any hop in the chain (from leaf to root).
const activeProxy = computed(() => {
  const set = new Set(allProxies.value || [])
  let bestName = ''
  let bestTotal = 0

  for (const c of activeConnections.value || []) {
    const matched = connectionMatchesProviderProxyNames(c, set)
    if (!matched) continue

    const total = (Number((c as any)?.download) || 0) + (Number((c as any)?.upload) || 0)
    if (total > bestTotal) {
      bestTotal = total
      bestName = matched
    }
  }

  return bestName
})

// Fallback: if there are no active connections, show the best (lowest) latency proxy.
const bestLatencyProxy = computed(() => {
  let best = ''
  let bestLatency = Number.POSITIVE_INFINITY

  for (const name of renderProxies.value || []) {
    const l = getLatencyByName(name, proxyProvider.value?.name)
    if (l === NOT_CONNECTED) continue
    if (typeof l !== 'number' || !Number.isFinite(l) || l <= 0) continue
    if (l < bestLatency) {
      bestLatency = l
      best = name
    }
  }

  return best
})

const displayProxyName = computed(() => {
  return activeProxy.value || bestLatencyProxy.value || ''
})

// ---- shared provider 3x-ui subscription URL ----

const panelUrl = computed(() => {
  const m = proxyProviderPanelUrlMap.value || {}
  return String((m as any)[props.name] || '').trim()
})

const panelUrlDraft = ref(panelUrl.value)
watch(panelUrl, (v) => {
  // keep draft in sync when updated by sync engine
  if (panelUrlDraft.value !== v) panelUrlDraft.value = v
})

const savePanelUrl = () => {
  const raw = String(panelUrlDraft.value || '').trim()
  const normalized = raw && !/^https?:\/\//i.test(raw) ? `https://${raw}` : raw

  const cur = { ...(proxyProviderPanelUrlMap.value || {}) }
  if (!normalized) {
    delete (cur as any)[props.name]
  } else {
    ;(cur as any)[props.name] = normalized
  }
  proxyProviderPanelUrlMap.value = cur
}

const openPanelUrl = () => {
  const url = panelUrl.value
  if (!url) return
  try {
    window.open(url, '_blank', 'noopener,noreferrer')
  } catch {
    // ignore
  }
}

const TOPOLOGY_NAV_FILTER_KEY = 'runtime/topology-pending-filter-v1'

const openTopologyWithProxy = async (p: { name: string; mode: 'only' | 'exclude' }) => {
  const payload = {
    ts: Date.now(),
    mode: p.mode,
    focus: { stage: 'S', kind: 'value', value: p.name },
  }

  try {
    localStorage.setItem(TOPOLOGY_NAV_FILTER_KEY, JSON.stringify(payload))
  } catch {
    // ignore
  }

  await router.push({ name: ROUTE_NAME.overview })
}

const openTopologyWithProvider = async () => {
  const payload = {
    ts: Date.now(),
    mode: 'only',
    focus: { stage: 'P', kind: 'value', value: proxyProvider.value?.name || props.name },
    // Fallback to a concrete proxy name if provider map is not yet ready on the Topology page.
    fallbackProxyName: displayProxyName.value || '',
  }

  try {
    localStorage.setItem(TOPOLOGY_NAV_FILTER_KEY, JSON.stringify(payload))
  } catch {
    // ignore
  }

  await router.push({ name: ROUTE_NAME.overview })
}

const getAnyFromObj = (obj: any, candidates: string[]): any => {
  if (!obj || typeof obj !== 'object') return undefined
  const keys = Object.keys(obj)

  // exact match (case-insensitive)
  for (const c of candidates) {
    const k = keys.find((x) => x.toLowerCase() === c.toLowerCase())
    if (k) {
      const v = (obj as any)[k]
      if (v !== undefined && v !== null && `${v}`.trim() !== '') return v
    }
  }

  // contains match (case-insensitive)
  for (const c of candidates) {
    const lc = c.toLowerCase()
    const k = keys.find((x) => x.toLowerCase().includes(lc))
    if (k) {
      const v = (obj as any)[k]
      if (v !== undefined && v !== null && `${v}`.trim() !== '') return v
    }
  }

  return undefined
}

const parseDateMaybe = (v: any): dayjs.Dayjs | null => {
  if (v === null || v === undefined) return null
  if (typeof v === 'number' && Number.isFinite(v)) {
    const ts = v > 10_000_000_000 ? v : v * 1000
    const d = dayjs(ts)
    return d.isValid() ? d : null
  }
  if (typeof v === 'string') {
    const s = v.trim()
    if (!s) return null
    if (/^[0-9]{10,13}$/.test(s)) {
      const num = Number(s)
      return parseDateMaybe(num)
    }
    const d = dayjs(s)
    return d.isValid() ? d : null
  }
  if (typeof v === 'object') {
    // common shapes: { expire: ... }
    const inner = getAnyFromObj(v, ['expire', 'expiry', 'expiration', 'notAfter', 'not_after'])
    return parseDateMaybe(inner)
  }
  return null
}

const sslDiagnosticsRaw = computed(() => {
  const agentP: any = agentProviderByName.value[props.name]
  return getProviderSslDiagnostics(proxyProvider.value as any, agentP, {
    panelProbeNotAfter: (panelSslNotAfterByName.value || {})[props.name] || '',
    panelProbeError: (panelSslErrorByName.value || {})[props.name] || '',
    panelProbeCheckedAtMs: panelSslCheckedAt.value,
    panelProbeUrl: (panelSslUrlByName.value || {})[props.name] || '',
    panelUrlOverride: panelUrl.value,
    nearExpiryDays: sslWarnDays.value,
    sslRefreshing: agentProvidersSslRefreshing.value || agentProvidersSslRefreshPending.value,
  })
})

const sslExpireInfo = computed(() => {
  const d = sslDiagnosticsRaw.value
  if (!d.notAfter) {
    const checked = d.checkedAtMs ? dayjs(d.checkedAtMs).format('DD-MM-YYYY HH:mm:ss') : ''
    const tip = d.isRefreshing
      ? t('providerSslRefreshingTip') + (checked ? ` • ${t('checkedAt')}: ${checked}` : '')
      : d.error
        ? `${t('providerSslError')}: ${d.error}` + (checked ? ` • ${t('checkedAt')}: ${checked}` : '')
        : checked
          ? `${t('providerSslStatusUnavailable')} • ${t('checkedAt')}: ${checked}`
          : t('providerSslStatusUnavailable')
    return {
      dateTime: '—',
      days: Number.NaN,
      cls: d.isRefreshing ? 'text-info' : d.error ? 'text-error' : 'text-base-content/60',
      label: d.isRefreshing ? t('providerSslRefreshing') : '—',
      tip,
      isRefreshing: d.isRefreshing,
    }
  }

  const label = (d.days ?? 0) < 0 ? `${d.dateTime} (${t('providerSslStatusExpired')})` : `${d.dateTime} (${d.days}${t('daysShort')})`
  const cls = (d.days ?? 0) < 0 ? 'text-error' : (d.days ?? 0) <= sslWarnDays.value ? 'text-warning' : 'text-success'
  const checked = d.checkedAtMs ? dayjs(d.checkedAtMs).format('DD-MM-YYYY HH:mm:ss') : ''
  const source =
    d.source === 'subscription'
      ? t('providerSslSourceSubscription')
      : d.source === 'panel-probe'
        ? `${t('providerSslSourcePanelProbe')} • ${sslProbeServiceLabel.value}`
        : d.source === 'panel'
          ? `${t('providerSslSourcePanelUrl')} • ${sslProbeServiceLabel.value}`
          : d.source === 'provider'
            ? `${t('providerSslSourceProviderUrl')} • ${sslProbeServiceLabel.value}`
            : t('providerSslSourceUnknown')
  const tip = checked ? `${source} • ${t('checkedAt')}: ${checked}` : source
  return { dateTime: d.dateTime, days: d.days, cls, label, tip }
})

const sslDiagnosticsCard = computed(() => {
  const d = sslDiagnosticsRaw.value
  const checked = d.checkedAtMs ? dayjs(d.checkedAtMs).format('DD-MM-YYYY HH:mm:ss') : ''
  const remaining = Number.isFinite(d.days as number) ? ((d.days as number) < 0 ? t('providerSslStatusExpired') : `${d.days}${t('daysShort')}`) : '—'
  const expiresLabel = d.dateTime
    ? `${t('providerSslExpiresAt')}: ${d.dateTime} • ${t('providerSslRemaining')}: ${remaining}`
    : `${t('providerSslExpiresAt')}: —`
  const checkedLabel = checked ? `${t('providerSslCheckedLabel')}: ${checked}` : `${t('providerSslCheckedLabel')}: —`
  const sourceLabel =
    d.source === 'subscription'
      ? t('providerSslSourceSubscription')
      : d.source === 'panel-probe'
        ? `${t('providerSslSourcePanelProbe')} • ${sslProbeServiceLabel.value}`
        : d.source === 'panel'
          ? `${t('providerSslSourcePanelUrl')} • ${sslProbeServiceLabel.value}`
          : d.source === 'provider'
            ? `${t('providerSslSourceProviderUrl')} • ${sslProbeServiceLabel.value}`
            : t('providerSslSourceUnknown')
  const statusLabel =
    d.status === 'refreshing'
      ? t('providerSslStatusRefreshing')
      : d.status === 'unavailable'
        ? t('providerSslStatusUnavailable')
        : d.status === 'expired'
          ? t('providerSslStatusExpired')
          : d.status === 'warning'
            ? t('providerSslStatusNearExpiry')
            : t('providerSslStatusHealthy')
  const statusCls =
    d.status === 'refreshing'
      ? 'text-info'
      : d.status === 'unavailable'
        ? d.error
          ? 'text-error'
          : 'text-base-content/70'
        : d.status === 'expired'
          ? 'text-error'
          : d.status === 'warning'
            ? 'text-warning'
            : 'text-success'
  return {
    ...d,
    statusLabel,
    statusCls,
    sourceLabel,
    checkedLabel,
    expiresLabel,
    urlLabel: d.sourceUrl || '—',
  }
})

const sslExpireBadge = computed(() => {
  const info = sslExpireInfo.value
  if (!info) return null

  if (!Number.isFinite(info.days)) {
    if ((info as any)?.isRefreshing) {
      return { badgeCls: 'badge-info badge-outline', text: t('providerSslRefreshing'), tip: info.tip }
    }
    return { badgeCls: 'badge-ghost', text: 'SSL —', tip: info.tip }
  }

  const level = info.days < 0 ? 'error' : info.days <= sslWarnDays.value ? 'warning' : 'success'
  const badgeCls =
    level === 'error'
      ? 'badge-error'
      : level === 'warning'
        ? 'badge-warning'
        : 'badge-success'

  const text = info.days < 0 ? t('providerSslStatusExpired') : `SSL ${info.days}${t('daysShort')}`
  return { badgeCls, text, tip: info.tip }
})

const subscriptionInfo = computed(() => {
  const info: any = (proxyProvider.value as any).subscriptionInfo
  if (!info) return null

  const parseBytes = (v: any): number => {
    if (v === null || v === undefined) return 0
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0

    if (typeof v === 'string') {
      const s0 = v.trim()
      if (!s0) return 0

      // Some backends may pass userinfo fragments like: "total=123; download=..."
      const kv = s0.match(/\b(?:total|download|upload)\s*=\s*([0-9]+(?:\.[0-9]+)?)(?:\s*([kmgtpe]?i?b?)\b)?/i)
      if (kv) {
        const num = Number(kv[1])
        const unit = (kv[2] || '').toUpperCase()
        const pow10: Record<string, number> = { K: 1, M: 2, G: 3, T: 4, P: 5, E: 6 }
        const base = unit.includes('I') ? 1024 : 1000
        const letter = unit.replace('IB', '').replace('B', '')
        const p = pow10[letter] || 0
        return num * Math.pow(base, p)
      }

      // plain number string
      if (/^[0-9]+(\.[0-9]+)?$/.test(s0)) return Number(s0) || 0

      // "<num><unit>" or "<num> <unit>"
      const m = s0.match(/^\s*([0-9]+(?:\.[0-9]+)?)\s*([kmgtpe]?i?b?)\s*$/i)
      if (m) {
        const num = Number(m[1])
        const unit = (m[2] || '').toUpperCase()
        const pow10: Record<string, number> = { K: 1, M: 2, G: 3, T: 4, P: 5, E: 6 }
        const base = unit.includes('I') ? 1024 : 1000
        const letter = unit.replace('IB', '').replace('B', '')
        const p = pow10[letter] || 0
        return num * Math.pow(base, p)
      }

      // Extract first "number+unit" anywhere
      const m2 = s0.match(/([0-9]+(?:\.[0-9]+)?)\s*([kmgtpe]?i?b?)\b/i)
      if (m2) {
        const num = Number(m2[1])
        const unit = (m2[2] || '').toUpperCase()
        const pow10: Record<string, number> = { K: 1, M: 2, G: 3, T: 4, P: 5, E: 6 }
        const base = unit.includes('I') ? 1024 : 1000
        const letter = unit.replace('IB', '').replace('B', '')
        const p = pow10[letter] || 0
        return num * Math.pow(base, p)
      }

      return Number(s0) || 0
    }

    return 0
  }

  const parseNumber = (v: any): number => {
    if (v === null || v === undefined) return 0
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0
    if (typeof v === 'string') {
      const s = v.trim()
      const m = s.match(/-?[0-9]+/)
      return m ? Number(m[0]) || 0 : 0
    }
    return 0
  }

  const getAny = (obj: any, candidates: string[]): any => {
    if (!obj || typeof obj !== 'object') return undefined
    const keys = Object.keys(obj)

    // exact match (case-insensitive)
    for (const c of candidates) {
      const k = keys.find((x) => x.toLowerCase() === c.toLowerCase())
      if (k) {
        const v = (obj as any)[k]
        if (v !== undefined && v !== null && `${v}`.trim() !== '') return v
      }
    }

    // contains match (case-insensitive)
    for (const c of candidates) {
      const lc = c.toLowerCase()
      const k = keys.find((x) => x.toLowerCase().includes(lc))
      if (k) {
        const v = (obj as any)[k]
        if (v !== undefined && v !== null && `${v}`.trim() !== '') return v
      }
    }

    return undefined
  }

  const parseUserinfoString = (s: string) => {
    const read = (k: string) => {
      const m = s.match(new RegExp(`\\b${k}\\s*=\\s*([0-9]+(?:\\.[0-9]+)?)`, 'i'))
      return m ? Number(m[1]) || 0 : 0
    }
    const download = read('download')
    const upload = read('upload')
    const total = read('total')
    const expire = read('expire')
    return { download, upload, total, expire }
  }

  const providerObj: any = proxyProvider.value as any

  const rawDownload = getAny(info, ['Download', 'download']) ?? getAny(providerObj, ['Download', 'download'])
  const rawUpload = getAny(info, ['Upload', 'upload']) ?? getAny(providerObj, ['Upload', 'upload'])
  const rawTotal = getAny(info, ['Total', 'total', 'quota', 'limit']) ?? getAny(providerObj, ['Total', 'total', 'quota', 'limit'])
  const rawExpire = getAny(info, ['Expire', 'expire', 'expiry', 'expiration']) ?? getAny(providerObj, ['Expire', 'expire', 'expiry', 'expiration'])

  let Download = parseBytes(rawDownload)
  let Upload = parseBytes(rawUpload)
  let Total = parseBytes(rawTotal)
  let Expire = parseNumber(rawExpire)

  // Fallback: scan any string field for "total=..."
  if (Total <= 0) {
    for (const v of Object.values(info)) {
      if (typeof v !== 'string') continue
      if (!/\btotal\s*=\s*/i.test(v)) continue
      const p = parseUserinfoString(v)
      if (p.total > 0) Total = p.total
      if (Download <= 0 && p.download > 0) Download = p.download
      if (Upload <= 0 && p.upload > 0) Upload = p.upload
      if (Expire <= 0 && p.expire > 0) Expire = p.expire
    }
  }

  if (Download === 0 && Upload === 0 && Total === 0 && Expire === 0) return null

  const { t } = useI18n()
  const usedBytes = Download + Upload
  const used = prettyBytesHelper(usedBytes, { binary: true })

  const isUnlimited =
    (rawTotal === 0 || rawTotal === '0' || rawTotal === '0B' || rawTotal === '0b' || rawTotal === -1 || rawTotal === '-1') && usedBytes > 0

  const totalLabel = Total > 0 ? prettyBytesHelper(Total, { binary: true }) : isUnlimited ? '∞' : '—'
  const percentage = Total > 0 ? ((usedBytes / Total) * 100).toFixed(2) : ''
  const usageStr = percentage ? `${used} / ${totalLabel} ( ${percentage}% )` : `${used} / ${totalLabel}`

  const expireSec = Expire > 1e12 ? Math.floor(Expire / 1000) : Expire
  const expireStr =
    expireSec === 0
      ? `${t('expire')}: ${t('noExpire')}`
      : `${t('expire')}: ${dayjs(expireSec * 1000).format('YYYY-MM-DD')}`

  const percentNumber = Total > 0 ? (usedBytes / Total) * 100 : null

  return {
    expireStr,
    usageStr,
    percent: percentNumber,
    totalLabel,
    raw: JSON.stringify(info, null, 2),
  }
})


const showRawSub = ref(false)

const isUpdating = ref(false)
const isHealthChecking = ref(false)
const isKilling = ref(false)

const killSessionsClickHandler = async () => {
  if (isKilling.value) return

  const count = Number(providerStats.value?.killableConnections || 0)
  if (count <= 0) return

  const okConfirm = window.confirm(
    t('killProviderSessionsConfirm', {
      name: proxyProvider.value?.name || props.name,
      count,
    }) as any,
  )
  if (!okConfirm) return

  isKilling.value = true
  try {
    const ids = activeConnectionTargets.value
      .map((c: any) => String(c?.id || ''))
      .filter(Boolean)

    let ok = 0
    let fail = 0
    for (const id of ids) {
      try {
        await disconnectByIdSilentAPI(id)
        ok++
      } catch {
        fail++
      }
    }

    showNotification({
      content: 'killProviderSessionsDone',
      params: {
        ok: String(ok),
        fail: String(fail),
        count: String(ids.length),
      },
      type: fail > 0 ? 'alert-warning' : 'alert-success',
    })
  } finally {
    isKilling.value = false
  }
}

const healthCheckClickHandler = async () => {
  if (isHealthChecking.value) return

  isHealthChecking.value = true
  try {
    await proxyProviderHealthCheckAPI(props.name)
    await fetchProxyProviderByNameOnly(props.name)
    isHealthChecking.value = false
  } catch {
    isHealthChecking.value = false
  }
}

const updateProviderClickHandler = async () => {
  if (isUpdating.value) return

  isUpdating.value = true
  try {
    await updateProxyProviderAPI(props.name)
    await fetchProxyProviderByNameOnly(props.name)
    isUpdating.value = false
  } catch {
    isUpdating.value = false
  }
}



// --- Quick actions for the currently used proxy inside this provider ---
const isActiveTesting = ref(false)

const activeProxyNode = computed(() => {
  const name = displayProxyName.value
  return name ? (proxyMap.value as any)?.[name] : null
})

const activeProxyUri = computed(() => {
  const node: any = activeProxyNode.value
  if (!node) return ''

  const candidates = ['uri', 'url', 'link', 'share', 'subscription', 'subscribe', 'proxyUrl']
  const v1 = getAnyFromObj(node, candidates)
  if (typeof v1 === 'string' && v1.includes('://')) return v1.trim()

  const v2 = getAnyFromObj(node?.extra, candidates)
  if (typeof v2 === 'string' && v2.includes('://')) return v2.trim()

  return ''
})

const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    showNotification({ content: 'copySuccess', type: 'alert-success', timeout: 1400 })
  } catch {
    showNotification({ content: 'operationFailed', type: 'alert-error', timeout: 2200 })
  }
}

const copyActiveName = async () => {
  if (!displayProxyName.value) return
  await copyText(displayProxyName.value)
}

const copyActiveUri = async () => {
  if (!activeProxyUri.value) return
  await copyText(activeProxyUri.value)
}

const testActiveNode = async () => {
  if (!displayProxyName.value) return
  if (isActiveTesting.value) return

  isActiveTesting.value = true
  try {
    await proxyLatencyTest(displayProxyName.value, getTestUrl(proxyProvider.value?.name))
  } finally {
    isActiveTesting.value = false
  }
}

useBounceOnVisible()
</script>
