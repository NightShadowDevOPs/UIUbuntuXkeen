<template>
  <div
    class="max-sm:scrollbar-hidden h-full overflow-y-scroll p-2 sm:pr-1"
    ref="proxiesRef"
    @scroll.passive="handleScroll"
  >
    <ProxyProvidersHealthSummary :compact="isProviderToolbarCompact" />
    <div
      v-if="proxiesTabShow === PROXY_TAB_TYPE.PROVIDER && renderGroups.length === 0"
      class="mt-6 rounded-xl border border-base-content/10 bg-base-200/40 p-4 text-sm opacity-80"
    >
      <div>{{ $t('providerNoMatches') }}</div>
      <button type="button" class="btn btn-sm mt-3" @click="resetProviderFilters">
        {{ $t('resetFilters') }}
      </button>
    </div>

    <template v-if="displayTwoColumns">
      <div class="grid grid-cols-2 gap-1">
        <div
          v-for="idx in [0, 1]"
          :key="idx"
          class="flex flex-1 flex-col gap-1"
        >
          <component
            v-for="name in filterContent(renderGroups, idx)"
            :is="renderComponent"
            :key="name"
            :name="name"
          />
        </div>
      </div>
    </template>
    <div
      class="grid grid-cols-1 gap-1"
      v-else
    >
      <component
        v-for="name in renderGroups"
        :is="renderComponent"
        :key="name"
        :name="name"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import ProxyGroup from '@/components/proxies/ProxyGroup.vue'
import ProxyGroupForMobile from '@/components/proxies/ProxyGroupForMobile.vue'
import ProxyProvider from '@/components/proxies/ProxyProvider.vue'
import ProxyProvidersHealthSummary from '@/components/proxies/ProxyProvidersHealthSummary.vue'
import { renderGroups } from '@/composables/proxies'
import { PROXY_TAB_TYPE, ROUTE_NAME } from '@/constant'
import { cleanupExpiredPendingPageFocus, clearPendingPageFocus, flashNavHighlight, getPendingPageFocusForRoute } from '@/helper/navFocus'
import { isMiddleScreen } from '@/helper/utils'
import { fetchProxies, proxyGroupList, proxyMap, proxiesTabShow } from '@/store/proxies'
import { collapseGroupMap, twoColumnProxyGroup, hideUnusedProxyProviders } from '@/store/settings'
import { providerHealthFilter, proxyProvidersProtoFilter, showOnlyActiveProxyProviders, showOnlyTrafficProxyProviders } from '@/store/providerHealth'
import { useElementSize, useSessionStorage } from '@vueuse/core'
import { computed, nextTick, onMounted, ref, watch } from 'vue'

const proxiesRef = ref()
const { width } = useElementSize(proxiesRef)
const scrollStatus = useSessionStorage('cache/proxies-scroll-status', {
  [PROXY_TAB_TYPE.PROVIDER]: 0,
  [PROXY_TAB_TYPE.PROXIES]: 0,
})

const handleScroll = () => {
  scrollStatus.value[proxiesTabShow.value] = proxiesRef.value.scrollTop
}

const isProviderToolbarCompact = computed(() => {
  return proxiesTabShow.value === PROXY_TAB_TYPE.PROVIDER && Number(scrollStatus.value[PROXY_TAB_TYPE.PROVIDER] || 0) > 12
})

const waitTickUntilReady = (startTime = performance.now()) => {
  if (
    performance.now() - startTime > 300 ||
    proxiesRef.value.scrollHeight > scrollStatus.value[proxiesTabShow.value]
  ) {
    proxiesRef.value.scrollTop = scrollStatus.value[proxiesTabShow.value]
  } else {
    requestAnimationFrame(() => {
      waitTickUntilReady(startTime)
    })
  }
}

watch(proxiesTabShow, () =>
  nextTick(() => {
    waitTickUntilReady()
  }),
)

onMounted(() => {
  waitTickUntilReady()
})

const isSmallScreen = computed(() => {
  return width.value < 640 && isMiddleScreen.value
})
const isWidthEnough = computed(() => {
  return width.value > 720
})

const renderComponent = computed(() => {
  if (proxiesTabShow.value === PROXY_TAB_TYPE.PROVIDER) {
    return ProxyProvider
  }

  if (isSmallScreen.value && displayTwoColumns.value) {
    return ProxyGroupForMobile
  }

  return ProxyGroup
})

const isProviderTab = computed(() => proxiesTabShow.value === PROXY_TAB_TYPE.PROVIDER)

const displayTwoColumns = computed(() => {
  // Two-column layout is used for proxy groups only.
  // Proxy-provider cards stay in a single vertical column so their heights can change
  // without reflowing adjacent cards during live refreshes.
  if (isProviderTab.value) return false

  if (renderGroups.value.length < 2 || !twoColumnProxyGroup.value) {
    return false
  }
  return (
    isWidthEnough.value || (isSmallScreen.value && proxiesTabShow.value === PROXY_TAB_TYPE.PROXIES)
  )
})

const filterContent: <T>(all: T[], target: number) => T[] = (all, target) => {
  return all.filter((_, index: number) => index % 2 === target)
}

fetchProxies()

const resetProviderFilters = () => {
  providerHealthFilter.value = ''
  proxyProvidersProtoFilter.value = 'all'
  showOnlyActiveProxyProviders.value = false
  showOnlyTrafficProxyProviders.value = false
  hideUnusedProxyProviders.value = false
}

// --- Cross-page navigation focus (Topology -> Proxies) ---
const findNavEl = (kind: string, value: string) => {
  const items = Array.from(document.querySelectorAll(`[data-nav-kind="${kind}"]`)) as HTMLElement[]
  return (
    items.find((el) => String((el as any).dataset?.navValue || '').trim() === String(value || '').trim()) ||
    null
  )
}

const findGroupForProxy = (proxyName: string) => {
  const name = String(proxyName || '').trim()
  if (!name) return ''
  for (const g of proxyGroupList.value || []) {
    const all = (proxyMap.value as any)?.[g]?.all || []
    if (Array.isArray(all) && all.includes(name)) return g
  }
  return ''
}

let focusApplied = false
const tryApplyPendingFocus = async () => {
  if (focusApplied) return
  const pf = getPendingPageFocusForRoute(ROUTE_NAME.proxies)
  if (!pf) return

  const v = String(pf.value || '').trim()
  if (!v) return

  // Ensure correct tab and open the relevant card/group for better UX.
  if (pf.kind === 'provider') {
    if (proxiesTabShow.value !== PROXY_TAB_TYPE.PROVIDER) proxiesTabShow.value = PROXY_TAB_TYPE.PROVIDER
    collapseGroupMap.value[v] = true
  } else {
    if (proxiesTabShow.value !== PROXY_TAB_TYPE.PROXIES) proxiesTabShow.value = PROXY_TAB_TYPE.PROXIES
  }

  // For a specific proxy node, open the group containing it (best-effort).
  let groupForNode = ''
  if (pf.kind === 'proxy') {
    groupForNode = findGroupForProxy(v)
    if (groupForNode) collapseGroupMap.value[groupForNode] = true
  }
  if (pf.kind === 'proxyGroup') {
    collapseGroupMap.value[v] = true
  }

  const start = performance.now()
  const loop = async () => {
    await nextTick()

    let el: HTMLElement | null = null
    if (pf.kind === 'provider') el = findNavEl('proxy-provider', v)
    else if (pf.kind === 'proxyGroup') el = findNavEl('proxy-group', v)
    else if (pf.kind === 'proxy') {
      el = findNavEl('proxy-node', v)
      if (!el && groupForNode) el = findNavEl('proxy-group', groupForNode)
    }

    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      flashNavHighlight(el)
      clearPendingPageFocus()
      focusApplied = true
      return
    }

    if (performance.now() - start < 2400) {
      requestAnimationFrame(() => loop())
    }
  }

  loop()
}

onMounted(() => {
  cleanupExpiredPendingPageFocus()
  tryApplyPendingFocus()
})

watch([renderGroups, proxiesTabShow], () => {
  tryApplyPendingFocus()
})
</script>
