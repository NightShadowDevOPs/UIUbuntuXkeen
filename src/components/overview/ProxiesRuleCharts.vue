<template>
  <div
    :class="twMerge('relative w-full overflow-hidden rounded-2xl')"
    :style="isFullScreen ? '' : `height: ${topologyHeight}px;`"
    @mousemove.stop
    @touchmove.stop
  >
    <div ref="chart" class="h-full w-full" />
    <span class="border-base-content/30 text-base-content/10 bg-base-100/70 hidden" ref="colorRef" />


	    <div ref="controlsBar" class="absolute left-4 top-4 z-20 flex flex-wrap items-center gap-2">
      <div v-if="filterMode !== 'none'" class="flex items-center gap-1">
        <button
          class="badge badge-outline cursor-pointer hover:opacity-80 max-w-[min(820px,calc(100vw-12rem))] truncate"
          @click.stop="clearFilter"
          :title="activeFilterChip?.title || $t('clear')"
        >
          {{ activeFilterChip?.text || (filterMode === 'only' ? $t('topologyFilterOnly') : $t('topologyFilterExclude')) }}
        </button>

        <button
          class="btn btn-ghost btn-xs btn-square"
          @click.stop="toggleFilterLock"
          :title="filterLocked ? $t('topologyUnpinFilter') : $t('topologyPinFilter')"
        >
          <component :is="filterLocked ? LockClosedIcon : LockOpenIcon" class="h-4 w-4" />
        </button>
      </div>

      <button class="btn btn-ghost btn-xs" @click.stop="presetDialogShow = true" :title="$t('presets')">
        <BookmarkIcon class="h-4 w-4" />
        <span class="max-sm:hidden">{{ $t('presets') }}</span>
        <span
          v-if="activePreset"
          class="badge badge-outline badge-sm ml-1 max-w-[160px] truncate"
          :title="activePreset.name"
        >
          {{ activePreset.name }}
        </span>
      </button>

	      <!-- unified control: weight mode + Top-N -->
	      <div class="join" @click.stop>
	        <button
	          class="btn btn-xs join-item"
	          :class="proxiesRelationshipWeightMode === 'traffic' ? 'btn-active' : ''"
	          @click.stop="proxiesRelationshipWeightMode = 'traffic'"
	          :title="$t('traffic')"
	        >
	          {{ $t('traffic') }}
	        </button>
	        <button
	          class="btn btn-xs join-item"
	          :class="proxiesRelationshipWeightMode === 'count' ? 'btn-active' : ''"
	          @click.stop="proxiesRelationshipWeightMode = 'count'"
	          :title="$t('count')"
	        >
	          {{ $t('count') }}
	        </button>
	        <select
	          class="select select-xs join-item"
	          v-model.number="proxiesRelationshipTopN"
	          @click.stop
	          @mousedown.stop
	          title="Top N"
	        >
	          <option :value="10">Top 10</option>
	          <option :value="20">Top 20</option>
	          <option :value="30">Top 30</option>
	          <option :value="40">Top 40</option>
	          <option :value="60">Top 60</option>
	          <option :value="70">Top 70</option>
	          <option :value="100">Top 100</option>
	        </select>
	      </div>

      <button class="btn btn-ghost btn-xs" @click.stop="exportPng" :title="$t('exportPng')">
        <ArrowDownTrayIcon class="h-4 w-4" />
        <span class="max-sm:hidden">PNG</span>
      </button>
    </div>

    <button
      :class="
        twMerge(
          'btn btn-ghost btn-circle btn-sm absolute right-1 bottom-1',
          isFullScreen ? 'fixed right-4 bottom-4 mb-[env(safe-area-inset-bottom)]' : '',
        )
      "
      @click="isFullScreen = !isFullScreen"
    >
      <component :is="isFullScreen ? ArrowsPointingInIcon : ArrowsPointingOutIcon" class="h-4 w-4" />
    </button>

    <!-- manual resize handle (desktop) -->
    <div
      v-if="!isFullScreen"
      class="absolute left-0 right-0 bottom-0 h-3 cursor-ns-resize opacity-40 hover:opacity-80"
      @pointerdown.stop.prevent="startResize"
      @mousedown.stop.prevent
      @touchstart.stop.prevent
      :title="$t('resize')"
    >
      <div class="mx-auto mt-1 h-1 w-16 rounded-full bg-base-content/30" />
    </div>
  </div>

  <Teleport to="body">
    <div
      v-if="isFullScreen"
      class="bg-base-100 custom-background fixed inset-0 z-[9999] h-screen w-screen bg-cover bg-center"
      :class="`blur-intensity-${blurIntensity} custom-background-${dashboardTransparent}`"
      :style="backgroundImage"
    >
      <div ref="fullScreenChart" class="bg-base-100 h-full w-full" :style="fullChartStyle" />

	      <!-- fullscreen controls: same unified control + presets/filter -->
		      <div ref="fsControlsBar" class="fixed left-4 top-4 z-[10020] flex flex-wrap items-center gap-2" @click.stop>
        <div v-if="filterMode !== 'none'" class="flex items-center gap-1">
          <button
            class="badge badge-outline cursor-pointer hover:opacity-80 max-w-[min(920px,calc(100vw-12rem))] truncate"
            @click.stop="clearFilter"
            :title="activeFilterChip?.title || $t('clear')"
          >
            {{ activeFilterChip?.text || (filterMode === 'only' ? $t('topologyFilterOnly') : $t('topologyFilterExclude')) }}
          </button>

          <button
            class="btn btn-ghost btn-xs btn-square"
            @click.stop="toggleFilterLock"
            :title="filterLocked ? $t('topologyUnpinFilter') : $t('topologyPinFilter')"
          >
            <component :is="filterLocked ? LockClosedIcon : LockOpenIcon" class="h-4 w-4" />
          </button>
        </div>


	        <button class="btn btn-ghost btn-xs" @click.stop="presetDialogShow = true" :title="$t('presets')">
	          <BookmarkIcon class="h-4 w-4" />
	          <span class="max-sm:hidden">{{ $t('presets') }}</span>
	          <span
	            v-if="activePreset"
	            class="badge badge-outline badge-sm ml-1 max-w-[160px] truncate"
	            :title="activePreset.name"
	          >
	            {{ activePreset.name }}
	          </span>
	        </button>

	        <div class="join" @click.stop>
	          <button
	            class="btn btn-xs join-item"
	            :class="proxiesRelationshipWeightMode === 'traffic' ? 'btn-active' : ''"
	            @click.stop="proxiesRelationshipWeightMode = 'traffic'"
	            :title="$t('traffic')"
	          >
	            {{ $t('traffic') }}
	          </button>
	          <button
	            class="btn btn-xs join-item"
	            :class="proxiesRelationshipWeightMode === 'count' ? 'btn-active' : ''"
	            @click.stop="proxiesRelationshipWeightMode = 'count'"
	            :title="$t('count')"
	          >
	            {{ $t('count') }}
	          </button>
	          <select
	            class="select select-xs join-item"
	            v-model.number="proxiesRelationshipTopN"
	            @click.stop
	            @mousedown.stop
	            title="Top N"
	          >
	            <option :value="10">Top 10</option>
	            <option :value="20">Top 20</option>
	            <option :value="30">Top 30</option>
	            <option :value="40">Top 40</option>
	            <option :value="60">Top 60</option>
	            <option :value="70">Top 70</option>
	            <option :value="100">Top 100</option>
	          </select>
	        </div>
	      </div>
	            <button
        class="btn btn-ghost btn-circle btn-sm fixed left-4 bottom-4 z-[10020] mb-[env(safe-area-inset-bottom)]"
        @click.stop="exportPng"
        :title="$t('exportPng')"
      >
        <ArrowDownTrayIcon class="h-4 w-4" />
      </button>

<button
        class="btn btn-ghost btn-circle btn-sm fixed right-4 bottom-4 z-[10020] mb-[env(safe-area-inset-bottom)]"
        @click="isFullScreen = false"
      >
        <ArrowsPointingInIcon class="h-4 w-4" />
      </button>
    </div>
  </Teleport>

  <!-- details sidebar (node click) -->
  <Teleport to="body">
    <div
      v-if="focus"
      class="fixed inset-0 z-[10010]"
      tabindex="-1"
      @keydown.esc.stop.prevent="closeDetails"
    >
      <div class="absolute inset-0 bg-black/30" @click="closeDetails" />
      <div
        class="bg-base-100 absolute right-2 top-2 bottom-2 w-[420px] max-w-[calc(100vw-1rem)] rounded-2xl shadow-xl overflow-hidden"
        @click.stop
      >
        <div class="flex items-start justify-between gap-2 border-b border-base-content/10 p-3">
          <div class="min-w-0">
            <div class="text-sm opacity-70">{{ focusHeader.stageLabel }}</div>
            <div class="font-semibold leading-tight truncate" :title="focusHeader.title">{{ focusHeader.title }}</div>
            <div v-if="focusHeader.subTitle" class="text-xs opacity-70 truncate" :title="focusHeader.subTitle">
              {{ focusHeader.subTitle }}
            </div>
          </div>

          <button class="btn btn-ghost btn-circle btn-sm" @click="closeDetails" :title="$t('close')">
            <XMarkIcon class="h-5 w-5" />
          </button>
        </div>

        <div class="p-3 flex flex-col gap-3 overflow-y-auto h-full">
          <div class="flex flex-wrap items-center gap-2">
            <div class="join">
              <button
                class="btn btn-xs join-item"
                :class="filterMode === 'none' ? 'btn-active' : 'btn-outline'"
                :disabled="focus.kind !== 'value'"
                @click="applyOpenForFocus"
                :title="$t('topologyShowAll')"
              >
                <PresentationChartLineIcon class="h-4 w-4" />
              </button>
              <button
                class="btn btn-xs join-item"
                :class="filterMode === 'only' && isSameFocus(filterFocus, focus) ? 'btn-active' : 'btn-outline'"
                :disabled="focus.kind !== 'value'"
                @click="applyOnly"
                :title="$t('topologyOnlyThis')"
              >
                <FunnelIcon class="h-4 w-4" />
              </button>
              <button
                class="btn btn-xs join-item"
                :class="filterMode === 'exclude' && isSameFocus(filterFocus, focus) ? 'btn-active' : 'btn-outline'"
                :disabled="focus.kind !== 'value'"
                @click="applyExclude"
                :title="$t('topologyExcludeThis')"
              >
                <NoSymbolIcon class="h-4 w-4" />
              </button>
            </div>

            <button
              class="btn btn-xs"
              :class="filterLocked ? 'btn-active' : 'btn-outline'"
              :disabled="filterMode === 'none'"
              @click="toggleFilterLock"
              :title="filterLocked ? $t('topologyUnpinFilter') : $t('topologyPinFilter')"
            >
              <component :is="filterLocked ? LockClosedIcon : LockOpenIcon" class="h-4 w-4" />
            </button>
          </div>

          <!-- Navigation: open the selected entity in its section (with highlight/scroll) -->
          <div v-if="focus && focus.kind === 'value'" class="flex flex-wrap items-center gap-2">
            <button
              v-if="openMainLabel"
              class="btn btn-xs btn-outline"
              @click="openFocusedMain"
              :title="$t('open')"
            >
              <ArrowTopRightOnSquareIcon class="h-4 w-4" />
              {{ openMainLabel }}
            </button>
            <button
              v-if="openProviderLabel"
              class="btn btn-xs btn-outline"
              @click="openFocusedProvider"
              :title="$t('open')"
            >
              <ArrowTopRightOnSquareIcon class="h-4 w-4" />
              {{ openProviderLabel }}
            </button>
          </div>

          <div class="stats stats-vertical lg:stats-horizontal shadow-sm">
            <div class="stat py-2">
              <div class="stat-title">{{ $t('traffic') }}</div>
              <div class="stat-value text-lg">{{ prettyBytesHelper(detailsTotals.bytes) }}</div>
            </div>
            <div class="stat py-2">
              <div class="stat-title">{{ $t('count') }}</div>
              <div class="stat-value text-lg">{{ detailsTotals.count }}</div>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-3">
            <div class="card bg-base-200/40">
              <div class="card-body p-3">
                <div class="font-semibold">{{ $t('topologyTopUsers') }}</div>
                <div class="divider my-1" />
                <div class="space-y-1">
                  <div v-for="it in topUsers" :key="it.key" class="flex items-center gap-2">
                    <button
                      class="btn btn-ghost btn-sm flex-1 justify-between"
                      @click="applyListOpen('C', it.key)"
                      :title="it.title"
                    >
                      <span class="truncate text-left">{{ it.label }}</span>
                      <span class="ml-2 shrink-0 text-xs opacity-70">{{ it.metric }}</span>
                    </button>
                    <div class="join shrink-0">
                      <button
                        class="btn btn-ghost btn-xs join-item"
                        @click.stop="applyListOpen('C', it.key)"
                        :title="$t('topologyShowAll')"
                      >
                        <PresentationChartLineIcon class="h-4 w-4" />
                      </button>
                      <button
                        class="btn btn-ghost btn-xs join-item"
                        @click.stop="applyListFilter('only', 'C', it.key)"
                        :title="$t('topologyOnlyThis')"
                      >
                        <FunnelIcon class="h-4 w-4" />
                      </button>
                      <button
                        class="btn btn-ghost btn-xs join-item"
                        @click.stop="applyListFilter('exclude', 'C', it.key)"
                        :title="$t('topologyExcludeThis')"
                      >
                        <NoSymbolIcon class="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div v-if="!topUsers.length" class="text-sm opacity-70">—</div>
                </div>
              </div>
            </div>

            <div class="card bg-base-200/40">
              <div class="card-body p-3">
                <div class="font-semibold">{{ $t('topologyTopRules') }}</div>
                <div class="divider my-1" />
                <div class="space-y-1">
                  <div v-for="it in topRules" :key="it.key" class="flex items-center gap-2">
                    <button
                      class="btn btn-ghost btn-sm flex-1 justify-between"
                      @click="applyListOpen('R', it.key)"
                      :title="it.title"
                    >
                      <span class="truncate text-left">{{ it.label }}</span>
                      <span class="ml-2 shrink-0 text-xs opacity-70">{{ it.metric }}</span>
                    </button>
                    <div class="join shrink-0">
                      <button
                        class="btn btn-ghost btn-xs join-item"
                        @click.stop="applyListOpen('R', it.key)"
                        :title="$t('topologyShowAll')"
                      >
                        <PresentationChartLineIcon class="h-4 w-4" />
                      </button>
                      <button
                        class="btn btn-ghost btn-xs join-item"
                        @click.stop="applyListFilter('only', 'R', it.key)"
                        :title="$t('topologyOnlyThis')"
                      >
                        <FunnelIcon class="h-4 w-4" />
                      </button>
                      <button
                        class="btn btn-ghost btn-xs join-item"
                        @click.stop="applyListFilter('exclude', 'R', it.key)"
                        :title="$t('topologyExcludeThis')"
                      >
                        <NoSymbolIcon class="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div v-if="!topRules.length" class="text-sm opacity-70">—</div>
                </div>
              </div>
            </div>

            <div class="card bg-base-200/40">
              <div class="card-body p-3">
                <div class="font-semibold">{{ $t('topologyTopProviders') }}</div>
                <div class="divider my-1" />
                <div class="space-y-1">
                  <div v-for="it in topProviders" :key="it.key" class="flex items-center gap-2">
                    <button
                      class="btn btn-ghost btn-sm flex-1 justify-between"
                      @click="applyListOpen('P', it.key)"
                      :title="it.title"
                    >
                      <span class="truncate text-left">{{ it.label }}</span>
                      <span class="ml-2 shrink-0 text-xs opacity-70">{{ it.metric }}</span>
                    </button>
                    <div class="join shrink-0">
                      <button
                        class="btn btn-ghost btn-xs join-item"
                        @click.stop="applyListOpen('P', it.key)"
                        :title="$t('topologyShowAll')"
                      >
                        <PresentationChartLineIcon class="h-4 w-4" />
                      </button>
                      <button
                        class="btn btn-ghost btn-xs join-item"
                        @click.stop="applyListFilter('only', 'P', it.key)"
                        :title="$t('topologyOnlyThis')"
                      >
                        <FunnelIcon class="h-4 w-4" />
                      </button>
                      <button
                        class="btn btn-ghost btn-xs join-item"
                        @click.stop="applyListFilter('exclude', 'P', it.key)"
                        :title="$t('topologyExcludeThis')"
                      >
                        <NoSymbolIcon class="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div v-if="!topProviders.length" class="text-sm opacity-70">—</div>
                </div>
              </div>
            </div>
          </div>

          <div class="opacity-0 h-10" />
        </div>
      </div>
    </div>
  </Teleport>



  <!-- presets: save/restore topology scene (filters/modes) -->
  <DialogWrapper v-model="presetDialogShow">
    <div class="flex items-center justify-between gap-3">
      <div class="text-lg font-semibold">{{ $t('presets') }}</div>
      <div class="text-xs opacity-70 truncate max-w-[60%]" :title="currentSceneSummary">{{ currentSceneSummary }}</div>
    </div>

    <div class="mt-3 flex items-center gap-2">
      <TextInput v-model="newPresetName" class="flex-1" :placeholder="$t('presetNamePlaceholder')" />
      <button class="btn btn-sm" @click="createPreset">
        <PlusIcon class="h-4 w-4" />
        {{ $t('save') }}
      </button>
    </div>
    <div class="mt-2 text-xs opacity-70">{{ $t('presetTip') }}</div>

    <div class="divider my-4" />

    <div class="space-y-2">
      <div v-for="p in topologyPresets" :key="p.id" class="card bg-base-200/40">
        <div class="card-body p-3">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <div v-if="editingPresetId === p.id" class="flex items-center gap-2">
                <TextInput v-model="editingPresetName" class="flex-1" />
                <button class="btn btn-xs" @click="confirmRenamePreset(p)" :title="$t('save')">
                  <CheckIcon class="h-4 w-4" />
                </button>
              </div>
              <div v-else class="font-semibold truncate" :title="p.name">{{ p.name }}</div>
              <div class="text-xs opacity-70 mt-1" :title="presetSummary(p)">{{ presetSummary(p) }}</div>
            </div>

            <div class="flex flex-col items-end gap-1">
              <button
                class="btn btn-xs w-24"
                :class="activePresetId === p.id ? 'btn-active' : 'btn-outline'"
                @click="applyPreset(p)"
              >
                {{ $t('apply') }}
              </button>

              <button class="btn btn-xs btn-ghost w-24" @click="overwritePreset(p)" :title="$t('overwritePreset')">
                {{ $t('update') }}
              </button>

              <div class="flex items-center justify-end gap-1">
                <button class="btn btn-xs btn-ghost btn-square" @click="startRenamePreset(p)" :title="$t('rename')">
                  <PencilIcon class="h-4 w-4" />
                </button>
                <button class="btn btn-xs btn-ghost btn-square" @click="deletePreset(p)" :title="$t('delete')">
                  <TrashIcon class="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="!topologyPresets.length" class="text-sm opacity-70">—</div>
    </div>

    <div class="divider my-4" />

    <div class="flex items-center justify-between gap-2">
      <button class="btn btn-sm btn-ghost" @click="resetPresets" :title="$t('resetPresets')">
        <ArrowUturnLeftIcon class="h-4 w-4" />
        {{ $t('resetPresets') }}
      </button>
      <div class="text-xs opacity-60">
        {{ $t('presetMeaning') }}
      </div>
    </div>

  </DialogWrapper>

</template>

<script setup lang="ts">
import { backgroundImage } from '@/helper/indexeddb'
import { prettyBytesHelper } from '@/helper/utils'
import { showNotification } from '@/helper/notification'
import { isSourceIpScopeVisible } from '@/helper/sourceip'
import { cleanupExpiredPendingPageFocus, setPendingPageFocus } from '@/helper/navFocus'
import { ROUTE_NAME } from '@/constant'
import { activeConnections } from '@/store/connections'
import { proxyProviederList } from '@/store/proxies'
import {
  blurIntensity,
  dashboardTransparent,
  font,
  proxiesRelationshipColorMode,
  proxiesRelationshipTopN,
  proxiesRelationshipWeightMode,
  sourceIPLabelList,
  theme,
} from '@/store/settings'
import type { Connection } from '@/types'
import { ArrowDownTrayIcon, ArrowTopRightOnSquareIcon, ArrowUturnLeftIcon, ArrowsPointingInIcon, ArrowsPointingOutIcon, BookmarkIcon, CheckIcon, FunnelIcon, LockClosedIcon, LockOpenIcon, NoSymbolIcon, PencilIcon, PlusIcon, PresentationChartLineIcon, TrashIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { useElementSize, useStorage } from '@vueuse/core'
import { SankeyChart } from 'echarts/charts'
import { TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import dayjs from 'dayjs'
import { debounce } from 'lodash'
import { twMerge } from 'tailwind-merge'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import DialogWrapper from '@/components/common/DialogWrapper.vue'
import TextInput from '@/components/common/TextInput.vue'

echarts.use([SankeyChart, TooltipComponent, CanvasRenderer])

const { t } = useI18n()
const router = useRouter()

const isFullScreen = ref(false)
const chart = ref()
const fullScreenChart = ref()
const colorRef = ref()
	const controlsBar = ref<HTMLElement | null>(null)
	const fsControlsBar = ref<HTMLElement | null>(null)
	const { height: controlsBarHeight } = useElementSize(controlsBar)
	const { height: fsControlsBarHeight } = useElementSize(fsControlsBar)

const fullChartStyle = computed(() => `backdrop-filter: blur(${blurIntensity.value}px);`)

const colorSet = { baseContent30: '', baseContent: '', base70: '' }
let fontFamily = ''

const updateColorSet = () => {
  const cs = getComputedStyle(colorRef.value)
  colorSet.baseContent = cs.getPropertyValue('--color-base-content').trim()
  colorSet.baseContent30 = cs.borderColor
  colorSet.base70 = cs.backgroundColor
}

const updateFontFamily = () => {
  fontFamily = getComputedStyle(colorRef.value).fontFamily
}

const { width, height } = useElementSize(chart)

// Topology height can be manually resized.
const defaultTopologyHeight = () => {
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  return Math.round(Math.max(420, Math.min(900, vh * 0.65)))
}
const topologyHeight = useStorage<number>('config/topology-height-px', defaultTopologyHeight())
const resizing = ref(false)
let resizeStartY = 0
let resizeStartH = 0

const clampHeight = (h: number) => {
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const min = 320
  const max = Math.max(min, Math.floor(vh * 0.9))
  return Math.round(Math.max(min, Math.min(max, h)))
}

const onResizeMove = (e: PointerEvent) => {
  if (!resizing.value) return
  const dy = e.clientY - resizeStartY
  topologyHeight.value = clampHeight(resizeStartH + dy)
}

const stopResize = () => {
  resizing.value = false
  window.removeEventListener('pointermove', onResizeMove)
  window.removeEventListener('pointerup', stopResize)
}

const startResize = (e: PointerEvent) => {
  resizing.value = true
  resizeStartY = e.clientY
  resizeStartH = topologyHeight.value
  window.addEventListener('pointermove', onResizeMove)
  window.addEventListener('pointerup', stopResize)
}
const labelFontSize = computed(() => {
  const w = Number(width.value) || 0
  return isFullScreen.value ? 16 : w >= 1100 ? 15 : w >= 800 ? 14 : 13
})

const labelWidth = computed(() => {
  const w = (isFullScreen.value ? window.innerWidth : Number(width.value)) || 0
  const col = w > 0 ? w / 4 : 260
  // не даём label'ам разваливать лейаут, но и не делаем их слишком узкими
  return Math.round(Math.max(140, Math.min(440, col - (isFullScreen.value ? 88 : 72))))
})

const normalize = (s: string) => (s || '').trim() || '-'

const stageOf = (name: string) => {
  const i = name.indexOf(':')
  return i >= 0 ? name.slice(0, i) : ''
}

const labelOf = (name: string) => {
  const i = name.indexOf(':')
  return i >= 0 ? name.slice(i + 1) : name
}

const shortLabel = (name: string) => {
  const v = labelOf(name)
  if (!v) return ''
  const max = isFullScreen.value ? 56 : 40
  return v.length > max ? `${v.slice(0, max - 1)}…` : v
}

const labelForIp = (ip: string) => {
  const item = sourceIPLabelList.value.find((x) => {
    if (x.key !== ip) return false
    return isSourceIpScopeVisible(x.scope as string[] | undefined)
  })
  return item?.label || ''
}

const providerMap = computed(() => {
  const m = new Map<string, string>()
  for (const p of proxyProviederList.value) {
    for (const proxy of p.proxies || []) {
      m.set(proxy.name, p.name)
    }
  }
  return m
})

const providerOf = (name: string) => providerMap.value.get(name) || ''

const colorFromKey = (key: string) => {
  const s = key || 'unknown'
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return `hsl(${h % 360} 70% 55%)`
}

type FocusStage = 'C' | 'R' | 'G' | 'S' | 'P'
type Focus = { stage: FocusStage; kind: 'value' | 'other'; value?: string }
type FilterMode = 'none' | 'only' | 'exclude'

const focus = ref<Focus | null>(null)
const filterMode = ref<FilterMode>('none')
const filterFocus = ref<Focus | null>(null)
const filterLocked = useStorage<boolean>('config/topology-filter-locked', false)

type PendingTopologyNavFilter = {
  ts: number
  mode: FilterMode
  focus: Focus
  fallbackProxyName?: string
}

// Bridge: other pages can request a Topology filter via localStorage.
const TOPOLOGY_NAV_FILTER_KEY = 'runtime/topology-pending-filter-v1'
const pendingNavFilter = useStorage<PendingTopologyNavFilter | null>(TOPOLOGY_NAV_FILTER_KEY, null)

const readPendingNavFilter = (): PendingTopologyNavFilter | null => {
  const pf = pendingNavFilter.value
  if (pf && typeof pf === 'object') return pf as any
  try {
    const raw = localStorage.getItem(TOPOLOGY_NAV_FILTER_KEY)
    if (!raw || raw === 'null') return null
    const obj = JSON.parse(raw)
    if (obj && typeof obj === 'object') return obj as any
  } catch {
    // ignore
  }
  return null
}


type TopologyPreset = {
  id: string
  name: string
  weightMode: 'traffic' | 'count'
  topN: number
  colorMode: 'none' | 'rule' | 'provider' | 'proxy'
  filterMode: FilterMode
  filterFocus: Focus | null
}

const presetDialogShow = ref(false)
const topologyPresets = useStorage<TopologyPreset[]>('config/topology-presets', [])
const activePresetId = useStorage<string>('config/topology-preset-active', '')
const activePreset = computed(() => topologyPresets.value.find((p) => p.id === activePresetId.value) || null)

const newPresetName = ref('')
const editingPresetId = ref<string | null>(null)
const editingPresetName = ref('')

const stageLabel = (st: FocusStage) =>
  st === 'C'
    ? t('proxiesRelationshipClients')
    : st === 'R'
      ? t('rule')
      : st === 'G'
        ? t('proxyGroup')
        : st === 'P'
          ? t('proxyProvider')
          : t('proxies')

const toggleFilterLock = () => {
  filterLocked.value = !filterLocked.value
}

const shortText = (s: string, maxLen = 60) => {
  const v = (s || '').trim()
  if (v.length <= maxLen) return v
  return v.slice(0, Math.max(0, maxLen - 1)) + '…'
}

const filterValueLabel = (f: Focus) => {
  if (f.kind !== 'value') return ''
  const v = String(f.value || '').trim()
  if (!v) return ''
  if (f.stage === 'C') {
    const ip = v
    const lbl = labelForIp(ip)
    return lbl ? `${lbl} (${ip})` : ip
  }
  return v
}

const activeFilterChip = computed(() => {
  if (filterMode.value === 'none' || !filterFocus.value || filterFocus.value.kind !== 'value') return null
  const modeText = filterMode.value === 'only' ? t('topologyOnlyThis') : t('topologyExcludeThis')
  const stage = stageLabel(filterFocus.value.stage)
  const fullValue = filterValueLabel(filterFocus.value)
  const text = `${modeText} · ${stage}: ${shortText(fullValue, 64)}`
  const title = `${modeText} · ${stage}: ${fullValue}`
  return { text, title }
})

const normalizeSavedFilter = () => {
  if (filterMode.value === 'none' || !filterFocus.value || filterFocus.value.kind !== 'value') {
    return { mode: 'none' as FilterMode, focus: null as Focus | null }
  }
  return { mode: filterMode.value, focus: { ...filterFocus.value } as Focus }
}

const captureScene = () => {
  const ff = normalizeSavedFilter()
  return {
    weightMode: proxiesRelationshipWeightMode.value,
    topN: Number(proxiesRelationshipTopN.value) || 40,
    colorMode: proxiesRelationshipColorMode.value,
    filterMode: ff.mode,
    filterFocus: ff.focus,
  }
}

const currentSceneSummary = computed(() => {
  const s = captureScene()
  const parts = [
    proxiesRelationshipWeightMode.value === 'count' ? t('count') : t('traffic'),
    `Top ${s.topN}`,
  ]
  if (s.filterMode !== 'none' && s.filterFocus?.kind === 'value') {
    parts.push(`${s.filterMode === 'only' ? t('topologyFilterOnly') : t('topologyFilterExclude')} · ${stageLabel(s.filterFocus.stage)}`)
  }
  return parts.join(' · ')
})

const ensureDefaultPresets = () => {
  if (topologyPresets.value?.length) return
  topologyPresets.value = [
    {
      id: 'streaming',
      name: t('presetStreaming'),
      weightMode: 'traffic',
      topN: 60,
      colorMode: 'proxy',
      filterMode: 'none',
      filterFocus: null,
    },
    {
      id: 'work',
      name: t('presetWork'),
      weightMode: 'traffic',
      topN: 40,
      colorMode: 'proxy',
      filterMode: 'none',
      filterFocus: null,
    },
    {
      id: 'gaming',
      name: t('presetGaming'),
      weightMode: 'count',
      topN: 30,
      colorMode: 'proxy',
      filterMode: 'none',
      filterFocus: null,
    },
  ]
}
ensureDefaultPresets()

const resetPresets = () => {
  topologyPresets.value = []
  activePresetId.value = ''
  ensureDefaultPresets()
  showNotification({ content: 'presetResetDone', type: 'alert-success', timeout: 1800 })
}

const presetSummary = (p: TopologyPreset) => {
  const parts = [
    p.weightMode === 'count' ? t('count') : t('traffic'),
    `Top ${p.topN}`,
  ]
  if (p.filterMode !== 'none' && p.filterFocus?.kind === 'value') {
    const who = stageLabel(p.filterFocus.stage)
    parts.push(`${p.filterMode === 'only' ? t('topologyFilterOnly') : t('topologyFilterExclude')} · ${who}`)
  }
  return parts.join(' · ')
}

const applyPreset = (p: TopologyPreset) => {
  proxiesRelationshipWeightMode.value = p.weightMode
  proxiesRelationshipTopN.value = p.topN
  proxiesRelationshipColorMode.value = p.colorMode

  if (!filterLocked.value) {
    if (p.filterMode === 'none' || !p.filterFocus) {
      clearFilter()
    } else {
      filterMode.value = p.filterMode
      filterFocus.value = { ...p.filterFocus }
    }
  }

  activePresetId.value = p.id
  showNotification({
    content: filterLocked.value ? 'presetAppliedFiltersLocked' : 'presetApplied',
    type: 'alert-success',
    timeout: 1800,
  })
}

	const isSameSceneAsPreset = (p: TopologyPreset) => {
	  const s = captureScene()
	  if (p.weightMode !== s.weightMode) return false
	  if (Number(p.topN) !== Number(s.topN)) return false
	  if (p.colorMode !== s.colorMode) return false
	  if (p.filterMode !== s.filterMode) return false
	  const a = p.filterFocus ? JSON.stringify(p.filterFocus) : ''
	  const b = s.filterFocus ? JSON.stringify(s.filterFocus) : ''
	  return a === b
	}

	// If user changes any controls after applying a preset, stop showing it as active.
	watch(
	  () => [
	    proxiesRelationshipWeightMode.value,
	    proxiesRelationshipTopN.value,
	    proxiesRelationshipColorMode.value,
	    filterMode.value,
	    filterFocus.value ? JSON.stringify(filterFocus.value) : '',
	  ],
	  () => {
	    if (!activePresetId.value || !activePreset.value) return
	    if (!isSameSceneAsPreset(activePreset.value)) activePresetId.value = ''
	  },
	)

const genId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const createPreset = () => {
  const name = (newPresetName.value || '').trim()
  if (!name) {
    showNotification({ content: 'presetNeedName', type: 'alert-warning' })
    return
  }
  const scene = captureScene()
  const p: TopologyPreset = { id: genId(), name, ...scene }
  topologyPresets.value = [p, ...(topologyPresets.value || [])]
  activePresetId.value = p.id
  newPresetName.value = ''
  showNotification({ content: 'presetSaved', type: 'alert-success', timeout: 1800 })
}

const overwritePreset = (p: TopologyPreset) => {
  const scene = captureScene()
  topologyPresets.value = (topologyPresets.value || []).map((x) => (x.id === p.id ? { ...x, ...scene } : x))
  activePresetId.value = p.id
  showNotification({ content: 'presetUpdated', type: 'alert-success', timeout: 1800 })
}

const startRenamePreset = (p: TopologyPreset) => {
  editingPresetId.value = p.id
  editingPresetName.value = p.name
}

const confirmRenamePreset = (p: TopologyPreset) => {
  const nm = (editingPresetName.value || '').trim()
  if (!nm) return
  topologyPresets.value = (topologyPresets.value || []).map((x) => (x.id === p.id ? { ...x, name: nm } : x))
  editingPresetId.value = null
  editingPresetName.value = ''
  showNotification({ content: 'presetRenamed', type: 'alert-success', timeout: 1800 })
}

const deletePreset = (p: TopologyPreset) => {
  const ok = confirm(t('confirmDeletePreset', { name: p.name }))
  if (!ok) return
  topologyPresets.value = (topologyPresets.value || []).filter((x) => x.id !== p.id)
  if (activePresetId.value === p.id) activePresetId.value = ''
  showNotification({ content: 'presetDeleted', type: 'alert-success', timeout: 1800 })
}

const setFocus = (v: Focus) => {
  focus.value = v
}

const closeDetails = () => {
  focus.value = null
}

// --- Cross-page navigation (Topology -> Proxies/Rules/Users) ---
const openMainLabel = computed(() => {
  const f = focus.value
  if (!f || f.kind !== 'value') return ''
  if (f.stage === 'C') return t('users')
  if (f.stage === 'R') return t('rules')
  // G/S (and provider via secondary button) open Proxies.
  return t('proxies')
})

const openProviderLabel = computed(() => {
  const f = focus.value
  if (!f || f.kind !== 'value') return ''
  if (f.stage !== 'S') return ''
  const p = providerOf(String(f.value || '').trim())
  if (!p) return ''
  return `${t('proxyProvider')}: ${p}`
})

const openFocusedMain = async () => {
  const f = focus.value
  if (!f || f.kind !== 'value') return
  const v = String(f.value || '').trim()
  if (!v) return

  if (f.stage === 'C') {
    setPendingPageFocus(ROUTE_NAME.users, 'user', v)
    closeDetails()
    await router.push({ name: ROUTE_NAME.users })
    return
  }
  if (f.stage === 'R') {
    setPendingPageFocus(ROUTE_NAME.rules, 'rule', v)
    closeDetails()
    await router.push({ name: ROUTE_NAME.rules })
    return
  }
  if (f.stage === 'P') {
    setPendingPageFocus(ROUTE_NAME.proxies, 'provider', v)
    closeDetails()
    await router.push({ name: ROUTE_NAME.proxyProviders })
    return
  }
  if (f.stage === 'G') {
    setPendingPageFocus(ROUTE_NAME.proxies, 'proxyGroup', v)
    closeDetails()
    await router.push({ name: ROUTE_NAME.proxies })
    return
  }
  if (f.stage === 'S') {
    setPendingPageFocus(ROUTE_NAME.proxies, 'proxy', v)
    closeDetails()
    await router.push({ name: ROUTE_NAME.proxies })
  }
}

const openFocusedProvider = async () => {
  const f = focus.value
  if (!f || f.kind !== 'value' || f.stage !== 'S') return
  const v = String(f.value || '').trim()
  if (!v) return
  const p = providerOf(v)
  if (!p) return
  setPendingPageFocus(ROUTE_NAME.proxies, 'provider', p)
  closeDetails()
  await router.push({ name: ROUTE_NAME.proxyProviders })
}

const isSameFocus = (a: Focus | null, b: Focus | null) => {
  if (!a || !b) return false
  if (a.stage !== b.stage || a.kind !== b.kind) return false
  if (a.kind === 'other') return true
  return (a.value || '') === (b.value || '')
}

const notifyFilterPinned = () => {
  showNotification({ content: 'topologyFilterPinned', type: 'alert-info', timeout: 2200 })
}

const isFilterChangeBlocked = (mode: 'none' | 'only' | 'exclude', f: Focus | null) => {
  if (!filterLocked.value) return false
  if (filterMode.value === 'none') return false
  if (mode === filterMode.value && isSameFocus(filterFocus.value, f)) return false
  return true
}

const clearFilter = () => {
  filterMode.value = 'none'
  filterFocus.value = null
  filterLocked.value = false
}

const applyOpenForFocus = () => {
  if (isFilterChangeBlocked('none', null)) {
    notifyFilterPinned()
    return
  }
  clearFilter()
}

const applyOnly = () => {
  if (!focus.value || focus.value.kind !== 'value') return
  const target = { ...focus.value }
  if (isFilterChangeBlocked('only', target)) {
    notifyFilterPinned()
    return
  }
  filterMode.value = 'only'
  filterFocus.value = target
}

const applyExclude = () => {
  if (!focus.value || focus.value.kind !== 'value') return
  const target = { ...focus.value }
  if (isFilterChangeBlocked('exclude', target)) {
    notifyFilterPinned()
    return
  }
  filterMode.value = 'exclude'
  filterFocus.value = target
}

const applyListOpen = (stage: any, value: string) => {
  const v = String(value || '').trim()
  if (!v) return
  setFocus({ stage, kind: 'value', value: v } as any)
  if (filterMode.value === 'none') return
  if (isFilterChangeBlocked('none', null)) {
    notifyFilterPinned()
    return
  }
  clearFilter()
}

const applyListFilter = (mode: 'only' | 'exclude', stage: any, value: string) => {
  const v = String(value || '').trim()
  if (!v) return
  const target = { stage, kind: 'value', value: v } as any
  if (isFilterChangeBlocked(mode, target)) {
    notifyFilterPinned()
    return
  }
  filterMode.value = mode
  filterFocus.value = target
}

const otherLabels = computed(() => {
  const OTHER = t('other')
  return {
    C: `${OTHER}`,
    R: `${OTHER} (${t('rule')})`,
    G: `${OTHER} (${t('proxyGroup')})`,
    S: `${OTHER} (${t('proxies')})`,
  } as const
})

const ipFromClientLabel = (label: string) => {
  const s = (label || '').trim()
  const m = s.match(/\(([^()]+)\)\s*$/)
  return (m?.[1] || s).trim()
}

// ----- snapshot (обновляемся каждые 5 секунд) -----
const snapshot = ref<Connection[]>([])
const deltaBytesById = ref<Record<string, number>>({})
const prevTotalsById = new Map<string, number>()
let lastSnapshotAt = Date.now()

let timer: number | undefined

const refreshSnapshot = () => {
  const now = Date.now()
  const dt = Math.max(1, (now - lastSnapshotAt) / 1000)
  lastSnapshotAt = now

  const conns = activeConnections.value.slice()
  const deltas: Record<string, number> = {}

  for (const c of conns) {
    // Connection.id всегда присутствует в данных Mihomo
    const id = (c as any).id as string
    if (!id) continue

    const total = (Number((c as any).download) || 0) + (Number((c as any).upload) || 0)
    const prev = prevTotalsById.get(id)
    let delta = prev === undefined ? 0 : Math.max(0, total - prev)

    // если дельта 0 (например, первое обновление) — оценим по скорости за интервал
    if (delta === 0) {
      const sp = (Number((c as any).downloadSpeed) || 0) + (Number((c as any).uploadSpeed) || 0)
      if (sp > 0) delta = sp * dt
    }

    deltas[id] = delta
    prevTotalsById.set(id, total)
  }

  // чистим старые id
  for (const id of Array.from(prevTotalsById.keys())) {
    if (!(id in deltas)) prevTotalsById.delete(id)
  }

  deltaBytesById.value = deltas
  snapshot.value = conns
}

const stopTimer = () => {
  if (timer) {
    clearInterval(timer)
    timer = undefined
  }
}

const startTimer = () => {
  stopTimer()
  timer = window.setInterval(refreshSnapshot, 5000)
}

const bytesOf = (c: Connection) => {
  const id = (c as any).id || ''
  if (id && deltaBytesById.value[id] !== undefined) return Number(deltaBytesById.value[id]) || 0
  return (Number((c as any).downloadSpeed) || 0) + (Number((c as any).uploadSpeed) || 0)
}

const fmtRule = (c: Connection) => {
  const rt = normalize((c as any).rule)
  const rp = String((c as any).rulePayload || '').trim()
  return rp ? `${rt}: ${normalize(rp)}` : rt
}

const getGroupServer = (c: Connection) => {
  const arr = (c.chains || []).map(normalize).filter((x) => x && x !== '-')
  const group = arr[0] || 'DIRECT'
  const server = arr[arr.length - 1] || group
  return { group, server }
}

type LinkAgg = { value: number; bytes: number; count: number; colorVotes: Record<string, number> }

type NodeMeta = { bytes: number; count: number; provider?: string }

type SankeyModel = {
  nodes: any[]
  links: any[]
  nodeMeta: Map<string, NodeMeta>
  topClients: Set<string>
  topRules: Set<string>
  topGroups: Set<string>
  topServers: Set<string>
  OTHER_CLIENT: string
  OTHER_RULE: string
  OTHER_GROUP: string
  OTHER_SERVER: string
}

const filteredSnapshot = computed(() => {
  const conns = snapshot.value || []
  if (filterMode.value === 'none' || !filterFocus.value) return conns
  const f = filterFocus.value
  if (f.kind !== 'value' || !f.value) return conns

  const match = (c: Connection) => {
    const ip = c.metadata?.sourceIP || ''
    const rule = fmtRule(c)
    const { group, server } = getGroupServer(c)
    if (f.stage === 'C') return ip === f.value
    if (f.stage === 'R') return rule === f.value
    if (f.stage === 'G') return group === f.value
    if (f.stage === 'P') {
      const p = providerOf(server) || providerOf(group) || ''
      return p === f.value
    }
    return server === f.value
  }

  const keep = filterMode.value === 'only'
  return conns.filter((c) => (keep ? match(c) : !match(c)))
})

const sankeyData = computed(() => {
  const conns = filteredSnapshot.value || []

  const topClientsN = Math.max(10, Number(proxiesRelationshipTopN.value) || 40)
  const topRulesN = Math.max(10, Math.floor(topClientsN * 1.5))
  const topGroupsN = Math.max(10, Math.floor(topClientsN * 1.2))
  const topServersN = topGroupsN

  const metricForTop = (c: Connection) => {
    if (proxiesRelationshipWeightMode.value === 'count') return 1
    return bytesOf(c)
  }

  const weight = (c: Connection) => {
    if (proxiesRelationshipWeightMode.value === 'count') return 1
    const b = bytesOf(c)
    if (b <= 0) return 0
    // log compression to avoid "giant bars"
    return Math.min(1 + Math.log1p(b) / 6, 18)
  }

  const colorKeyOf = (rawRule: string, group: string, server: string, c: Connection) => {
    const cm = proxiesRelationshipColorMode.value
    if (cm === 'none') return ''
    if (cm === 'rule') return normalize((c as any).rule) || rawRule
    if (cm === 'provider') return providerOf(server) || providerOf(group) || group || server
    // default: by real final hop (proxy) / group
    return server || group || rawRule
  }


  const totalsClients = new Map<string, number>()
  const totalsRules = new Map<string, number>()
  const totalsGroups = new Map<string, number>()
  const totalsServers = new Map<string, number>()

  for (const c of conns) {
    const ip = c.metadata?.sourceIP || ''
    if (!ip) continue
    const m = metricForTop(c)
    if (m <= 0) continue

    totalsClients.set(ip, (totalsClients.get(ip) || 0) + m)

    const r = fmtRule(c)
    totalsRules.set(r, (totalsRules.get(r) || 0) + m)

    const { group, server } = getGroupServer(c)
    totalsGroups.set(group, (totalsGroups.get(group) || 0) + m)
    totalsServers.set(server, (totalsServers.get(server) || 0) + m)
  }

  const topClients = new Set(
    Array.from(totalsClients.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topClientsN)
      .map(([k]) => k),
  )

  const topRules = new Set(
    Array.from(totalsRules.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topRulesN)
      .map(([k]) => k),
  )

  const topGroups = new Set(
    Array.from(totalsGroups.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topGroupsN)
      .map(([k]) => k),
  )

  const topServers = new Set(
    Array.from(totalsServers.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topServersN)
      .map(([k]) => k),
  )

  const OTHER_CLIENT = otherLabels.value.C
  const OTHER_RULE = otherLabels.value.R
  const OTHER_GROUP = otherLabels.value.G
  const OTHER_SERVER = otherLabels.value.S

  const node = (stage: 'C' | 'R' | 'G' | 'S', label: string) => `${stage}:${label}`

  const linkAgg = new Map<string, LinkAgg>()
  const nodeMeta = new Map<string, NodeMeta>()

  const addNodeMeta = (name: string, b: number, cnt: number) => {
    const cur = nodeMeta.get(name) || { bytes: 0, count: 0 }
    cur.bytes += b
    cur.count += cnt

    if (!cur.provider && stageOf(name) === 'S') {
      const p = providerOf(labelOf(name))
      if (p) cur.provider = p
    }

    nodeMeta.set(name, cur)
  }

  const voteColor = (agg: LinkAgg, key: string, v: number) => {
    if (!key) return
    agg.colorVotes[key] = (agg.colorVotes[key] || 0) + v
  }

  const add = (s: string, tname: string, c: Connection, colorKey: string) => {
    const b = bytesOf(c)
    const v = weight(c)
    if (v <= 0 && b <= 0) return
    const key = `${s}\u0000${tname}`
    const agg = linkAgg.get(key) || { value: 0, bytes: 0, count: 0, colorVotes: {} }

    agg.value += v
    agg.bytes += b
    agg.count += 1

    // Окраска потоков — единая по всему пути, по выбранному ключу (по умолчанию: реальный финальный хоп).
    voteColor(agg, colorKey, v)

    linkAgg.set(key, agg)
    addNodeMeta(s, b, 1)
    addNodeMeta(tname, b, 1)
  }

  for (const c of conns) {
    const ip0 = c.metadata?.sourceIP || ''
    if (!ip0) continue

    const lbl = labelForIp(ip0)
    const clientLabel = topClients.has(ip0) ? (lbl ? `${lbl} (${ip0})` : ip0) : OTHER_CLIENT

    const rawRule = fmtRule(c)
    const ruleLabel = topRules.has(rawRule) ? rawRule : OTHER_RULE

    const { group: rawGroup, server: rawServer } = getGroupServer(c)
    const groupLabel = topGroups.has(rawGroup) ? rawGroup : OTHER_GROUP
    const serverLabel = topServers.has(rawServer) ? rawServer : OTHER_SERVER

    const colorKey = colorKeyOf(rawRule, rawGroup, rawServer, c)

    const C = node('C', clientLabel)
    const R = node('R', ruleLabel)
    const G = node('G', groupLabel)
    const S = node('S', serverLabel)

    add(C, R, c, colorKey)
    add(R, G, c, colorKey)
    add(G, S, c, colorKey)
  }

  const nodesSet = new Set<string>()
  const links = Array.from(linkAgg.entries()).map(([k, a]) => {
    const [source, target] = k.split('\u0000')
    nodesSet.add(source)
    nodesSet.add(target)

    let color = colorSet.baseContent30
    if (proxiesRelationshipColorMode.value !== 'none') {
      const entries = Object.entries(a.colorVotes)
      if (entries.length) {
        entries.sort((x, y) => y[1] - x[1])
        color = colorFromKey(entries[0][0])
      }
    }

    return {
      source,
      target,
      value: a.value,
      bytes: a.bytes,
      count: a.count,
      lineStyle: { color, opacity: 0.55 },
    }
  })

  const stageOrder: Record<string, number> = { C: 0, R: 1, G: 2, S: 3 }
  const nodes = Array.from(nodesSet)
    .sort((a, b) => {
      const sa = stageOrder[stageOf(a)] ?? 9
      const sb = stageOrder[stageOf(b)] ?? 9
      if (sa !== sb) return sa - sb
      return labelOf(a).localeCompare(labelOf(b))
    })
    .map((name) => {
      const st = stageOf(name)
      const isRight = st === 'S'
      return {
        name,
        label: {
          position: isRight ? 'left' : 'right',
          align: isRight ? 'right' : 'left',
          distance: isRight ? 6 : 8,
        },
      }
    })

  return {
    nodes,
    links,
    nodeMeta,
    topClients,
    topRules,
    topGroups,
    topServers,
    OTHER_CLIENT,
    OTHER_RULE,
    OTHER_GROUP,
    OTHER_SERVER,
  } satisfies SankeyModel
})

const matchesFocus = (c: Connection, f: Focus, model: SankeyModel) => {
  const ip = c.metadata?.sourceIP || ''
  const rule = fmtRule(c)
  const { group, server } = getGroupServer(c)

  if (f.stage === 'C') return f.kind === 'other' ? !model.topClients.has(ip) : ip === (f.value || '')
  if (f.stage === 'R') return f.kind === 'other' ? !model.topRules.has(rule) : rule === (f.value || '')
  if (f.stage === 'G') return f.kind === 'other' ? !model.topGroups.has(group) : group === (f.value || '')
  return f.kind === 'other' ? !model.topServers.has(server) : server === (f.value || '')
}

const detailsConns = computed(() => {
  if (!focus.value) return []
  const model = sankeyData.value
  return (filteredSnapshot.value || []).filter((c) => matchesFocus(c, focus.value!, model))
})

const detailsTotals = computed(() => {
  let b = 0
  let cnt = 0
  for (const c of detailsConns.value) {
    b += bytesOf(c)
    cnt += 1
  }
  return { bytes: b, count: cnt }
})

type ListItem = { key: string; label: string; title: string; bytes: number; count: number; metric: string }

const listMetric = (it: { bytes: number; count: number }) => {
  return proxiesRelationshipWeightMode.value === 'count' ? `${it.count}` : prettyBytesHelper(it.bytes)
}

const buildTopList = (m: Map<string, { bytes: number; count: number }>, makeLabel: (k: string) => string) => {
  const arr: ListItem[] = Array.from(m.entries()).map(([key, v]) => {
    const label = makeLabel(key)
    return { key, label, title: label, bytes: v.bytes, count: v.count, metric: listMetric(v) }
  })
  const sortByCount = proxiesRelationshipWeightMode.value === 'count'
  arr.sort((a, b) => (sortByCount ? b.count - a.count : b.bytes - a.bytes))
  return arr.slice(0, 10)
}

const topUsers = computed(() => {
  const m = new Map<string, { bytes: number; count: number }>()
  for (const c of detailsConns.value) {
    const ip = c.metadata?.sourceIP || ''
    if (!ip) continue
    const cur = m.get(ip) || { bytes: 0, count: 0 }
    cur.bytes += bytesOf(c)
    cur.count += 1
    m.set(ip, cur)
  }
  return buildTopList(m, (ip) => {
    const lbl = labelForIp(ip)
    return lbl ? `${lbl} (${ip})` : ip
  })
})

const topRules = computed(() => {
  const m = new Map<string, { bytes: number; count: number }>()
  for (const c of detailsConns.value) {
    const rule = fmtRule(c)
    const cur = m.get(rule) || { bytes: 0, count: 0 }
    cur.bytes += bytesOf(c)
    cur.count += 1
    m.set(rule, cur)
  }
  return buildTopList(m, (k) => k)
})

const topProviders = computed(() => {
  const m = new Map<string, { bytes: number; count: number }>()
  for (const c of detailsConns.value) {
    const { group, server } = getGroupServer(c)
    const p = providerOf(server) || providerOf(group) || t('none')
    const cur = m.get(p) || { bytes: 0, count: 0 }
    cur.bytes += bytesOf(c)
    cur.count += 1
    m.set(p, cur)
  }
  return buildTopList(m, (k) => k)
})

const focusHeader = computed(() => {
  const f = focus.value
  if (!f) return { stageLabel: '', title: '', subTitle: '' }

  const stageLabel =
    f.stage === 'C'
      ? t('proxiesRelationshipClients')
      : f.stage === 'R'
        ? t('rule')
        : f.stage === 'G'
          ? t('proxyGroup')
          : t('proxies')

  if (f.kind === 'other') {
    const m = sankeyData.value
    const title = f.stage === 'C' ? m.OTHER_CLIENT : f.stage === 'R' ? m.OTHER_RULE : f.stage === 'G' ? m.OTHER_GROUP : m.OTHER_SERVER
    return { stageLabel, title, subTitle: '' }
  }

  const v = (f.value || '').trim()
  if (f.stage === 'C') {
    const lbl = labelForIp(v)
    return { stageLabel, title: lbl ? `${lbl} (${v})` : v, subTitle: '' }
  }
  if (f.stage === 'S') {
    const p = providerOf(v)
    return { stageLabel, title: v, subTitle: p ? `${t('provider')}: ${p}` : '' }
  }
  return { stageLabel, title: v, subTitle: '' }
})

const tooltipFormatter = (p: any) => {
  if (p?.dataType === 'edge') {
    const d = p.data || {}
    const cnt = Number(d.count) || 0
    const b = Number(d.bytes) || 0

    return `
      <div style="max-width: 560px">
        <div style="font-weight:600">${shortLabel(d.source)} → ${shortLabel(d.target)}</div>
        <div>${t('count')}: <b>${cnt}</b></div>
        <div>${t('traffic')}: <b>${prettyBytesHelper(b)}</b></div>
      </div>
    `
  }

  const name = p?.name || ''
  const meta = sankeyData.value.nodeMeta.get(name)
  const provider = meta?.provider ? ` (${t('provider')}: ${meta.provider})` : ''
  const cnt = meta?.count || 0
  const b = meta?.bytes || 0

  return `
    <div style="max-width: 560px">
      <div style="font-weight:600">${shortLabel(name)}${provider}</div>
      <div>${t('count')}: <b>${cnt}</b></div>
      <div>${t('traffic')}: <b>${prettyBytesHelper(b)}</b></div>
    </div>
  `
}

const options = computed(() => {
  // The chart has an overlay toolbar (filters/presets/topN). Reserve vertical space so it doesn't cover
  // the column headers and the first nodes.
  const overlayTop = 16 // left-4/top-4
  const overlayH = Math.round((isFullScreen.value ? fsControlsBarHeight.value : controlsBarHeight.value) || 36)
  const columnHeaderTop = overlayTop + overlayH + 6
  const seriesTop = columnHeaderTop + 22

  return {
  animation: true,
  animationDuration: 250,
  animationDurationUpdate: 550,
  animationEasingUpdate: 'cubicOut',
  tooltip: {
    trigger: 'item',
    triggerOn: 'mousemove',
    formatter: tooltipFormatter,
    backgroundColor: colorSet.base70,
    borderColor: colorSet.base70,
    confine: true,
    padding: [6, 8],
    textStyle: { color: colorSet.baseContent, fontFamily, fontSize: Math.max(12, labelFontSize.value) },
  },
  graphic: (() => {
    // небольшие заголовки колонок, чтобы диаграмма читалась "клиент → правило → группа → сервер"
    const w = (isFullScreen.value ? window.innerWidth : Number(width.value)) || 0
    if (!w) return []
    const top = columnHeaderTop
    const leftPad = 18
    const rightPad = 22
    const col = Math.max(1, (w - leftPad - rightPad) / 4)
    const fontSize = Math.max(12, Math.min(14, labelFontSize.value))
    const mk = (i: number, text: string) => ({
      type: 'text',
      left: Math.round(leftPad + col * i),
      top,
      style: {
        text,
        fill: colorSet.baseContent,
        font: `600 ${fontSize}px ${fontFamily}`,
        opacity: 0.65,
      },
      silent: true,
    })
    return [
      mk(0, t('proxiesRelationshipClients')),
      mk(1, t('rule')),
      mk(2, t('proxyGroup')),
      mk(3, t('proxies')),
    ]
  })(),
  series: [
    {
      id: 'sankey-client-rule-group-server',
      type: 'sankey',
      left: 18,
      right: 22,
      top: seriesTop,
      bottom: 8,
      data: sankeyData.value.nodes,
      links: sankeyData.value.links,
      nodeAlign: 'justify',
      nodeWidth: isFullScreen.value ? 10 : 8,
      nodeGap: isFullScreen.value ? 11 : 9,
      emphasis: { focus: 'adjacency' },
      lineStyle: { curveness: 0.5, opacity: 0.55 },
      label: {
        color: colorSet.baseContent,
        fontFamily,
        fontSize: labelFontSize.value,
        position: 'right',
        align: 'left',
        distance: 6,
        ellipsis: '…',
        overflow: 'truncate',
        width: labelWidth.value,
        rich: {
          n: { fontWeight: 600, fontSize: labelFontSize.value, lineHeight: Math.round(labelFontSize.value * 1.2) },
          v: { fontSize: Math.max(11, labelFontSize.value - 3), opacity: 0.65, lineHeight: Math.round((labelFontSize.value - 2) * 1.15) },
        },
        formatter: (pp: any) => {
          const name = pp?.name || ''
          const st = stageOf(name)
          const base = shortLabel(name)
          if (st === 'R') {
            const meta = sankeyData.value.nodeMeta.get(name)
            const b = meta?.bytes || 0
            if (b > 0) return `{n|${base}}
{v|${prettyBytesHelper(b)}}`
          }
          return base
        },
      },
    },
  ],
  }
})

let mainChart: echarts.ECharts | null = null
let fsChart: echarts.ECharts | null = null

const handleNodeClick = (params: any) => {
  if (!params || params.dataType !== 'node') return
  const name = String(params.name || '')
  const st = stageOf(name) as FocusStage
  const lbl = labelOf(name)

  const isOther =
    (st === 'C' && lbl === otherLabels.value.C) ||
    (st === 'R' && lbl === otherLabels.value.R) ||
    (st === 'G' && lbl === otherLabels.value.G) ||
    (st === 'S' && lbl === otherLabels.value.S)

  if (isOther) {
    setFocus({ stage: st, kind: 'other' })
    return
  }

  if (st === 'C') {
    setFocus({ stage: 'C', kind: 'value', value: ipFromClientLabel(lbl) })
    return
  }

  setFocus({ stage: st, kind: 'value', value: lbl })
}

const render = (force = false) => {
  if (!mainChart) return
  mainChart.setOption(options.value as any, { notMerge: force, lazyUpdate: true })
  if (isFullScreen.value && fsChart) fsChart.setOption(options.value as any, { notMerge: force, lazyUpdate: true })
}


const exportPng = () => {
  const ch = isFullScreen.value ? fsChart : mainChart
  if (!ch) return
  try {
    const url = ch.getDataURL({ type: 'png', pixelRatio: 2 })
    const a = document.createElement('a')
    a.href = url
    a.download = `topology-${dayjs().format('YYYYMMDD-HHmmss')}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
    showNotification({ content: 'exportPngDone', type: 'alert-success', timeout: 1800 })
  } catch (e: any) {
    showNotification({
      content: 'exportPngFailed',
      type: 'alert-error',
      timeout: 6000,
      params: { error: String(e?.message || e) },
    })
  }
}

const applyPendingNavFilter = () => {
  const pf = readPendingNavFilter()
  if (!pf) return

  // clear first to avoid re-applying on navigation back/forward
  pendingNavFilter.value = null
  try { localStorage.removeItem(TOPOLOGY_NAV_FILTER_KEY) } catch {}

  const ts = Number((pf as any).ts) || 0
  if (!ts || Date.now() - ts > 10 * 60 * 1000) return

  const requestedMode = (((pf as any).mode as FilterMode) || 'none') as FilterMode
  const requestedFocus = (pf as any).focus as Focus

  const fallbackProxyName = String((pf as any).fallbackProxyName || '').trim()
  const providerMapReady = Boolean(providerMap.value?.size && proxyProviederList.value?.length)

  // Provider filter needs provider map; if it's not ready yet, fall back to a concrete proxy name.
  const effectiveFocus: Focus | null =
    requestedFocus?.stage === 'P' && !providerMapReady && fallbackProxyName
      ? ({ stage: 'S', kind: 'value', value: fallbackProxyName } as any)
      : requestedFocus

  // Always apply focus/highlight (even when filter lock is enabled).
  if (effectiveFocus?.kind === 'value' && String((effectiveFocus as any).value || '').trim()) {
    setFocus({ ...(effectiveFocus as any) })
  }

  if (filterLocked.value) {
    if (requestedMode !== 'none') {
      showNotification({ content: 'topologyNavFilterLocked', type: 'alert-info', timeout: 2400 })
    }
    return
  }

  // mode:none means "open Topology" only (no filter change).
  if (requestedMode === 'none') return

  filterMode.value = requestedMode
  filterFocus.value = effectiveFocus ? ({ ...effectiveFocus } as any) : null

  showNotification({ content: 'topologyNavFilterApplied', type: 'alert-success', timeout: 1800 })
}

watch(
  pendingNavFilter,
  (v) => {
    if (v) applyPendingNavFilter()
  },
  { deep: true },
)

onMounted(() => {
  cleanupExpiredPendingPageFocus()
  updateColorSet()
  updateFontFamily()

  refreshSnapshot()
  startTimer()

  applyPendingNavFilter()

  watch(theme, updateColorSet)
  watch(font, updateFontFamily)

  mainChart = echarts.init(chart.value)
  mainChart.setOption(options.value as any)
  mainChart.on('click', handleNodeClick)

  watch(options, () => render(false))

  watch(isFullScreen, async (v) => {
    if (v) {
      await nextTick()
      if (!fsChart) {
        fsChart = echarts.init(fullScreenChart.value)
        fsChart.on('click', handleNodeClick)
      }
      fsChart.resize()
      render(true)
    } else {
      fsChart?.dispose()
      fsChart = null
    }
  })

  const resize = debounce(() => {
    mainChart?.resize()
    fsChart?.resize()
  }, 100)
  watch([width, height], resize)
})

onBeforeUnmount(() => {
  stopResize()
  stopTimer()
  mainChart?.dispose()
  fsChart?.dispose()
  mainChart = null
  fsChart = null
})
</script>