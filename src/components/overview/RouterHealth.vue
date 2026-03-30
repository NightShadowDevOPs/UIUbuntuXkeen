<template>
  <div class="bg-base-200/50 relative rounded-lg p-2 text-sm">
    <div class="flex items-center justify-between pr-12">
      <div class="font-medium">{{ $t('routerHealth') }}</div>
      <div class="text-xs opacity-60" v-if="lastCheckAt">
        {{ $t('lastCheck') }}: {{ fromNow(lastCheckAt) }}
      </div>
    </div>

    <div class="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
      <div class="opacity-70">API</div>
      <div class="flex items-center gap-2">
        <span
          class="badge badge-sm"
          :class="apiOk ? 'badge-success' : 'badge-error'"
        >
          {{ apiOk ? 'OK' : 'DOWN' }}
        </span>
        <span class="font-mono" v-if="apiOk && apiLatencyMs">{{ apiLatencyMs }}ms</span>
      </div>

      <div class="opacity-70">WS</div>
      <div class="flex flex-wrap items-center gap-2">
        <span class="badge badge-sm" :class="wsOk ? 'badge-success' : 'badge-warning'">
          {{ wsOk ? 'OK' : 'STALE' }}
        </span>
        <span class="text-xs opacity-70">mem {{ ageLabel(lastMemoryTick) }}</span>
        <span class="text-xs opacity-70">net {{ ageLabel(lastTrafficTick) }}</span>
        <span class="text-xs opacity-70">conn {{ ageLabel(lastConnectionsTick) }}</span>
      </div>

      <div class="opacity-70">{{ $t('connections') }}</div>
      <div class="font-mono">{{ activeConnections.length }}</div>

      <div class="opacity-70">{{ $t('memoryUsage') }}</div>
      <div class="font-mono">{{ prettyBytes(memory || 0) }}</div>

      <div class="opacity-70">{{ $t('traffic') }}</div>
      <div class="font-mono">
        {{ prettyBytes(uploadSpeed || 0) }}/s ↑ · {{ prettyBytes(downloadSpeed || 0) }}/s ↓
      </div>
    </div>

    <button class="btn btn-circle btn-sm absolute right-2 top-2" @click="check" :class="isLoading && 'loading'">
      <BoltIcon class="h-4 w-4" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { fetchVersionSilentAPI } from '@/api'
import { prettyBytesHelper, fromNow as fromNowFn } from '@/helper/utils'
import { activeConnections, lastConnectionsTick } from '@/store/connections'
import { downloadSpeed, lastMemoryTick, lastTrafficTick, memory, uploadSpeed } from '@/store/overview'
import { BoltIcon } from '@heroicons/vue/24/outline'
import { computed, onMounted, onUnmounted, ref } from 'vue'

const apiOk = ref(true)
const apiLatencyMs = ref<number | null>(null)
const lastCheckAt = ref<number>(0)
const isLoading = ref(false)

const prettyBytes = (b: number) => prettyBytesHelper(b)
const fromNow = (ts: number) => fromNowFn(new Date(ts).toISOString())

const ageLabel = (tick: number) => {
  if (!tick) return '—'
  const s = Math.floor((Date.now() - tick) / 1000)
  return s <= 0 ? '0s' : `${s}s`
}

const wsOk = computed(() => {
  const now = Date.now()
  const memOk = lastMemoryTick.value && now - lastMemoryTick.value < 8000
  const netOk = lastTrafficTick.value && now - lastTrafficTick.value < 8000
  const connOk = lastConnectionsTick.value && now - lastConnectionsTick.value < 8000
  return memOk && netOk && connOk
})

let timer: any
const check = async () => {
  if (isLoading.value) return
  isLoading.value = true
  try {
    const t0 = performance.now()
    await fetchVersionSilentAPI()
    const t1 = performance.now()
    apiOk.value = true
    apiLatencyMs.value = Math.max(1, Math.round(t1 - t0))
  } catch {
    apiOk.value = false
    apiLatencyMs.value = null
  } finally {
    lastCheckAt.value = Date.now()
    isLoading.value = false
  }
}

onMounted(() => {
  check()
  timer = setInterval(check, 30_000)
})

onUnmounted(() => {
  clearInterval(timer)
})
</script>
