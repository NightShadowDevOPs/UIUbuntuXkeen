<template>
  <div class="flex shrink-0 items-center">
    <ProxyIcon
      v-if="icon"
      :icon="icon"
      :margin="iconMargin"
      :size="iconSize"
    />
    {{ name }}
  </div>
</template>

<script setup lang="ts">
import { proxyMap } from '@/store/proxies'
import { computed } from 'vue'
import ProxyIcon from './ProxyIcon.vue'

const props = withDefaults(
  defineProps<{
    name: string
    iconSize?: number
    iconMargin?: number
  }>(),
  {
    iconSize: 16,
    iconMargin: 4,
  },
)

const icon = computed(() => {
  return proxyMap.value[props.name]?.icon
})
</script>
