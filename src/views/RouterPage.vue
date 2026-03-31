<template>
  <div class="flex h-full flex-col gap-3 overflow-x-hidden overflow-y-auto p-2">
    <div class="card gap-3 p-3">
      <div class="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div class="font-semibold">{{ t('hostRuntimeWorkspaceTitle') }}</div>
          <div class="text-sm opacity-70">{{ t('hostRuntimeWorkspaceTip') }}</div>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            v-for="section in hostSections"
            :key="`host-${section.id}`"
            type="button"
            class="btn btn-sm"
            :class="activeSection === section.id ? '' : 'btn-ghost'"
            @click="setSection(section.id)"
          >
            {{ t(section.labelKey) }}
          </button>
        </div>
      </div>

      <div class="overflow-x-auto">
        <div class="tabs tabs-boxed inline-flex min-w-max gap-1 bg-base-200/60 p-1">
          <button
            v-for="section in hostSections"
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
          <div class="font-semibold">{{ t('hostRuntimeInfo') }}</div>
          <div class="mt-1 text-sm opacity-70">{{ t('hostRuntimeInfoTip') }}</div>
        </div>
      </div>

      <div class="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-base-content/80">
        {{ t('hostWorkspaceCleanupNotice') }}
      </div>
    </div>

    <BackendDataFlowCard v-if="activeBackend" :backend="activeBackend" :kind="activeBackend.kind" />

    <section v-show="activeSection === 'overview'" class="space-y-2">
      <div class="px-1">
        <div class="text-xs font-semibold uppercase tracking-[0.12em] opacity-55">{{ t('hostSectionOverviewTitle') }}</div>
        <div class="text-sm opacity-70">{{ t('hostSectionOverviewTip') }}</div>
      </div>

      <HostRuntimeCard />

      <div class="card items-center justify-center gap-2 p-2 sm:flex-row">
        {{ getLabelFromBackend(activeBackend!) }} :
        <BackendVersion />
      </div>
    </section>

    <section v-show="activeSection === 'services'" class="space-y-2">
      <div class="px-1">
        <div class="text-xs font-semibold uppercase tracking-[0.12em] opacity-55">{{ t('hostSectionServicesTitle') }}</div>
        <div class="text-sm opacity-70">{{ t('hostSectionServicesTip') }}</div>
      </div>

      <HostServicesCard />
    </section>

    <section v-show="activeSection === 'logs'" class="space-y-2">
      <div class="px-1">
        <div class="text-xs font-semibold uppercase tracking-[0.12em] opacity-55">{{ t('hostSectionLogsTitle') }}</div>
        <div class="text-sm opacity-70">{{ t('hostSectionLogsTip') }}</div>
      </div>

      <HostLogsCard />
    </section>
  </div>
</template>
<script setup lang="ts">
import BackendVersion from '@/components/common/BackendVersion.vue'
import HostLogsCard from '@/components/host/HostLogsCard.vue'
import HostRuntimeCard from '@/components/host/HostRuntimeCard.vue'
import HostServicesCard from '@/components/host/HostServicesCard.vue'
import BackendDataFlowCard from '@/components/settings/BackendDataFlowCard.vue'
import { ROUTE_NAME } from '@/constant'
import { getLabelFromBackend } from '@/helper/utils'
import { i18n } from '@/i18n'
import { activeBackend } from '@/store/setup'
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const router = useRouter()
const route = useRoute()
const t = i18n.global.t

const hostSections = [
  { id: 'overview', labelKey: 'hostSectionOverviewTitle', tipKey: 'hostSectionOverviewTip' },
  { id: 'services', labelKey: 'hostSectionServicesTitle', tipKey: 'hostSectionServicesTip' },
  { id: 'logs', labelKey: 'hostSectionLogsTitle', tipKey: 'hostSectionLogsTip' },
] as const

type SectionMeta = { id: string; labelKey: string; tipKey: string }

const resolveSectionId = (raw: unknown, sections: SectionMeta[]): string => {
  const value = String(raw || '').trim()
  return sections.find((item) => item.id === value)?.id || sections[0]?.id || 'overview'
}

const activeSection = computed(() => resolveSectionId(route.query.section, [...hostSections]))
const activeSectionMeta = computed(() => hostSections.find((item) => item.id === activeSection.value) || hostSections[0])

const setSection = (id: string) => {
  if (activeSection.value === id) return
  router.replace({
    name: ROUTE_NAME.router,
    query: {
      ...route.query,
      section: id,
    },
  })
}

watch(
  () => route.query.section,
  (value) => {
    const resolved = resolveSectionId(value, [...hostSections])
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
