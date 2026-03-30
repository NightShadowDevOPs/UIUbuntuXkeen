<template>
  <div class="bg-base-200/50 relative rounded-lg p-2 text-sm">
    <div class="flex flex-col gap-1 pr-12">
      <div class="flex items-center justify-between">
        <div>
          <span class="inline-block w-24">Baidu</span> :
          <span :class="getColorForLatency(Number(baiduLatency))">{{ baiduLatency }}ms</span>
        </div>
      </div>

      <div>
        <span class="inline-block w-24">Cloudflare</span> :
        <span :class="getColorForLatency(Number(cloudflareLatency))">{{ cloudflareLatency }}ms</span>
      </div>

      <div>
        <span class="inline-block w-24">Github</span> :
        <span :class="getColorForLatency(Number(githubLatency))">{{ githubLatency }}ms</span>
      </div>

      <div>
        <span class="inline-block w-24">YouTube</span> :
        <span :class="getColorForLatency(Number(youtubeLatency))">{{ youtubeLatency }}ms</span>
      </div>

      <div>
        <span class="inline-block w-24">Yandex</span> :
        <span :class="getColorForLatency(Number(yandexLatency))">{{ yandexLatency }}ms</span>
      </div>

      <div>
        <span class="inline-block w-24">2ip.ru</span> :
        <span :class="getColorForLatency(Number(twoipLatency))">{{ twoipLatency }}ms</span>
      </div>

      <div class="mt-1 flex items-center gap-2">
        <input
          class="input input-sm flex-1"
          v-model="customPingTarget"
          :placeholder="$t('pingTargetPlaceholder')"
        />
        <button class="btn btn-sm whitespace-nowrap min-w-16" @click="pingCustom">
          {{ $t('ping') }}
        </button>
        <span class="font-mono min-w-[80px] text-right" :class="getColorForLatency(Number(customPingLatency))">
          {{ customPingLatency ? customPingLatency + 'ms' : '' }}
        </span>
      </div>
    </div>

    <button class="btn btn-circle btn-sm absolute right-2 top-2" @click="getLatency">
      <BoltIcon class="h-4 w-4" />
    </button>
  </div>
</template>

<script setup lang="ts">
import {
  get2ipLatencyAPI,
  getBaiduLatencyAPI,
  getCloudflareLatencyAPI,
  getGithubLatencyAPI,
  getLatencyFromTargetAPI,
  getYouTubeLatencyAPI,
  getYandexLatencyAPI,
} from '@/api/latency'
import {
  baiduLatency,
  cloudflareLatency,
  customPingLatency,
  githubLatency,
  twoipLatency,
  yandexLatency,
  youtubeLatency,
} from '@/composables/overview'
import { getColorForLatency } from '@/helper'
import { autoConnectionCheck, customPingTarget } from '@/store/settings'
import { BoltIcon } from '@heroicons/vue/24/outline'
import { onMounted } from 'vue'

const setMs = (refValue: { value: string }, ms: number) => {
  refValue.value = ms ? ms.toFixed(0) : '0'
}

const getLatency = async () => {
  getBaiduLatencyAPI().then((res) => setMs(baiduLatency, res))
  getCloudflareLatencyAPI().then((res) => setMs(cloudflareLatency, res))
  getGithubLatencyAPI().then((res) => setMs(githubLatency, res))
  getYouTubeLatencyAPI().then((res) => setMs(youtubeLatency, res))
  getYandexLatencyAPI().then((res) => setMs(yandexLatency, res))
  get2ipLatencyAPI().then((res) => setMs(twoipLatency, res))
}

const pingCustom = async () => {
  const target = (customPingTarget.value || '').trim()
  if (!target) return
  customPingLatency.value = ''
  getLatencyFromTargetAPI(target).then((res) => setMs(customPingLatency, res))
}

onMounted(() => {
  if (
    autoConnectionCheck.value &&
    [baiduLatency, cloudflareLatency, githubLatency, youtubeLatency, yandexLatency, twoipLatency].some(
      (item) => item.value === '',
    )
  ) {
    getLatency()
  }
})
</script>
