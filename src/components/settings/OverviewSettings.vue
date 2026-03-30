<template>
  <!-- overview -->
  <div class="card">
    <div class="card-title px-4 pt-4">
      {{ $t('overview') }}
    </div>

    <div class="card-body grid grid-cols-1 gap-2 lg:grid-cols-2">
      <div class="flex items-center justify-between gap-2">
        {{ $t('showIPAndConnectionInfo') }}
        <input class="toggle" type="checkbox" v-model="showIPAndConnectionInfo" />
      </div>

      <template v-if="showIPAndConnectionInfo">
        <div class="flex items-center justify-between gap-2">
          {{ $t('autoIPCheckWhenStart') }}
          <input class="toggle" type="checkbox" v-model="autoIPCheck" />
        </div>

        <div class="flex items-center justify-between gap-2">
          {{ $t('autoConnectionCheckWhenStart') }}
          <input class="toggle" type="checkbox" v-model="autoConnectionCheck" />
        </div>

        <div class="flex flex-col gap-1">
          <div class="flex items-center justify-between gap-2">
            {{ $t('twoIpTokens') }}
          </div>
          <textarea class="textarea textarea-sm" v-model="twoIpTokensText" :placeholder="$t('optional')" rows="3"></textarea>
          <div class="text-xs opacity-60">
            {{ $t('twoIpTokensTip') }}
          </div>
        </div>
      </template>

      <div class="flex items-center justify-between gap-2">
        {{ $t('displayProxiesRelationship') }}
        <input class="toggle" type="checkbox" v-model="displayProxiesRelationship" />
      </div>

      <div class="flex items-center justify-between gap-2" v-if="displayProxiesRelationship">
        {{ $t('proxiesRelationshipSources') }}
        <input class="toggle" type="checkbox" v-model="proxiesRelationshipUseSources" />
      </div>

      <div class="flex flex-col gap-1" v-if="displayProxiesRelationship">
        <div class="flex items-center justify-between gap-2">
          {{ $t('proxiesRelationshipWeight') }}
          <select class="select select-sm min-w-28" v-model="proxiesRelationshipWeightMode">
            <option value="traffic">{{ $t('traffic') }}</option>
            <option value="count">{{ $t('count') }}</option>
          </select>
        </div>

        <div class="flex items-center justify-between gap-2">
          {{ $t('proxiesRelationshipColor') }}
          <select class="select select-sm min-w-28" v-model="proxiesRelationshipColorMode">
            <option value="proxy">{{ $t('proxies') }}</option>
            <option value="provider">{{ $t('provider') }}</option>
            <option value="rule">{{ $t('rule') }}</option>
            <option value="none">{{ $t('none') }}</option>
          </select>
        </div>

        <div class="flex items-center justify-between gap-2">
          {{ $t('proxiesRelationshipSourceMode') }}
          <select class="select select-sm min-w-28" v-model="proxiesRelationshipSourceMode">
            <option value="auto">{{ $t('auto') }}</option>
            <option value="rulePayload">{{ $t('rulePayload') }}</option>
            <option value="host">{{ $t('host') }}</option>
            <option value="destinationIP">{{ $t('destination') }}</option>
          </select>
        </div>

        <div class="flex items-center justify-between gap-2">
          {{ $t('proxiesRelationshipTopN') }}
          <input class="range range-xs" type="range" min="10" max="100" step="5" v-model.number="proxiesRelationshipTopN" />
          <span class="text-xs opacity-70 w-10 text-right">{{ proxiesRelationshipTopN }}</span>
        </div>

        <div class="flex items-center justify-between gap-2">
          {{ $t('proxiesRelationshipTopNChain') }}
          <input class="range range-xs" type="range" min="10" max="60" step="2" v-model.number="proxiesRelationshipTopNChain" />
          <span class="text-xs opacity-70 w-10 text-right">{{ proxiesRelationshipTopNChain }}</span>
        </div>
      </div>

      <div class="flex items-center gap-2 max-md:hidden">
        {{ $t('showStatisticsWhenSidebarCollapsed') }}
        <input class="toggle" type="checkbox" v-model="showStatisticsWhenSidebarCollapsed" />
      </div>

      <div class="flex items-center gap-2 max-md:hidden">
        {{ $t('numberOfChartsInSidebar') }}
        <select class="select select-sm min-w-24" v-model="numberOfChartsInSidebar">
          <option v-for="opt in [1, 2, 3]" :key="opt" :value="opt">
            {{ opt }}
          </option>
        </select>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  autoConnectionCheck,
  autoIPCheck,
  displayProxiesRelationship,
  numberOfChartsInSidebar,
  showIPAndConnectionInfo,
  showStatisticsWhenSidebarCollapsed,
  twoIpTokensText,
  proxiesRelationshipColorMode,
  proxiesRelationshipSourceMode,
  proxiesRelationshipTopN,
  proxiesRelationshipTopNChain,
  proxiesRelationshipWeightMode,
  proxiesRelationshipUseSources,
} from '@/store/settings'
</script>
