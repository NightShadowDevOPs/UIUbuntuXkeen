<template>
  <span
    :class="[
      'inline-flex items-center justify-center whitespace-nowrap rounded-md border border-base-300/70 bg-base-200/40 font-semibold leading-none tracking-wide shrink-0',
      size === 'sm' ? 'h-5 min-w-8 px-1.5 text-[11px]' : 'h-6 min-w-9 px-2 text-[12px]',
    ]"
    :title="titleText"
  >
    <span v-if="kind === 'none'" class="opacity-70">—</span>
    <GlobeAltIcon v-else-if="kind === 'globe'" class="h-4 w-4" />
    <span v-else-if="flagEmoji" :class="emojiClass" :aria-label="flagCode">{{ flagEmoji }}</span>
    <span v-else class="font-mono">{{ flagCode || raw }}</span>
  </span>
</template>

<script setup lang="ts">
import { countryCodeToEmoji, normalizeCountryCode } from '@/helper/flagIcons'
import { normalizeProviderIcon } from '@/helper/providerIcon'
import { GlobeAltIcon } from '@heroicons/vue/24/outline'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{ icon: string; size?: 'sm' | 'md' }>(),
  { size: 'md' },
)

const raw = computed(() => normalizeProviderIcon(props.icon))

const kind = computed<'none' | 'globe' | 'flag'>(() => {
  if (!raw.value) return 'none'
  if (raw.value === 'globe') return 'globe'
  return 'flag'
})

const flagCode = computed(() => {
  if (kind.value !== 'flag') return ''
  return normalizeCountryCode(raw.value)
})

const flagEmoji = computed(() => countryCodeToEmoji(flagCode.value))

const titleText = computed(() => {
  if (kind.value === 'none') return '—'
  if (kind.value === 'globe') return 'globe'
  return flagCode.value || raw.value
})

const emojiClass = computed(() =>
  props.size === 'sm'
    ? 'text-[14px] leading-none font-["Twemoji","NotoEmoji",system-ui,sans-serif]'
    : 'text-[16px] leading-none font-["Twemoji","NotoEmoji",system-ui,sans-serif]',
)
</script>
