<template>
  <ProxiesPage />
</template>

<script setup lang="ts">
import { PROXY_TAB_TYPE } from '@/constant'
import { proxiesTabShow } from '@/store/proxies'
import ProxiesPage from './ProxiesPage.vue'

proxiesTabShow.value = PROXY_TAB_TYPE.PROXIES
</script>
