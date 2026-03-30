<template>
  <div class="inline-flex rounded-2xl bg-white p-3 shadow-sm">
    <div
      v-if="svgMarkup"
      :style="boxStyle"
      class="size-full"
      v-html="svgMarkup"
    />
    <div v-else :style="boxStyle" class="grid place-items-center text-center text-xs text-neutral-content/60">
      QR
    </div>
  </div>
</template>

<script setup lang="ts">
import qrcode from 'qrcode-generator'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    text: string
    size?: number
  }>(),
  {
    size: 220,
  },
)

const boxStyle = computed(() => ({ width: `${props.size}px`, height: `${props.size}px` }))

const svgMarkup = computed(() => {
  const value = String(props.text || '').trim()
  if (!value) return ''
  try {
    const qr = qrcode(0, 'M')
    qr.addData(value)
    qr.make()
    return qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true })
  } catch {
    return ''
  }
})
</script>
