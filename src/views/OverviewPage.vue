<template>
  <div class="flex h-full flex-col gap-2 overflow-x-hidden overflow-y-auto p-2">
    <div class="card" v-if="displayProxiesRelationship">
      <div class="card-title px-4 pt-4 flex items-center justify-between gap-2">
        <span>{{ $t('proxiesRelationship') }}</span>
      </div>

      <div class="px-4 pb-4">
        <ProxiesRuleCharts />
      </div>
    </div>

    <ConnectionHistory />
    <div class="flex-1"></div>

    <div class="card items-center justify-center gap-2 p-2 sm:flex-row">
      {{ getLabelFromBackend(activeBackend!) }} :
      <BackendVersion />
    </div>
  </div>
</template>

<script setup lang="ts">
import BackendVersion from '@/components/common/BackendVersion.vue'
import ConnectionHistory from '@/components/overview/ConnectionHistory.vue'
import ProxiesRuleCharts from '@/components/overview/ProxiesRuleCharts.vue'
import { getLabelFromBackend } from '@/helper/utils'
import { displayProxiesRelationship } from '@/store/settings'
import { activeBackend } from '@/store/setup'
</script>
