<template>
  <div class="card gap-3 p-3">
    <div class="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <div class="font-semibold">{{ t('hostServicesCardTitle') }}</div>
        <div class="text-sm opacity-70">{{ t('hostServicesCardTip') }}</div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <span class="badge badge-ghost">{{ t('hostServicesCount', { count: items.length }) }}</span>
        <button type="button" class="btn btn-sm" @click="refresh" :disabled="loading">
          <span v-if="loading" class="loading loading-spinner loading-xs"></span>
          <span v-else>{{ t('refresh') }}</span>
        </button>
      </div>
    </div>

    <div v-if="errorText" class="alert alert-warning p-2 text-sm">
      <span>{{ errorText }}</span>
    </div>

    <div v-if="!items.length" class="rounded-lg border border-base-content/10 bg-base-200/40 px-3 py-2 text-sm opacity-80">
      {{ t('hostServicesEmpty') }}
    </div>

    <div v-else class="grid grid-cols-1 gap-2 xl:grid-cols-2">
      <div v-for="item in items" :key="item.name" class="rounded-xl border border-base-content/10 bg-base-100/50 p-3">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div class="font-semibold">{{ item.label || item.name }}</div>
            <div class="mt-1 text-xs font-mono opacity-60">{{ item.name }}</div>
          </div>

          <div class="flex flex-wrap items-center gap-2 text-xs">
            <span class="badge" :class="serviceStateBadge(item)">{{ serviceStateText(item) }}</span>
            <span class="badge" :class="item.enabled ? 'badge-success badge-outline' : 'badge-ghost badge-outline'">
              {{ item.enabled ? t('enabled') : t('disabled') }}
            </span>
          </div>
        </div>

        <div class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div class="rounded-lg border border-base-content/10 bg-base-200/30 px-3 py-2">
            <div class="text-[11px] uppercase tracking-wide opacity-60">{{ t('status') }}</div>
            <div class="mt-1 text-sm font-medium">{{ item.activeState || '—' }}<span v-if="item.subState"> · {{ item.subState }}</span></div>
          </div>
          <div class="rounded-lg border border-base-content/10 bg-base-200/30 px-3 py-2">
            <div class="text-[11px] uppercase tracking-wide opacity-60">PID</div>
            <div class="mt-1 text-sm font-mono">{{ item.mainPid || '—' }}</div>
          </div>
          <div class="rounded-lg border border-base-content/10 bg-base-200/30 px-3 py-2 sm:col-span-2">
            <div class="text-[11px] uppercase tracking-wide opacity-60">{{ t('hostRuntimeStartedAt') }}</div>
            <div class="mt-1 text-sm font-mono">{{ formatSince(item.sinceSec) }}</div>
          </div>
          <div v-if="item.version" class="rounded-lg border border-base-content/10 bg-base-200/30 px-3 py-2 sm:col-span-2">
            <div class="text-[11px] uppercase tracking-wide opacity-60">{{ t('agentVersion') }}</div>
            <div class="mt-1 break-all text-sm font-mono">{{ item.version }}</div>
          </div>
          <div v-if="item.description" class="rounded-lg border border-base-content/10 bg-base-200/30 px-3 py-2 sm:col-span-2">
            <div class="text-[11px] uppercase tracking-wide opacity-60">{{ t('description') }}</div>
            <div class="mt-1 text-sm">{{ item.description }}</div>
          </div>
          <div v-if="item.error" class="rounded-lg border border-error/20 bg-error/5 px-3 py-2 text-sm sm:col-span-2">
            {{ item.error }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { fetchUbuntuSystemServicesAPI, type UbuntuSystemServiceItem } from '@/api/ubuntuService'
import { useI18n } from 'vue-i18n'
import dayjs from 'dayjs'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const { t } = useI18n()
const loading = ref(false)
const payload = ref<{ ok: boolean; items: UbuntuSystemServiceItem[]; updatedAtSec?: number; error?: string }>({ ok: false, items: [] })

const items = computed(() => payload.value.items || [])
const errorText = computed(() => String(payload.value.error || '').trim())

const serviceStateBadge = (item: UbuntuSystemServiceItem) => {
  const state = String(item.activeState || '').toLowerCase()
  if (state === 'active' || state === 'running') return 'badge-success'
  if (state === 'activating' || state === 'reloading') return 'badge-info'
  if (state === 'failed') return 'badge-error'
  if (state) return 'badge-warning'
  return 'badge-ghost'
}

const serviceStateText = (item: UbuntuSystemServiceItem) => {
  const state = String(item.activeState || item.subState || '').trim()
  return state || t('unknown')
}

const formatSince = (sec?: number) => {
  const value = Number(sec || 0)
  if (!Number.isFinite(value) || value <= 0) return '—'
  return dayjs.unix(value).format('YYYY-MM-DD HH:mm:ss')
}

const refresh = async () => {
  loading.value = true
  try {
    payload.value = await fetchUbuntuSystemServicesAPI()
  } finally {
    loading.value = false
  }
}

let timer: number | null = null

onMounted(() => {
  refresh()
  timer = window.setInterval(() => {
    refresh()
  }, 15000)
})

onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer)
})
</script>
