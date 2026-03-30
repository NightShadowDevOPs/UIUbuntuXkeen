<template>
  <div class="rounded-2xl border border-base-300/70 bg-base-100/70 px-3 py-3 text-xs leading-5">
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div>
        <div class="font-semibold">{{ $t(headingKey) }}</div>
        <div class="opacity-75">{{ summaryText }}</div>
      </div>
      <span :class="getBackendKindBadgeClass(kind)">
        {{ kind === BACKEND_KINDS.UBUNTU_SERVICE ? $t('backendModeShortUbuntu') : $t('backendModeShortDirect') }}
      </span>
    </div>

    <div class="mt-3 grid gap-2 lg:grid-cols-2">
      <div class="rounded-xl border border-base-300/60 bg-base-200/40 p-3">
        <div class="mb-1 font-semibold">{{ $t('backendContractConnectionPreview') }}</div>
        <div class="font-mono break-all">{{ baseUrl }}</div>
        <div class="mt-2 text-[11px] opacity-70">{{ $t('backendContractConnectionPreviewTip') }}</div>
      </div>

      <div class="rounded-xl border border-base-300/60 bg-base-200/40 p-3">
        <div class="mb-1 font-semibold">{{ $t('backendContractProbePaths') }}</div>
        <div class="flex flex-wrap gap-1">
          <code v-for="item in probePaths" :key="item" class="rounded bg-base-100 px-2 py-1">{{ item }}</code>
        </div>
      </div>
    </div>

    <div v-if="kind === BACKEND_KINDS.UBUNTU_SERVICE" class="mt-3 rounded-xl border border-success/30 bg-success/10 p-3">
      <div class="mb-2 font-semibold">{{ $t('backendContractUbuntuPathsTitle') }}</div>
      <div class="grid gap-2 md:grid-cols-2">
        <div v-for="item in ubuntuPathItems" :key="item.key" class="rounded-lg border border-success/20 bg-base-100/60 px-3 py-2">
          <div class="text-[11px] uppercase tracking-[0.12em] opacity-60">{{ item.label }}</div>
          <code class="mt-1 block break-all">{{ item.value }}</code>
        </div>
      </div>
    </div>

    <div v-else class="mt-3 rounded-xl border border-warning/30 bg-warning/10 p-3">
      <div class="font-semibold">{{ $t('backendContractCompatibilityTitle') }}</div>
      <div class="mt-1 opacity-80">{{ $t('backendContractCompatibilityTip') }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { BACKEND_KINDS } from '@/config/backendContract'
import { UBUNTU_PATHS } from '@/config/project'
import { getBackendKindBadgeClass, getBackendProbePaths } from '@/helper/backend'
import { getUrlFromBackend } from '@/helper/utils'
import type { Backend, BackendKind } from '@/types'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  backend: Omit<Backend, 'uuid'>
  kind?: BackendKind
}>()

const { t } = useI18n()

const kind = computed(() => props.kind || props.backend.kind || BACKEND_KINDS.COMPATIBILITY_BRIDGE)
const baseUrl = computed(() => getUrlFromBackend(props.backend))
const probePaths = computed(() => getBackendProbePaths(kind.value))
const headingKey = computed(() =>
  kind.value === BACKEND_KINDS.UBUNTU_SERVICE
    ? 'backendContractUbuntuHeading'
    : 'backendContractCompatibilityHeading',
)
const summaryText = computed(() =>
  kind.value === BACKEND_KINDS.UBUNTU_SERVICE
    ? t('backendContractUbuntuSummary')
    : t('backendContractCompatibilitySummary'),
)

const ubuntuPathItems = computed(() => [
  { key: 'active', label: t('backendContractPathActiveConfig'), value: UBUNTU_PATHS.activeConfig },
  { key: 'state', label: t('backendContractPathStateRoot'), value: UBUNTU_PATHS.stateRoot },
  { key: 'config', label: t('backendContractPathConfigRoot'), value: UBUNTU_PATHS.configRoot },
  { key: 'logs', label: t('backendContractPathLogsRoot'), value: UBUNTU_PATHS.logsRoot },
  { key: 'mihomoLog', label: t('backendContractPathMihomoLog'), value: UBUNTU_PATHS.mihomoLog },
  { key: 'env', label: t('backendContractPathAgentEnv'), value: UBUNTU_PATHS.agentEnv },
])
</script>
