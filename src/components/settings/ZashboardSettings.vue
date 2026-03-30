<template>
  <!-- dashboard -->
  <div class="card">
    <div class="card-title px-4 pt-4">
      <div class="indicator">
        <span
          v-if="isUIUpdateAvailable"
          class="indicator-item top-1 -right-1 flex"
        >
          <span class="bg-secondary absolute h-2 w-2 animate-ping rounded-full"></span>
          <span class="bg-secondary h-2 w-2 rounded-full"></span>
        </span>
        <a
          href="https://github.com/NightShadowDevOPs/UIUbuntuXkeen"
          target="_blank"
        >
          <span> UIUbuntuXkeen </span>
          <span class="text-sm font-normal">
            {{ zashboardVersion }}
          </span>
        </a>
      </div>
      <button
        class="btn btn-sm absolute top-2 right-2"
        @click="hardRefreshUiCache"
      >
        {{ $t('uiHardRefresh') }}
        <ArrowPathIcon class="h-4 w-4" />
      </button>
    </div>
    <div class="card-body gap-4">
      <div class="rounded-2xl border border-base-300/70 bg-base-200/40 p-3">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="space-y-1">
            <div class="text-sm font-semibold">{{ $t('uiCacheStatusTitle') }}</div>
            <div class="text-xs opacity-70">{{ $t('uiCacheStatusTip') }}</div>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="badge badge-primary badge-outline">UI v{{ zashboardVersion }}</span>
            <span class="badge badge-secondary badge-outline">build {{ uiBuildId }}</span>
            <span
              class="badge"
              :class="[
                isFreshUiBuildAvailable
                  ? 'badge-warning'
                  : uiBuildCheckError
                    ? 'badge-error'
                    : onlineBundleTag !== '—'
                      ? 'badge-success'
                      : 'badge-ghost',
              ]"
            >
              {{ $t(uiBuildStatusKey) }}
            </span>
          </div>
        </div>

        <div class="mt-3 grid grid-cols-1 gap-2 text-xs md:grid-cols-2">
          <div class="rounded-xl bg-base-100/60 px-3 py-2">
            <div class="opacity-60">{{ $t('uiLoadedBundle') }}</div>
            <div class="mt-1 break-all font-mono text-[11px] text-base-content/90">{{ currentBundleTag }}</div>
          </div>
          <div class="rounded-xl bg-base-100/60 px-3 py-2">
            <div class="opacity-60">{{ $t('uiOnlineBundle') }}</div>
            <div class="mt-1 break-all font-mono text-[11px] text-base-content/90">{{ onlineBundleTag }}</div>
          </div>
        </div>

        <div class="mt-3 flex flex-wrap items-center gap-2 text-xs opacity-70">
          <span v-if="lastCheckedLabel">{{ $t('uiLastChecked') }}: {{ lastCheckedLabel }}</span>
          <span v-if="uiBuildCheckError">{{ uiBuildCheckError }}</span>
        </div>

        <div class="mt-3 flex flex-wrap gap-2">
          <button
            class="btn btn-sm"
            :class="isUiBuildChecking ? 'animate-pulse' : ''"
            @click="checkFreshUiBuild"
          >
            {{ $t('uiCheckFreshness') }}
          </button>
          <button
            class="btn btn-sm btn-outline"
            @click="hardRefreshUiCache"
          >
            {{ $t('uiHardRefresh') }}
          </button>
          <span class="self-center text-xs opacity-60">
            {{ isPWA ? $t('uiPwaModeDetected') : $t('uiBrowserModeDetected') }}
          </span>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-2 lg:grid-cols-2">
        <LanguageSelect />
        <div class="flex items-center gap-2">
          {{ $t('autoSwitchTheme') }}
          <input
            v-model="autoTheme"
            type="checkbox"
            class="toggle"
          />
        </div>
        <div class="flex items-center gap-2">
          {{ $t('defaultTheme') }}
          <div class="join">
            <ThemeSelector v-model:value="defaultTheme" />
            <button
              class="btn btn-sm join-item"
              @click="customThemeModal = !customThemeModal"
            >
              <PlusIcon class="h-4 w-4" />
            </button>
          </div>
          <CustomTheme v-model:value="customThemeModal" />
        </div>
        <div
          v-if="autoTheme"
          class="flex items-center gap-2"
        >
          {{ $t('darkTheme') }}
          <ThemeSelector v-model:value="darkTheme" />
        </div>
        <div class="flex items-center gap-2">
          {{ $t('fonts') }}
          <select
            v-model="font"
            class="select select-sm w-48"
          >
            <option
              v-for="opt in fontOptions"
              :key="opt"
              :value="opt"
            >
              {{ opt }}
            </option>
          </select>
        </div>
        <div class="flex items-center gap-2">
          Emoji
          <select
            v-model="emoji"
            class="select select-sm w-48"
          >
            <option
              v-for="opt in Object.values(EMOJIS)"
              :key="opt"
              :value="opt"
            >
              {{ opt }}
            </option>
          </select>
        </div>
        <div class="flex items-center gap-2">
          <span class="shrink-0"> {{ $t('customBackgroundURL') }} </span>
          <div class="join">
            <TextInput
              v-model="customBackgroundURL"
              class="join-item w-48"
              :clearable="true"
              @update:modelValue="handlerBackgroundURLChange"
            />
            <button
              class="btn join-item btn-sm"
              @click="handlerClickUpload"
            >
              <ArrowUpTrayIcon class="h-4 w-4" />
            </button>
          </div>
          <button
            v-if="customBackgroundURL"
            class="btn btn-circle join-item btn-sm"
            @click="displayBgProperty = !displayBgProperty"
          >
            <AdjustmentsHorizontalIcon class="h-4 w-4" />
          </button>
          <input
            ref="inputFileRef"
            type="file"
            accept="image/*"
            class="hidden"
            @change="handlerFileChange"
          />
        </div>
        <template v-if="customBackgroundURL && displayBgProperty">
          <div class="flex items-center gap-2">
            {{ $t('transparent') }}
            <input
              v-model="dashboardTransparent"
              type="range"
              min="0"
              max="100"
              class="range max-w-64"
              @touchstart.passive.stop
              @touchmove.passive.stop
              @touchend.passive.stop
            />
          </div>

          <div class="flex items-center gap-2">
            {{ $t('blurIntensity') }}
            <input
              v-model="blurIntensity"
              type="range"
              min="0"
              max="40"
              class="range max-w-64"
              @touchstart.stop
              @touchmove.stop
              @touchend.stop
            />
          </div>
        </template>
        <div class="flex items-center gap-2">
          {{ $t('autoUpgrade') }}
          <input
            v-model="autoUpgrade"
            class="toggle"
            type="checkbox"
          />
        </div>
      </div>
      <div class="grid max-w-4xl grid-cols-2 gap-2 sm:grid-cols-4">
        <button
          :class="twMerge('btn btn-primary btn-sm', isUIUpgrading ? 'animate-pulse' : '')"
          @click="handlerClickUpgradeUI"
        >
          {{ $t('upgradeUI') }}
        </button>
        <button
          class="btn btn-sm"
          :class="isUiBuildChecking ? 'animate-pulse' : ''"
          @click="checkFreshUiBuild"
        >
          {{ $t('uiCheckFreshness') }}
        </button>

        <button
          class="btn btn-sm"
          @click="exportSettings"
        >
          {{ $t('exportSettings') }}
        </button>
        <ImportSettings />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { upgradeUIAPI, zashboardVersion } from '@/api'
import LanguageSelect from '@/components/settings/LanguageSelect.vue'
import { useSettings } from '@/composables/settings'
import { useUiBuild } from '@/composables/uiBuild'
import { EMOJIS, FONTS } from '@/constant'
import { handlerUpgradeSuccess } from '@/helper'
import { deleteBase64FromIndexedDB, LOCAL_IMAGE, saveBase64ToIndexedDB } from '@/helper/indexeddb'
import { exportSettings, isPWA } from '@/helper/utils'
import {
  autoTheme,
  autoUpgrade,
  blurIntensity,
  customBackgroundURL,
  darkTheme,
  dashboardTransparent,
  defaultTheme,
  emoji,
  font,
} from '@/store/settings'
import {
  AdjustmentsHorizontalIcon,
  ArrowPathIcon,
  ArrowUpTrayIcon,
  PlusIcon,
} from '@heroicons/vue/24/outline'
import dayjs from 'dayjs'
import { twMerge } from 'tailwind-merge'
import { computed, ref, watch } from 'vue'
import ImportSettings from '../common/ImportSettings.vue'
import TextInput from '../common/TextInput.vue'
import CustomTheme from './CustomTheme.vue'
import ThemeSelector from './ThemeSelector.vue'

const customThemeModal = ref(false)
const displayBgProperty = ref(false)

watch(customBackgroundURL, (value) => {
  if (value) {
    displayBgProperty.value = true
  }
})

const inputFileRef = ref()
const handlerClickUpload = () => {
  inputFileRef.value?.click()
}
const handlerBackgroundURLChange = () => {
  if (!customBackgroundURL.value.includes(LOCAL_IMAGE)) {
    deleteBase64FromIndexedDB()
  }
}

const handlerFileChange = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    customBackgroundURL.value = LOCAL_IMAGE + '-' + Date.now()
    saveBase64ToIndexedDB(reader.result as string)
  }
  reader.readAsDataURL(file)
}

const fontOptions = computed(() => {
  const mode = import.meta.env.MODE

  if (Object.values(FONTS).includes(mode as FONTS)) {
    return [mode]
  }

  return Object.values(FONTS)
})

const { isUIUpdateAvailable } = useSettings()
const {
  uiBuildId,
  currentBundleTag,
  onlineBundleTag,
  isUiBuildChecking,
  isFreshUiBuildAvailable,
  uiBuildStatusKey,
  uiBuildCheckError,
  lastUiBuildCheckedAt,
  checkFreshUiBuild,
  hardRefreshUiCache,
} = useUiBuild()

const lastCheckedLabel = computed(() => {
  if (!lastUiBuildCheckedAt.value) return ''
  return dayjs(lastUiBuildCheckedAt.value).format('DD-MM-YYYY HH:mm:ss')
})

const isUIUpgrading = ref(false)
const handlerClickUpgradeUI = async () => {
  if (isUIUpgrading.value) return
  isUIUpgrading.value = true
  try {
    await upgradeUIAPI()
    isUIUpgrading.value = false
    handlerUpgradeSuccess()
    setTimeout(() => {
      void hardRefreshUiCache()
    }, 1000)
  } catch {
    isUIUpgrading.value = false
  }
}
</script>
