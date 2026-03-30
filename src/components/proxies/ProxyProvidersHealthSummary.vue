<script setup lang="ts">
import { getProviderHealth } from '@/helper/providerHealth'
import { isMiddleScreen } from '@/helper/utils'
import { normalizeProxyProtoKey, protoLabel } from '@/helper/proxyProto'
import { PROXY_TAB_TYPE } from '@/constant'
import { proxiesTabShow, proxyGroupList, proxyMap, proxyProviederList } from '@/store/proxies'
import { providerActivityByName, providerLiveStatusByName } from '@/store/providerActivity'
import { hideUnusedProxyProviders, hiddenProxyProviderProtoKeys, proxyProviderSslWarnDaysMap, sslNearExpiryDaysDefault } from '@/store/settings'
import {
  agentProviderByName,
  agentProviders,
  agentProvidersAt,
  agentProvidersError,
  agentProvidersLoading,
  agentProvidersOk,
  agentProvidersSslCacheReady,
  agentProvidersSslRefreshPending,
  agentProvidersSslRefreshing,
  fetchAgentProviders,
  providerHealthFilter,
  proxyProvidersSortMode,
  showOnlyActiveProxyProviders,
  showOnlyTrafficProxyProviders,
  proxyProvidersProtoFilter,
} from '@/store/providerHealth'
import dayjs from 'dayjs'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(defineProps<{
  compact?: boolean
}>(), {
  compact: false,
})

const { t } = useI18n()

const usedProxyNames = computed(() => {
  const set = new Set<string>()
  for (const g of proxyGroupList.value) {
    for (const n of proxyMap.value[g]?.all || []) set.add(n)
  }
  return set
})

const isUsed = (provider: any) => {
  if (usedProxyNames.value.has(provider.name)) return true
  return (provider.proxies || []).some((p: any) => {
    const name = typeof p === 'string' ? p : p?.name
    return name ? usedProxyNames.value.has(name) : false
  })
}

const allProviders = computed(() => proxyProviederList.value || [])

const providersAfterHideUnused = computed(() => {
  let list = allProviders.value || []
  if (hideUnusedProxyProviders.value) {
    list = list.filter((p) => isUsed(p))
  }
  return list
})

const providerMatchesProto = (provider: any, protoKeyRaw?: string) => {
  const protoKey = normalizeProxyProtoKey(String(protoKeyRaw || 'all')) || 'all'
  if (protoKey === 'all') return true

  const providerProto = normalizeProxyProtoKey((provider as any)?.type)
  if (providerProto === protoKey) return true

  return (((provider as any)?.proxies || []) as any[]).some((n: any) => {
    const t0 = typeof n === 'string' ? (proxyMap.value[n]?.type as any) : (n as any)?.type
    return normalizeProxyProtoKey(t0) === protoKey
  })
}

const selectedProto = computed(() => String(proxyProvidersProtoFilter.value || 'all').trim())

const providersProtoScoped = computed(() => {
  return (providersAfterHideUnused.value || []).filter((p) => providerMatchesProto(p, selectedProto.value))
})

const isProviderActive = (provider: any) => {
  const act = (providerActivityByName.value || {})[provider?.name]
  const live = (providerLiveStatusByName.value || {})[provider?.name]
  return Boolean((live as any)?.active)
    || Number((live as any)?.connections ?? 0) > 0
    || Boolean((act as any)?.active)
    || Number((act as any)?.connections ?? 0) > 0
    || Number((act as any)?.currentBytes ?? 0) > 0
    || Number((act as any)?.speed ?? 0) > 0
    || Number((act as any)?.bytes ?? 0) > 0
}

const isProviderWithTraffic = (provider: any) => {
  const act = (providerActivityByName.value || {})[provider?.name]
  const live = (providerLiveStatusByName.value || {})[provider?.name]
  return Number((act as any)?.todayBytes ?? 0) > 0
    || Number((act as any)?.bytes ?? 0) > 0
    || Number((act as any)?.currentBytes ?? 0) > 0
    || Number((act as any)?.speed ?? 0) > 0
    || Boolean((live as any)?.active)
    || Number((live as any)?.connections ?? 0) > 0
}

const activeProvidersScoped = computed(() => {
  return (providersProtoScoped.value || []).filter((p) => isProviderActive(p))
})

const trafficProvidersScoped = computed(() => {
  return (providersProtoScoped.value || []).filter((p) => isProviderWithTraffic(p))
})

const providersScoped = computed(() => {
  let list = providersProtoScoped.value || []

  if (showOnlyActiveProxyProviders.value) {
    list = list.filter((p) => isProviderActive(p))
  }

  if (showOnlyTrafficProxyProviders.value) {
    list = list.filter((p) => isProviderWithTraffic(p))
  }

  return list
})

const hiddenUnusedCount = computed(() => {
  if (!hideUnusedProxyProviders.value) return 0
  return Math.max(0, (allProviders.value.length || 0) - (providersAfterHideUnused.value.length || 0))
})

const counts = computed(() => {
  const c = { total: 0, expired: 0, nearExpiry: 0, offline: 0, degraded: 0, healthy: 0 }
  for (const p of providersScoped.value) {
    c.total++
    const override = Number((proxyProviderSslWarnDaysMap.value || {})[p.name])
    const base = Number(sslNearExpiryDaysDefault.value)
    const nearDays = Number.isFinite(override) ? override : Number.isFinite(base) ? base : 2
    const h = getProviderHealth(p as any, agentProviderByName.value[p.name], { nearExpiryDays: nearDays })
    ;(c as any)[h.status]++
  }
  return c
})

const protoTabs = computed(() => {
  const m = new Map<string, number>()

  for (const p of providersAfterHideUnused.value || []) {
    const seen = new Set<string>()
    for (const n of ((p as any)?.proxies || []) as any[]) {
      const t0 = typeof n === 'string' ? (proxyMap.value[n]?.type as any) : (n as any)?.type
      const k = normalizeProxyProtoKey(t0)
      if (k) seen.add(k)
    }
    for (const k of seen) {
      m.set(k, (m.get(k) || 0) + 1)
    }
  }

  const arr = Array.from(m.entries()).map(([key, count]) => ({
    key,
    label: protoLabel(key),
    count,
  }))
  arr.sort((a, b) => (b.count - a.count) || a.key.localeCompare(b.key))

  const out: any[] = [{ key: 'all', label: '', count: providersAfterHideUnused.value.length }]
  out.push(...arr)
  return out
})


const hiddenProtoSet = computed(() => {
  const raw = hiddenProxyProviderProtoKeys.value || []
  const out = new Set<string>()
  for (const k of raw as any[]) {
    const kk = normalizeProxyProtoKey(String(k || ''))
    if (kk && kk !== 'all') out.add(kk)
  }
  return out
})

const protoTabsVisible = computed(() => {
  const hidden = hiddenProtoSet.value
  const tabs = protoTabs.value || []
  return (tabs as any[]).filter((t) => String((t as any)?.key) === 'all' || !hidden.has(String((t as any)?.key)))
})

const manageableProtoTabs = computed(() => {
  return (protoTabs.value || []).filter((t: any) => String(t?.key) !== 'all')
})


const setHiddenProtoKeys = (keys: string[]) => {
  const set = new Set<string>()
  for (const x of keys || []) {
    const k = normalizeProxyProtoKey(String(x || ''))
    if (k && k !== 'all') set.add(k)
  }
  hiddenProxyProviderProtoKeys.value = Array.from(set).sort((a, b) => a.localeCompare(b))
}

const presetShowAllProtos = () => {
  hiddenProxyProviderProtoKeys.value = []
}

const presetHideDirectReject = () => {
  // overwrite to exactly DIRECT+REJECT (if they exist)
  const available = new Set((manageableProtoTabs.value || []).map((t: any) => String(t?.key)))
  const keys = ['direct', 'reject'].filter((k) => available.has(k))
  setHiddenProtoKeys(keys)
}

const toggleProtoHidden = (k0: string) => {
  const k = normalizeProxyProtoKey(String(k0 || ''))
  if (!k || k === 'all') return

  const cur = Array.isArray(hiddenProxyProviderProtoKeys.value) ? [...hiddenProxyProviderProtoKeys.value] : []
  const set = new Set<string>()
  for (const x of cur as any[]) {
    const kk = normalizeProxyProtoKey(String(x || ''))
    if (kk && kk !== 'all') set.add(kk)
  }

  if (set.has(k)) set.delete(k)
  else set.add(k)

  hiddenProxyProviderProtoKeys.value = Array.from(set).sort((a, b) => a.localeCompare(b))
}

const setProto = (k: string) => {
  proxyProvidersProtoFilter.value = k || 'all'
}

watch(
  protoTabsVisible,
  (tabs) => {
    const keys = new Set((tabs || []).map((t: any) => String(t.key)))
    const cur = String(proxyProvidersProtoFilter.value || 'all')
    if (!keys.has(cur)) proxyProvidersProtoFilter.value = 'all'
  },
  { immediate: true },
)
const activeProvidersCount = computed(() => activeProvidersScoped.value.length)

const trafficProvidersCount = computed(() => trafficProvidersScoped.value.length)

const lastAgentUpdate = computed(() => {
  if (!agentProvidersAt.value) return ''
  return dayjs(agentProvidersAt.value).format('HH:mm:ss')
})

const agentProvidersAvailable = computed(() => agentProvidersOk.value || (agentProviders.value?.length || 0) > 0)

const providerSslRefreshingText = computed(() => {
  if (agentProvidersSslRefreshing.value || agentProvidersSslRefreshPending.value) return t('providerSslRefreshing')
  if (!agentProvidersSslCacheReady.value && agentProvidersAvailable.value) return t('providerSslPending')
  return ''
})

const setFilter = (v: string) => {
  providerHealthFilter.value = providerHealthFilter.value === v ? '' : v
}

const refresh = async () => {
  await fetchAgentProviders(true)
}

const show = computed(() => proxiesTabShow.value === PROXY_TAB_TYPE.PROVIDER)
const isViewportCompact = computed(() => props.compact || isMiddleScreen.value)
const scrolledCondensed = ref(false)

let scrollRaf = 0
const updateScrollCondensed = () => {
  if (typeof window === 'undefined') return
  const y = window.scrollY || window.pageYOffset || 0
  scrolledCondensed.value = y > 180
}

const handleViewportScroll = () => {
  if (typeof window === 'undefined') return
  if (scrollRaf) return
  scrollRaf = window.requestAnimationFrame(() => {
    scrollRaf = 0
    updateScrollCondensed()
  })
}

onMounted(() => {
  updateScrollCondensed()
  if (typeof window === 'undefined') return
  window.addEventListener('scroll', handleViewportScroll, { passive: true })
  window.addEventListener('resize', handleViewportScroll, { passive: true })
})

onBeforeUnmount(() => {
  if (typeof window === 'undefined') return
  window.removeEventListener('scroll', handleViewportScroll)
  window.removeEventListener('resize', handleViewportScroll)
  if (scrollRaf) {
    window.cancelAnimationFrame(scrollRaf)
    scrollRaf = 0
  }
})

const miniToolbar = computed(() => isViewportCompact.value || scrolledCondensed.value)

const wrapperClass = computed(() => [
  'sticky top-0 z-30 -mx-2 px-2 pb-2 transition-all duration-150',
  miniToolbar.value
    ? 'bg-base-100/75 supports-[backdrop-filter]:bg-base-100/55 backdrop-blur-md shadow-sm'
    : 'bg-transparent',
])

const panelClass = computed(() => [
  'flex flex-wrap items-center rounded-xl ring-1 ring-base-300 transition-all duration-150',
  miniToolbar.value
    ? 'gap-1.5 bg-base-200/95 px-2.5 py-2 shadow-lg sm:gap-2 sm:px-3'
    : 'gap-2 bg-base-200 px-3 py-2 shadow-md',
])

const protoRowClass = computed(() => miniToolbar.value
  ? 'flex w-full flex-col items-stretch gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2'
  : 'flex w-full flex-wrap items-center gap-2')

const protoTabsWrapClass = computed(() => miniToolbar.value
  ? 'w-full overflow-x-auto pb-1 sm:w-auto sm:overflow-visible sm:pb-0'
  : '')

const healthSectionClass = computed(() => miniToolbar.value
  ? 'flex w-full flex-col gap-1.5 sm:w-auto sm:flex-1'
  : 'flex flex-1 flex-wrap items-center gap-2')

const actionsClass = computed(() => miniToolbar.value
  ? 'flex w-full flex-wrap items-center gap-1.5 sm:ml-auto sm:w-auto sm:gap-2'
  : 'ml-auto flex items-center gap-2')

const compactBadgeClass = computed(() => miniToolbar.value ? 'badge-sm text-[11px]' : '')
const compactSelectClass = computed(() => miniToolbar.value ? 'select-bordered select-xs min-w-[7.5rem] flex-1 sm:flex-none' : 'select-bordered select-xs')
const compactMetaClass = computed(() => miniToolbar.value ? 'w-full text-[11px] opacity-70 sm:w-auto sm:text-xs' : 'text-xs opacity-70')
const compactMetaWarningClass = computed(() => miniToolbar.value ? 'w-full text-[11px] text-warning sm:w-auto sm:text-xs' : 'text-xs text-warning')
</script>

<template>
  <div
    v-if="show"
    :class="wrapperClass"
  >
    <div
      :class="panelClass"
    >
      <div v-if="protoTabs.length > 1" :class="protoRowClass" data-proto-tabs>
        <div :class="protoTabsWrapClass">
          <div class="tabs tabs-boxed tabs-sm inline-flex whitespace-nowrap">
          <a
            v-for="t2 in protoTabsVisible"
            :key="t2.key"
            class="tab"
            :class="proxyProvidersProtoFilter === t2.key ? 'tab-active' : ''"
            @click="setProto(t2.key)"
            :title="t2.key === 'all' ? $t('all') : (t2.label + ': ' + t2.count)"
          >
            <template v-if="t2.key === 'all'">{{ $t('all') }}</template>
            <template v-else>{{ t2.label }} ({{ t2.count }})</template>
          </a>
          </div>
        </div>

        <div v-if="!miniToolbar" class="text-[11px] opacity-60">{{ $t('providerProtoTip') }}</div>

        <div v-if="manageableProtoTabs.length" :class="miniToolbar ? 'flex justify-end' : 'ml-auto'">
          <details class="dropdown dropdown-end">
            <summary
              class="btn btn-ghost btn-xs"
              @click.stop
              :title="$t('providerProtoManage')"
            >
              ⚙
            </summary>
            <div class="dropdown-content z-[999] mt-2 w-64 rounded-box !bg-base-100 !bg-opacity-100 opacity-100 p-2 shadow-2xl ring-1 ring-base-300 backdrop-blur-none">
              <div class="text-xs font-medium mb-1">{{ $t('providerProtoManage') }}</div>
              <div class="text-[11px] opacity-70 mb-2">{{ $t('providerProtoTip') }}</div>
              <div class="flex flex-wrap items-center gap-2 mb-2">
                <button type="button" class="btn btn-xs" @click.stop.prevent="presetShowAllProtos">{{ $t('providerProtoShowAll') }}</button>
                <button type="button" class="btn btn-xs" @click.stop.prevent="presetHideDirectReject">{{ $t('providerProtoHideDirectReject') }}</button>
              </div>
              <div class="max-h-64 overflow-auto">
                <div
                  v-for="t2 in manageableProtoTabs"
                  :key="t2.key"
                  class="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-base-300"
                >
                  <input
                    type="checkbox"
                    class="checkbox checkbox-xs"
                    :checked="!hiddenProtoSet.has(String(t2.key))"
                    @change="toggleProtoHidden(String(t2.key))"
                  />
                  <div class="text-sm">{{ t2.label }}</div>
                  <div class="ml-auto text-[11px] opacity-70">{{ t2.count }}</div>
                </div>
                <div v-if="!manageableProtoTabs.length" class="text-xs opacity-60 px-2 py-1">{{ $t('noData') }}</div>
              </div>
            </div>
          </details>
        </div>
      </div>

      <div class="w-full"></div>
      <div :class="healthSectionClass">
        <div class="font-medium">
          {{ $t('providerHealth') }}
        </div>

        <div class="flex flex-wrap items-center gap-1">
        <button
          class="badge badge-neutral cursor-pointer"
          :class="[compactBadgeClass, providerHealthFilter === '' ? 'badge-outline' : '']"
          @click="setFilter('')"
          :title="$t('providerHealthAll')"
        >
          {{ $t('providerHealthAll') }}: {{ counts.total }}
        </button>
        <button
          class="badge badge-error cursor-pointer"
          :class="[compactBadgeClass, providerHealthFilter === 'expired' ? '' : 'badge-outline']"
          @click="setFilter('expired')"
        >
          {{ $t('providerHealthExpired') }}: {{ counts.expired }}
        </button>
        <button
          class="badge badge-warning cursor-pointer"
          :class="[compactBadgeClass, providerHealthFilter === 'nearExpiry' ? '' : 'badge-outline']"
          @click="setFilter('nearExpiry')"
        >
          {{ $t('providerHealthNearExpiry') }}: {{ counts.nearExpiry }}
        </button>
        <button
          class="badge badge-error cursor-pointer"
          :class="[compactBadgeClass, providerHealthFilter === 'offline' ? '' : 'badge-outline']"
          @click="setFilter('offline')"
        >
          {{ $t('providerHealthOffline') }}: {{ counts.offline }}
        </button>
        <button
          class="badge badge-warning cursor-pointer"
          :class="[compactBadgeClass, providerHealthFilter === 'degraded' ? '' : 'badge-outline']"
          @click="setFilter('degraded')"
        >
          {{ $t('providerHealthDegraded') }}: {{ counts.degraded }}
        </button>
        <button
          class="badge badge-success cursor-pointer"
          :class="[compactBadgeClass, providerHealthFilter === 'healthy' ? '' : 'badge-outline']"
          @click="setFilter('healthy')"
        >
          {{ $t('providerHealthHealthy') }}: {{ counts.healthy }}
        </button>
        </div>
      </div>

      <div :class="actionsClass">

        <button
          class="badge badge-neutral cursor-pointer"
          :class="[compactBadgeClass, hideUnusedProxyProviders ? '' : 'badge-outline']"
          @click="hideUnusedProxyProviders = !hideUnusedProxyProviders"
          :title="$t('providerHideUnusedTip')"
        >
          {{ $t('providerHideUnused') }}
          <template v-if="hiddenUnusedCount > 0">
            • {{ $t('providerHiddenCount', { n: hiddenUnusedCount }) }}
          </template>
        </button>

        <button
          class="badge badge-neutral cursor-pointer"
          :class="[compactBadgeClass, showOnlyActiveProxyProviders ? '' : 'badge-outline']"
          @click="showOnlyActiveProxyProviders = !showOnlyActiveProxyProviders"
          :title="$t('providerOnlyActiveTip')"
        >
          {{ $t('providerOnlyActive') }}: {{ activeProvidersCount }}
        </button>

        <button
          class="badge badge-neutral cursor-pointer"
          :class="[compactBadgeClass, showOnlyTrafficProxyProviders ? '' : 'badge-outline']"
          @click="showOnlyTrafficProxyProviders = !showOnlyTrafficProxyProviders"
          :title="$t('providerOnlyTrafficTip')"
        >
          {{ $t('providerOnlyTraffic') }}: {{ trafficProvidersCount }}
        </button>

        <select
          class="select"
          :class="compactSelectClass"
          v-model="proxyProvidersSortMode"
          :title="$t('sortBy')"
        >
          <option value="health">{{ $t('providerSortHealth') }}</option>
          <option value="traffic">{{ $t('providerSortTraffic') }}</option>
          <option value="activity">{{ $t('providerSortActivity') }}</option>
          <option value="name">{{ $t('providerSortName') }}</option>
        </select>
        <div
          v-if="agentProvidersAvailable"
          :class="compactMetaClass"
          :title="$t('lastCheck')"
        >
          {{ $t('updated') }} {{ lastAgentUpdate }}
        </div>
        <div
          v-if="providerSslRefreshingText"
          class="badge badge-info badge-outline"
          :class="compactBadgeClass"
          :title="$t('providerSslRefreshingTip')"
        >
          {{ providerSslRefreshingText }}
        </div>
        <div
          v-else-if="agentProvidersError"
          :class="compactMetaWarningClass"
          :title="agentProvidersError"
        >
          {{ $t('providerHealthAgentOffline') }}
        </div>
        <button
          class="btn btn-ghost btn-xs"
          :class="miniToolbar ? 'ml-auto sm:ml-0' : ''"
          @click="refresh"
          :disabled="agentProvidersLoading"
        >
          <span
            v-if="agentProvidersLoading"
            class="loading loading-spinner loading-xs"
          ></span>
          <span v-else>
            {{ $t('refresh') }}
          </span>
        </button>
      </div>
    </div>
  </div>
</template>
