<template>
  <div class="card gap-3 p-3">
    <div class="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <div class="font-semibold">{{ t('hostLogsCardTitle') }}</div>
        <div class="text-sm opacity-70">{{ t('hostLogsCardTip') }}</div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <label class="flex items-center gap-2 text-xs opacity-80">
          <span>{{ t('source') }}</span>
          <select v-model="source" class="select select-sm min-w-[160px]">
            <option value="mihomo">{{ t('mihomoLog') }}</option>
            <option value="service">{{ t('hostRuntimeServiceLog') }}</option>
          </select>
        </label>
        <label class="flex items-center gap-2 text-xs opacity-80">
          <span>tail</span>
          <select v-model.number="tail" class="select select-sm w-24">
            <option :value="80">80</option>
            <option :value="160">160</option>
            <option :value="240">240</option>
            <option :value="400">400</option>
          </select>
        </label>
        <button type="button" class="btn btn-sm" @click="refresh" :disabled="loading">
          <span v-if="loading" class="loading loading-spinner loading-xs"></span>
          <span v-else>{{ t('refresh') }}</span>
        </button>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-2 text-xs opacity-80">
      <span class="badge badge-ghost">{{ payload.path || fallbackPath }}</span>
      <span v-if="updatedAtText" class="badge badge-ghost">{{ updatedAtText }}</span>
      <span class="badge" :class="payload.ok ? 'badge-success' : 'badge-warning'">{{ payload.ok ? t('online') : t('hostLogsWaiting') }}</span>
    </div>

    <div v-if="errorText" class="alert alert-warning p-2 text-sm">
      <span>{{ errorText }}</span>
    </div>

    <div v-if="!payload.text" class="rounded-lg border border-base-content/10 bg-base-200/40 px-3 py-2 text-sm opacity-80">
      {{ t('hostLogsEmpty') }}
    </div>

    <pre v-else class="max-h-[34rem] overflow-auto whitespace-pre-wrap rounded-xl border border-base-content/10 bg-base-200/70 p-3 text-xs leading-5">{{ payload.text }}</pre>
  </div>
</template>

<script setup lang="ts">
import { fetchUbuntuSystemLogsAPI, type UbuntuSystemLogs } from '@/api/ubuntuService'
import { UBUNTU_PATHS } from '@/config/project'
import dayjs from 'dayjs'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const source = ref<'mihomo' | 'service'>('mihomo')
const tail = ref(160)
const loading = ref(false)
const payload = ref<UbuntuSystemLogs>({ ok: false, text: '' })

const fallbackPath = computed(() => (source.value === 'mihomo' ? UBUNTU_PATHS.mihomoLog : '/var/log/ultra-ui-ubuntu/service.log'))
const errorText = computed(() => String(payload.value.error || '').trim())
const updatedAtText = computed(() => {
  const sec = Number(payload.value.updatedAtSec || 0)
  if (!Number.isFinite(sec) || sec <= 0) return ''
  return `${t('lastUpdate')}: ${dayjs.unix(sec).format('YYYY-MM-DD HH:mm:ss')}`
})

const refresh = async () => {
  loading.value = true
  try {
    payload.value = await fetchUbuntuSystemLogsAPI({ source: source.value, tail: tail.value })
  } finally {
    loading.value = false
  }
}

watch([source, tail], () => {
  refresh()
})

onMounted(() => {
  refresh()
})
</script>
