<template>
  <div class="card hover:bg-base-200 mb-1 block p-2 text-sm break-all">
    <span
      class="inline-block text-left"
      :style="{ minWidth: `${(seqWithPadding.length + 1) * 0.62}em` }"
    >
      {{ seqWithPadding }}.
    </span>
    <span class="badge badge-sm text-main ml-2 inline-block min-w-14">
      {{ log.time }}
    </span>
    <span
      class="badge badge-sm ml-2 inline-block min-w-17 text-center"
      :class="textColorMapForType[log.type as keyof typeof textColorMapForType]"
    >
      {{ log.type }}
    </span>
    <span class="max-md:mt-2 max-md:block md:ml-2">{{ log.payload }}</span>
  </div>
</template>

<script setup lang="ts">
import { useBounceOnVisible } from '@/composables/bouncein'
import { LOG_LEVEL } from '@/constant'
import type { LogWithSeq } from '@/types'
import { computed } from 'vue'

const props = defineProps<{
  log: LogWithSeq
}>()

const seqWithPadding = computed(() => {
  return props.log.seq.toString().padStart(2, '0')
})

const textColorMapForType = {
  [LOG_LEVEL.Trace]: 'text-success',
  [LOG_LEVEL.Debug]: 'text-accent',
  [LOG_LEVEL.Info]: 'text-info',
  [LOG_LEVEL.Warning]: 'text-warning',
  [LOG_LEVEL.Error]: 'text-error',
  [LOG_LEVEL.Fatal]: 'text-error',
  [LOG_LEVEL.Panic]: 'text-error',
}

useBounceOnVisible()
</script>
