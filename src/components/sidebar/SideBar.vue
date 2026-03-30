<template>
  <div
    class="sidebar bg-base-200 text-base-content scrollbar-hidden h-full overflow-x-hidden p-2 transition-all"
    :class="isSidebarCollapsed ? 'w-18 px-0' : 'w-64'"
  >
    <div :class="twMerge('flex h-full flex-col gap-2', isSidebarCollapsed ? 'w-18 px-0' : 'w-60')">
      <ul class="menu w-full flex-1">
        <li @mouseenter="(e) => mouseenterHandler(e, 'globalSearch')">
          <button
            type="button"
            :class="[
              globalSearchOpen ? activeNavClass : inactiveNavClass,
              isSidebarCollapsed && 'justify-center',
              'w-full py-2 rounded-xl transition-all',
            ]"
            @click="openGlobalSearch"
          >
            <MagnifyingGlassIcon class="h-5 w-5" />
            <template v-if="!isSidebarCollapsed">
              {{ $t('globalSearch') }}
              <span class="ml-auto text-[10px] opacity-60">Ctrl+K</span>
            </template>
          </button>
        </li>

        <template
          v-for="section in navSections"
          :key="section.key"
        >
          <li
            v-if="!isSidebarCollapsed"
            class="menu-title px-3 pt-4 pb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-base-content/45"
          >
            <span>{{ $t(section.key) }}</span>
          </li>

          <li
            v-for="r in section.routes"
            :key="r"
            @mouseenter="(e) => mouseenterHandler(e, r)"
          >
            <a
              :class="[
                r === route.name ? activeNavClass : inactiveNavClass,
                isSidebarCollapsed && 'justify-center',
                'py-2 rounded-xl transition-all',
              ]"
              @click.passive="() => router.push({ name: r })"
            >
              <component
                :is="ROUTE_ICON_MAP[r]"
                class="h-5 w-5"
              />
              <template v-if="!isSidebarCollapsed">
                {{ $t(r) }}
              </template>
            </a>
          </li>
        </template>
      </ul>
      <template v-if="isSidebarCollapsed">
        <VerticalInfos v-if="showStatisticsWhenSidebarCollapsed" />
        <div
          v-else
          class="flex w-full items-center justify-center"
        >
          <button
            class="btn btn-circle btn-sm bg-base-300"
            @click="isSidebarCollapsed = false"
          >
            <ArrowRightCircleIcon class="h-5 w-5" />
          </button>
        </div>
      </template>
      <template v-else>
        <OverviewCarousel v-if="route.name !== ROUTE_NAME.overview" />
        <div class="card">
          <CommonSidebar />
        </div>
        <div class="flex w-full items-center justify-center">
          <button
            class="btn btn-ghost btn-sm w-full justify-start bg-base-100/40"
            @click="isSidebarCollapsed = true"
          >
            <ArrowLeftCircleIcon class="h-5 w-5" />
            <span class="ml-1">{{ $t('collapseMenu') }}</span>
          </button>
        </div>
      </template>
      <div class="px-2 pb-2" :class="isSidebarCollapsed ? 'space-y-1' : 'space-y-2'">
        <div class="px-1 text-[11px] font-semibold text-base-content/85" :class="isSidebarCollapsed ? 'text-center' : ''">
          UI Mihomo/Ultra {{ zashboardVersion }} · Netcraze Ultra/Mihomo
        </div>

        <template v-if="!isSidebarCollapsed">
          <div
            class="rounded-2xl border px-2.5 py-2 text-xs shadow-sm"
            :class="sidebarBuildCardClass"
          >
            <div class="flex items-center gap-2">
              <span class="inline-flex h-2.5 w-2.5 rounded-full" :class="sidebarBuildDotClass"></span>
              <span class="font-semibold">{{ $t(sidebarBuildLabelKey) }}</span>
              <span v-if="isFreshUiBuildAvailable" class="ml-auto badge badge-warning badge-xs">UI</span>
            </div>
            <div class="mt-1 text-[11px] opacity-75">
              {{ sidebarBuildHint }}
            </div>
            <div class="mt-2 flex flex-wrap gap-2">
              <button
                v-if="isFreshUiBuildAvailable"
                class="btn btn-warning btn-xs"
                @click="hardRefreshUiCache"
              >
                {{ $t('uiHardRefresh') }}
              </button>
              <button
                v-else
                class="btn btn-ghost btn-xs"
                @click="checkFreshUiBuild"
              >
                {{ $t('uiCheckFreshness') }}
              </button>
            </div>
          </div>
        </template>

        <template v-else>
          <div class="flex justify-center">
            <button
              class="btn btn-circle btn-xs"
              :class="isFreshUiBuildAvailable ? 'btn-warning' : isUiBuildChecking ? 'btn-ghost animate-pulse' : 'btn-ghost'"
              :title="$t(sidebarBuildLabelKey)"
              @click="isFreshUiBuildAvailable ? hardRefreshUiCache() : checkFreshUiBuild()"
            >
              <span class="inline-flex h-2.5 w-2.5 rounded-full" :class="sidebarBuildDotClass"></span>
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import CommonSidebar from '@/components/sidebar/CommonCtrl.vue'
import { useUiBuild } from '@/composables/uiBuild'
import { zashboardVersion } from '@/api'
import { ROUTE_ICON_MAP, ROUTE_NAME } from '@/constant'
import { navSections } from '@/helper'
import { useTooltip } from '@/helper/tooltip'
import router from '@/router'
import { isSidebarCollapsed, showStatisticsWhenSidebarCollapsed } from '@/store/settings'
import { globalSearchOpen } from '@/store/globalSearch'
import { ArrowLeftCircleIcon, ArrowRightCircleIcon, MagnifyingGlassIcon } from '@heroicons/vue/24/outline'
import { twMerge } from 'tailwind-merge'
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import OverviewCarousel from './OverviewCarousel.vue'
import VerticalInfos from './VerticalInfos.vue'

const { showTip } = useTooltip()
const { t } = useI18n()

const mouseenterHandler = (e: MouseEvent, r: string) => {
  if (!isSidebarCollapsed.value) return
  const label = r === 'globalSearch' ? t('globalSearch') : t(r)
  showTip(e, label, {
    placement: 'right',
  })
}

const route = useRoute()
const { isFreshUiBuildAvailable, isUiBuildChecking, uiBuildCheckError, checkFreshUiBuild, hardRefreshUiCache } = useUiBuild()

const sidebarBuildLabelKey = computed(() => {
  if (isUiBuildChecking.value) return 'uiSidebarBuildChecking'
  if (uiBuildCheckError.value) return 'uiSidebarBuildCheckFailed'
  if (isFreshUiBuildAvailable.value) return 'uiSidebarBuildUpdateReady'
  return 'uiSidebarBuildCurrent'
})

const sidebarBuildHint = computed(() => {
  if (isUiBuildChecking.value) return t('uiSidebarBuildHintChecking')
  if (uiBuildCheckError.value) return uiBuildCheckError.value
  if (isFreshUiBuildAvailable.value) return t('uiSidebarBuildHintUpdateReady')
  return t('uiSidebarBuildHintCurrent')
})

const sidebarBuildCardClass = computed(() => {
  if (isUiBuildChecking.value) return 'border-base-300/70 bg-base-100/60 text-base-content'
  if (uiBuildCheckError.value) return 'border-error/40 bg-error/10 text-error-content'
  if (isFreshUiBuildAvailable.value) return 'border-warning/40 bg-warning/15 text-base-content'
  return 'border-success/30 bg-success/10 text-base-content'
})

const sidebarBuildDotClass = computed(() => {
  if (isUiBuildChecking.value) return 'bg-base-content/60'
  if (uiBuildCheckError.value) return 'bg-error'
  if (isFreshUiBuildAvailable.value) return 'bg-warning'
  return 'bg-success'
})

const activeNavClass = 'menu-active bg-primary/90 text-primary-content shadow-md ring-1 ring-primary/40 font-semibold'
const inactiveNavClass = 'hover:bg-base-300/70 hover:text-base-content'

const openGlobalSearch = () => {
  globalSearchOpen.value = true
}

</script>
