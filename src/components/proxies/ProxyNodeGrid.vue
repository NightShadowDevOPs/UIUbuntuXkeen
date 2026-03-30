<template>
  <div
    class="grid gap-2"
    :style="`grid-template-columns: repeat(auto-fill, minmax(${minProxyCardWidth}px, 1fr));`"
  >
    <slot />
  </div>
</template>

<script lang="ts" setup>
import { minProxyCardWidth } from '@/store/settings'
</script>
