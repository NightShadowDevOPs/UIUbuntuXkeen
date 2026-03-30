<template>
  <div class="flex h-full flex-col gap-3 overflow-x-hidden overflow-y-auto p-2">
    <div class="card gap-3 p-3">
      <div class="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div class="font-semibold">{{ t(workspaceTitleKey) }}</div>
          <div class="text-sm opacity-70">{{ t(workspaceTipKey) }}</div>
        </div>

        <div class="flex flex-wrap gap-2">
          <button type="button" class="btn btn-sm" @click="setSection('overview')">
            {{ t('routerSectionOverviewTitle') }}
          </button>
          <button type="button" class="btn btn-sm btn-ghost" @click="setSection('traffic')">
            {{ t('routerSectionTrafficTitle') }}
          </button>
          <button type="button" class="btn btn-sm btn-ghost" @click="setSection('network')">
            {{ t('routerSectionNetworkTitle') }}
          </button>
        </div>
      </div>

      <div class="overflow-x-auto">
        <div class="tabs tabs-boxed inline-flex min-w-max gap-1 bg-base-200/60 p-1">
          <button
            v-for="section in routerSections"
            :key="section.id"
            type="button"
            class="tab whitespace-nowrap border-0"
            :class="activeSection === section.id ? 'tab-active !bg-base-100 shadow-sm' : 'opacity-80 hover:opacity-100'"
            @click="setSection(section.id)"
          >
            {{ t(section.labelKey) }}
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr),20rem]">
        <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-3">
          <div class="text-xs font-semibold uppercase tracking-[0.12em] opacity-55">{{ t(activeSectionMeta.labelKey) }}</div>
          <div class="mt-1 text-sm opacity-70">{{ t(activeSectionMeta.tipKey) }}</div>
        </div>
        <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-3">
          <div class="font-semibold">{{ t(infoTitleKey) }}</div>
          <div class="mt-1 text-sm opacity-70">{{ t(infoTipKey) }}</div>
        </div>
      </div>
    </div>

    <section v-show="activeSection === 'overview'" class="space-y-2">
      <div class="px-1">
        <div class="text-xs font-semibold uppercase tracking-[0.12em] opacity-55">{{ t('routerSectionOverviewTitle') }}</div>
        <div class="text-sm opacity-70">{{ t('routerSectionOverviewTip') }}</div>
      </div>

      <div class="grid grid-cols-1 gap-2 xl:grid-cols-2">
        <AgentCard />
        <SystemCard />
      </div>

      <div class="card items-center justify-center gap-2 p-2 sm:flex-row">
        {{ getLabelFromBackend(activeBackend!) }} :
        <BackendVersion />
      </div>
    </section>

    <section v-show="activeSection === 'traffic'" class="space-y-2">
      <div class="px-1">
        <div class="text-xs font-semibold uppercase tracking-[0.12em] opacity-55">{{ t('routerSectionTrafficTitle') }}</div>
        <div class="text-sm opacity-70">{{ t('routerSectionTrafficTip') }}</div>
      </div>

      <div class="card gap-2 p-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div class="font-semibold">{{ t('hostQosTitle') }}</div>
            <div class="text-sm opacity-70">{{ t('hostQosMovedToTrafficTip') }}</div>
          </div>
          <button type="button" class="btn btn-sm" @click="goUsersTraffic">
            {{ t('open') }} · {{ t('traffic') }}
          </button>
        </div>
      </div>

      <NetcrazeTrafficCard />
      <ChartsCard title-key="router" />
    </section>

    <section v-show="activeSection === 'network'" class="space-y-2">
      <div class="px-1">
        <div class="text-xs font-semibold uppercase tracking-[0.12em] opacity-55">{{ t('routerSectionNetworkTitle') }}</div>
        <div class="text-sm opacity-70">{{ t('routerSectionNetworkTip') }}</div>
      </div>

      <NetworkCard v-if="showIPAndConnectionInfo" />
      <div v-else class="card gap-2 p-3 text-sm opacity-70">
        {{ t('routerSectionNetworkDisabled') }}
      </div>

      <div class="card items-center justify-center gap-2 p-2 sm:flex-row">
        {{ getLabelFromBackend(activeBackend!) }} :
        <BackendVersion />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import AgentCard from '@/components/router/AgentCard.vue'
import SystemCard from '@/components/router/SystemCard.vue'
import BackendVersion from '@/components/common/BackendVersion.vue'
import ChartsCard from '@/components/overview/ChartsCard.vue'
import NetcrazeTrafficCard from '@/components/overview/NetcrazeTrafficCard.vue'
import NetworkCard from '@/components/overview/NetworkCard.vue'
import { ROUTE_NAME } from '@/constant'
import {
  getBackendInfoTipKey,
  getBackendInfoTitleKey,
  getBackendRuntimeTipKey,
  getBackendRuntimeTitleKey,
} from '@/helper/backend'
import { getLabelFromBackend } from '@/helper/utils'
import { i18n } from '@/i18n'
import { showIPAndConnectionInfo } from '@/store/settings'
import { activeBackend } from '@/store/setup'
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const router = useRouter()
const route = useRoute()
const t = i18n.global.t

const routerSections = [
  { id: 'overview', labelKey: 'routerSectionOverviewTitle', tipKey: 'routerSectionOverviewTip' },
  { id: 'traffic', labelKey: 'routerSectionTrafficTitle', tipKey: 'routerSectionTrafficTip' },
  { id: 'network', labelKey: 'routerSectionNetworkTitle', tipKey: 'routerSectionNetworkTip' },
] as const

type RouterSectionId = (typeof routerSections)[number]['id']

const resolveSectionId = (raw: unknown): RouterSectionId => {
  const value = String(raw || '').trim()
  return (routerSections.find((item) => item.id === value)?.id || 'overview') as RouterSectionId
}

const activeSection = computed<RouterSectionId>(() => resolveSectionId(route.query.section))
const activeSectionMeta = computed(() => routerSections.find((item) => item.id === activeSection.value) || routerSections[0])
const activeBackendKind = computed(() => activeBackend.value?.kind)
const workspaceTitleKey = computed(() => getBackendRuntimeTitleKey(activeBackendKind.value))
const workspaceTipKey = computed(() => getBackendRuntimeTipKey(activeBackendKind.value))
const infoTitleKey = computed(() => getBackendInfoTitleKey(activeBackendKind.value))
const infoTipKey = computed(() => getBackendInfoTipKey(activeBackendKind.value))

const setSection = (id: RouterSectionId) => {
  if (activeSection.value === id) return
  router.replace({
    name: ROUTE_NAME.router,
    query: {
      ...route.query,
      section: id,
    },
  })
}

const goUsersTraffic = () => {
  router.push({ name: ROUTE_NAME.traffic })
}

watch(
  () => route.query.section,
  (value) => {
    const resolved = resolveSectionId(value)
    if (String(value || '').trim() === resolved) return
    router.replace({
      name: ROUTE_NAME.router,
      query: {
        ...route.query,
        section: resolved,
      },
    })
  },
  { immediate: true },
)
</script>
