<template>
  <div class="bg-base-200/50 home-page flex size-full">
    <SideBar v-if="!isMiddleScreen" />
    <RouterView v-slot="{ Component, route }">
      <div
        class="flex flex-1 flex-col overflow-hidden"
        ref="swiperRef"
      >
        <PageTitleBar :route-name="(route.name as string)" />

        <div
          v-if="ctrlsMap[route.name as string]"
          class="bg-base-100 ctrls-bar w-full"
          ref="ctrlsBarRef"
        >
          <component
            :is="ctrlsMap[route.name as string]"
            :is-large-ctrls-bar="isLargeCtrlsBar"
          />
        </div>

        <div class="relative h-0 flex-1">
          <div class="absolute flex h-full w-full flex-col overflow-y-auto">
            <Transition
              :name="(route.meta.transition as string) || 'fade'"
              v-if="isMiddleScreen"
            >
              <Component :is="Component" />
            </Transition>
            <Component
              v-else
              :is="Component"
            />
          </div>
        </div>
        <template v-if="isMiddleScreen">
          <div
            class="nav-bar shrink-0"
            :style="styleForSafeArea"
          />
          <div
            class="dock dock-sm bg-base-200 z-30"
            :style="styleForSafeArea"
          >
            <button
              v-for="r in renderRoutes"
              :key="r"
              @click="router.push({ name: r })"
              :class="r === route.name && 'dock-active'"
            >
              <component
                :is="ROUTE_ICON_MAP[r]"
                class="size-5"
              />
              <span class="dock-label">
                {{ $t(r) }}
              </span>
            </button>
          </div>
        </template>
      </div>
    </RouterView>

    <DialogWrapper v-model="autoSwitchBackendDialog">
      <h3 class="text-lg font-bold">{{ $t('currentBackendUnavailable') }}</h3>
      <div class="flex justify-end gap-2">
        <button
          class="btn btn-sm"
          @click="autoSwitchBackendDialog = false"
        >
          {{ $t('cancel') }}
        </button>
        <button
          class="btn btn-primary btn-sm"
          @click="autoSwitchBackend"
        >
          {{ $t('confirm') }}
        </button>
      </div>
    </DialogWrapper>

    <!-- Global search / command palette (Ctrl+K / Cmd+K) -->
    <GlobalSearchModal />
  </div>
</template>

<script setup lang="ts">
import { isBackendAvailable } from '@/api'
import DialogWrapper from '@/components/common/DialogWrapper.vue'
import GlobalSearchModal from '@/components/common/GlobalSearchModal.vue'
import PageTitleBar from '@/components/common/PageTitleBar.vue'
import ConnectionCtrl from '@/components/sidebar/ConnectionCtrl.tsx'
import LogsCtrl from '@/components/sidebar/LogsCtrl.tsx'
import ProxiesCtrl from '@/components/sidebar/ProxiesCtrl.tsx'
import RulesCtrl from '@/components/sidebar/RulesCtrl.tsx'
import SideBar from '@/components/sidebar/SideBar.vue'
import { useSettings } from '@/composables/settings'
import { initUserTrafficRecorder } from '@/composables/userTraffic'
import { initUserLimitsEnforcer } from '@/composables/userLimits'
import { useSwipeRouter } from '@/composables/swipe'
import { PROXY_TAB_TYPE, ROUTE_ICON_MAP, ROUTE_NAME, RULE_TAB_TYPE } from '@/constant'
import { renderRoutes } from '@/helper'
import { showNotification } from '@/helper/notification'
import { getLabelFromBackend, isMiddleScreen } from '@/helper/utils'
import { fetchConfigs } from '@/store/config'
import { initConnections } from '@/store/connections'
import { initLogs } from '@/store/logs'
import { initSatistic } from '@/store/overview'
import { fetchProxies, fetchProxyProvidersOnly, proxiesTabShow } from '@/store/proxies'
import { fetchRules, rulesTabShow } from '@/store/rules'
import { activeBackend, activeUuid, backendList } from '@/store/setup'
import type { Backend } from '@/types'
import { useDocumentVisibility, useElementSize } from '@vueuse/core'
import { computed, onMounted, onUnmounted, ref, watch, type Component } from 'vue'
import { RouterView, useRouter } from 'vue-router'
import { globalSearchOpen } from '@/store/globalSearch'

const ctrlsMap: Record<string, Component> = {
  [ROUTE_NAME.connections]: ConnectionCtrl,
  [ROUTE_NAME.logs]: LogsCtrl,
  [ROUTE_NAME.proxies]: ProxiesCtrl,
  [ROUTE_NAME.proxyProviders]: ProxiesCtrl,
  [ROUTE_NAME.rules]: RulesCtrl,
}

const styleForSafeArea = {
  height: 'calc(var(--spacing) * 14 + env(safe-area-inset-bottom))',
  'padding-bottom': 'env(safe-area-inset-bottom)',
}

const router = useRouter()
const { swiperRef } = useSwipeRouter()

// Global search keyboard shortcut (Ctrl+K / Cmd+K)
const globalSearchKeydown = (e: KeyboardEvent) => {
  if (e.key.toLowerCase() !== 'k') return
  if (!(e.ctrlKey || e.metaKey)) return
  // Avoid hijacking inside text inputs.
  const t = e.target as any
  const tag = String(t?.tagName || '').toLowerCase()
  if (tag === 'input' || tag === 'textarea' || t?.isContentEditable) return
  e.preventDefault()
  globalSearchOpen.value = true
}

onMounted(() => {
  document.addEventListener('keydown', globalSearchKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', globalSearchKeydown)
})

const ctrlsBarRef = ref<HTMLDivElement>()
const { width: ctrlsBarWidth } = useElementSize(ctrlsBarRef)
const isLargeCtrlsBar = computed(() => {
  return ctrlsBarWidth.value > 720
})

watch(
  activeUuid,
  () => {
    if (!activeUuid.value) return
    rulesTabShow.value = RULE_TAB_TYPE.RULES
    proxiesTabShow.value = PROXY_TAB_TYPE.PROXIES
    fetchConfigs()
    fetchProxies()
    fetchRules()
    initConnections()
    initUserTrafficRecorder()
    initUserLimitsEnforcer()
    initLogs()
    initSatistic()
  },
  {
    immediate: true,
  },
)

const autoSwitchBackendDialog = ref(false)

const autoSwitchBackend = async () => {
  const otherEnds = backendList.value.filter((end) => end.uuid !== activeUuid.value)

  autoSwitchBackendDialog.value = false
  const avaliable = await Promise.race<Backend>(
    otherEnds.map((end) => {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          reject()
        }, 10000)
        isBackendAvailable(end).then((res) => {
          if (res) {
            resolve(end)
          }
        })
      })
    }),
  )

  if (avaliable) {
    activeUuid.value = avaliable.uuid
    showNotification({
      content: 'backendSwitchTo',
      params: {
        backend: getLabelFromBackend(avaliable),
      },
    })
  }
}

const documentVisible = useDocumentVisibility()

watch(
  documentVisible,
  async () => {
    if (
      !activeBackend.value ||
      backendList.value.length < 2 ||
      documentVisible.value !== 'visible'
    ) {
      return
    }
    try {
      const activeBackendUuid = activeBackend.value.uuid
      const isAvailable = await isBackendAvailable(activeBackend.value)

      if (activeBackendUuid !== activeUuid.value) {
        return
      }

      if (!isAvailable) {
        autoSwitchBackendDialog.value = true
      }
    } catch {
      autoSwitchBackendDialog.value = true
    }
  },
  {
    immediate: true,
  },
)

let lastVisibleProxiesRefresh = 0

watch(documentVisible, () => {
  if (documentVisible.value !== 'visible') return

  // Avoid aggressive full refresh when switching browser tabs.
  // The Providers tab should refresh "softly" (only providers), without remounting the whole page.
  const now = Date.now()
  if (now - lastVisibleProxiesRefresh < 4000) return
  lastVisibleProxiesRefresh = now

  // Only refresh proxies data when user is on the Proxies page.
  const routeName = router.currentRoute.value?.name
  if (routeName !== ROUTE_NAME.proxies && routeName !== ROUTE_NAME.proxyProviders) return

  if (proxiesTabShow.value === PROXY_TAB_TYPE.PROVIDER) {
    fetchProxyProvidersOnly()
  } else {
    fetchProxies()
  }
})

const { checkUIUpdate } = useSettings()

checkUIUpdate()
</script>
