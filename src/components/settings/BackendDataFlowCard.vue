<template>
  <div class="rounded-2xl border border-base-300/70 bg-base-100/70 px-3 py-3 text-xs leading-5">
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div>
        <div class="font-semibold">{{ $t('backendDataFlowTitle') }}</div>
        <div class="opacity-75">{{ summaryText }}</div>
      </div>
      <span :class="getBackendKindBadgeClass(kind)">
        {{ kind === BACKEND_KINDS.UBUNTU_SERVICE ? $t('backendModeShortUbuntu') : $t('backendModeShortDirect') }}
      </span>
    </div>

    <div class="mt-3 grid gap-2 xl:grid-cols-2">
      <div class="rounded-xl border border-base-300/60 bg-base-200/40 p-3">
        <div class="mb-2 font-semibold">{{ $t('backendDataFlowDirectTitle') }}</div>
        <div class="mb-2 text-[11px] opacity-70">{{ directHint }}</div>
        <ul class="space-y-1.5">
          <li v-for="item in directItems" :key="item.key" class="flex items-start gap-2">
            <span class="mt-[2px] h-1.5 w-1.5 rounded-full bg-primary/70"></span>
            <div>
              <div class="font-medium">{{ item.title }}</div>
              <div class="opacity-75">{{ item.text }}</div>
            </div>
          </li>
        </ul>
      </div>

      <div class="rounded-xl border border-base-300/60 bg-base-200/40 p-3">
        <div class="mb-2 font-semibold">{{ $t('backendDataFlowServiceTitle') }}</div>
        <div class="mb-2 text-[11px] opacity-70">{{ serviceHint }}</div>
        <ul class="space-y-1.5">
          <li v-for="item in serviceItems" :key="item.key" class="flex items-start gap-2">
            <span class="mt-[2px] h-1.5 w-1.5 rounded-full" :class="item.active ? 'bg-success/70' : 'bg-warning/70'"></span>
            <div>
              <div class="font-medium">{{ item.title }}</div>
              <div class="opacity-75">{{ item.text }}</div>
            </div>
          </li>
        </ul>
      </div>
    </div>
    <div class="mt-3 rounded-xl border border-info/30 bg-info/10 p-3">
      <div class="font-semibold">{{ $t('backendDataFlowObservabilityTitle') }}</div>
      <div class="mt-1 opacity-80">{{ $t('backendDataFlowObservabilityTip') }}</div>
      <div class="mt-2 rounded-lg border border-info/20 bg-base-100/70 px-3 py-2">
        <div class="text-[11px] uppercase tracking-[0.12em] opacity-60">{{ $t('backendDataFlowMihomoLogLabel') }}</div>
        <code class="mt-1 block break-all">{{ mihomoLogPath }}</code>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { BACKEND_KINDS } from '@/config/backendContract'
import { UBUNTU_PATHS } from '@/config/project'
import { getBackendKindBadgeClass } from '@/helper/backend'
import type { Backend, BackendKind } from '@/types'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  backend: Omit<Backend, 'uuid'>
  kind?: BackendKind
}>()

const { t } = useI18n()

const kind = computed(() => props.kind || props.backend.kind || BACKEND_KINDS.COMPATIBILITY_BRIDGE)
const isUbuntuService = computed(() => kind.value === BACKEND_KINDS.UBUNTU_SERVICE)

const summaryText = computed(() =>
  isUbuntuService.value ? t('backendDataFlowUbuntuSummary') : t('backendDataFlowCompatibilitySummary'),
)

const directHint = computed(() =>
  isUbuntuService.value ? t('backendDataFlowDirectHintUbuntu') : t('backendDataFlowDirectHintCompatibility'),
)

const serviceHint = computed(() =>
  isUbuntuService.value ? t('backendDataFlowServiceHintUbuntu') : t('backendDataFlowServiceHintCompatibility'),
)

const mihomoLogPath = UBUNTU_PATHS.mihomoLog

const directItems = computed(() => [
  {
    key: 'proxies',
    title: t('backendDataFlowDirectProxiesTitle'),
    text: t('backendDataFlowDirectProxiesText'),
  },
  {
    key: 'rules',
    title: t('backendDataFlowDirectRulesTitle'),
    text: t('backendDataFlowDirectRulesText'),
  },
  {
    key: 'connections',
    title: t('backendDataFlowDirectConnectionsTitle'),
    text: t('backendDataFlowDirectConnectionsText'),
  },
  {
    key: 'logs',
    title: t('backendDataFlowDirectLogsTitle'),
    text: t('backendDataFlowDirectLogsText'),
  },
])

const serviceItems = computed(() => {
  const active = isUbuntuService.value
  return [
    {
      key: 'metrics',
      title: t('backendDataFlowServiceMetricsTitle'),
      text: active ? t('backendDataFlowServiceMetricsTextActive') : t('backendDataFlowServiceMetricsTextPending'),
      active,
    },
    {
      key: 'systemd',
      title: t('backendDataFlowServiceSystemdTitle'),
      text: active ? t('backendDataFlowServiceSystemdTextActive') : t('backendDataFlowServiceSystemdTextPending'),
      active,
    },
    {
      key: 'config',
      title: t('backendDataFlowServiceConfigTitle'),
      text: active ? t('backendDataFlowServiceConfigTextActive') : t('backendDataFlowServiceConfigTextPending'),
      active,
    },
    {
      key: 'backup',
      title: t('backendDataFlowServiceBackupTitle'),
      text: active ? t('backendDataFlowServiceBackupTextActive') : t('backendDataFlowServiceBackupTextPending'),
      active,
    },
  ]
})
</script>
