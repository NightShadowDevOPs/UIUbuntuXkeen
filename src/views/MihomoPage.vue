<template>
  <div class="flex h-full flex-col gap-3 overflow-x-hidden overflow-y-auto p-2">
    <div class="card gap-3 p-3">
      <div class="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div class="font-semibold">{{ $t('mihomoWorkspaceTitle') }}</div>
          <div class="text-sm opacity-70">{{ $t('mihomoWorkspaceTip') }}</div>
        </div>

        <div class="flex flex-wrap gap-2">
          <button type="button" class="btn btn-sm" @click="setSection('config')">
            {{ $t('mihomoWorkspaceOpenConfig') }}
          </button>
          <button type="button" class="btn btn-sm btn-ghost" @click="goToRoute(ROUTE_NAME.router)">
            {{ $t('mihomoWorkspaceOpenRuntime') }}
          </button>
          <button type="button" class="btn btn-sm btn-ghost" @click="goToRoute(ROUTE_NAME.proxyProviders)">
            {{ $t('mihomoWorkspaceOpenProviders') }}
          </button>
          <button type="button" class="btn btn-sm btn-ghost" @click="goToRoute(ROUTE_NAME.rules)">
            {{ $t('mihomoWorkspaceOpenRules') }}
          </button>
        </div>
      </div>

      <div class="overflow-x-auto">
        <div class="tabs tabs-boxed inline-flex min-w-max gap-1 bg-base-200/60 p-1">
          <button
            v-for="section in mihomoSections"
            :key="section.id"
            type="button"
            class="tab whitespace-nowrap border-0"
            :class="activeSection === section.id ? 'tab-active !bg-base-100 shadow-sm' : 'opacity-80 hover:opacity-100'"
            @click="setSection(section.id)"
          >
            {{ $t(section.labelKey) }}
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr),20rem]">
        <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-3">
          <div class="text-xs font-semibold uppercase tracking-[0.12em] opacity-55">{{ $t(activeSectionMeta.labelKey) }}</div>
          <div class="mt-1 text-sm opacity-70">{{ $t(activeSectionMeta.tipKey) }}</div>
        </div>
        <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-3">
          <div class="font-semibold">{{ $t('mihomoWorkspaceSafetyTitle') }}</div>
          <div class="mt-1 text-sm opacity-70">{{ $t('mihomoWorkspaceSafetyTip') }}</div>
          <div class="mt-2 flex flex-wrap gap-2 text-xs">
            <span class="badge badge-ghost">draft</span>
            <span class="badge badge-ghost">validate</span>
            <span class="badge badge-ghost">rollback</span>
            <span class="badge badge-ghost">baseline</span>
          </div>
        </div>
      </div>
    </div>

    <section v-show="activeSection === 'overview'" class="space-y-2">
      <div class="px-1">
        <div class="text-xs font-semibold uppercase tracking-[0.12em] opacity-55">{{ $t('mihomoSectionOverviewTitle') }}</div>
        <div class="text-sm opacity-70">{{ $t('mihomoSectionOverviewTip') }}</div>
      </div>

      <div class="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <div class="card gap-3 p-3 xl:col-span-2">
          <div>
            <div class="font-semibold">{{ $t('mihomoOverviewStructureTitle') }}</div>
            <div class="text-sm opacity-70">{{ $t('mihomoOverviewStructureTip') }}</div>
          </div>

          <div class="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
            <button type="button" class="card items-start gap-1 p-3 text-left transition hover:bg-base-200/70" @click="setSection('runtime')">
              <div class="font-semibold">{{ $t('mihomoSectionRuntimeTitle') }}</div>
              <div class="text-xs opacity-70">{{ $t('mihomoSectionRuntimeTip') }}</div>
            </button>
            <button type="button" class="card items-start gap-1 p-3 text-left transition hover:bg-base-200/70" @click="setSection('providers')">
              <div class="font-semibold">{{ $t('mihomoSectionProvidersTitle') }}</div>
              <div class="text-xs opacity-70">{{ $t('mihomoSectionProvidersTip') }}</div>
            </button>
            <button type="button" class="card items-start gap-1 p-3 text-left transition hover:bg-base-200/70" @click="setSection('rules')">
              <div class="font-semibold">{{ $t('mihomoSectionRulesTitle') }}</div>
              <div class="text-xs opacity-70">{{ $t('mihomoSectionRulesTip') }}</div>
            </button>
            <button type="button" class="card items-start gap-1 p-3 text-left transition hover:bg-base-200/70" @click="setSection('config')">
              <div class="font-semibold">{{ $t('mihomoConfigSectionTitle') }}</div>
              <div class="text-xs opacity-70">{{ $t('mihomoConfigSectionTip') }}</div>
            </button>
          </div>
        </div>

        <div class="card gap-2 p-3">
          <div class="font-semibold">{{ $t('mihomoWorkspaceSafetyTitle') }}</div>
          <div class="text-sm opacity-70">{{ $t('mihomoWorkspaceSafetyTip') }}</div>
          <div class="flex flex-wrap gap-2 text-xs">
            <span class="badge badge-ghost">draft</span>
            <span class="badge badge-ghost">validate</span>
            <span class="badge badge-ghost">rollback</span>
            <span class="badge badge-ghost">baseline</span>
          </div>
        </div>
      </div>
    </section>

    <section v-show="activeSection === 'runtime'" class="space-y-2">
      <div class="px-1">
        <div class="text-xs font-semibold uppercase tracking-[0.12em] opacity-55">{{ $t('mihomoSectionRuntimeTitle') }}</div>
        <div class="text-sm opacity-70">{{ $t('mihomoSectionRuntimeTip') }}</div>
      </div>

      <div class="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <button type="button" class="card items-start gap-2 p-3 text-left transition hover:bg-base-200/70" @click="goToRoute(ROUTE_NAME.router)">
          <div class="font-semibold">{{ $t('mihomoCardRuntimeTitle') }}</div>
          <div class="text-sm opacity-70">{{ $t('mihomoCardRuntimeTip') }}</div>
        </button>

        <button type="button" class="card items-start gap-2 p-3 text-left transition hover:bg-base-200/70" @click="goToRoute(ROUTE_NAME.traffic)">
          <div class="font-semibold">{{ $t('mihomoRuntimeTrafficTitle') }}</div>
          <div class="text-sm opacity-70">{{ $t('mihomoRuntimeTrafficTip') }}</div>
        </button>

        <button type="button" class="card items-start gap-2 p-3 text-left transition hover:bg-base-200/70" @click="goToRoute(ROUTE_NAME.connections)">
          <div class="font-semibold">{{ $t('mihomoRuntimeConnectionsTitle') }}</div>
          <div class="text-sm opacity-70">{{ $t('mihomoRuntimeConnectionsTip') }}</div>
        </button>
      </div>
    </section>

    <section v-show="activeSection === 'providers'" class="space-y-2">
      <div class="px-1">
        <div class="text-xs font-semibold uppercase tracking-[0.12em] opacity-55">{{ $t('mihomoSectionProvidersTitle') }}</div>
        <div class="text-sm opacity-70">{{ $t('mihomoSectionProvidersTip') }}</div>
      </div>

      <div class="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <button type="button" class="card items-start gap-2 p-3 text-left transition hover:bg-base-200/70" @click="goToRoute(ROUTE_NAME.proxyProviders)">
          <div class="font-semibold">{{ $t('mihomoCardProvidersTitle') }}</div>
          <div class="text-sm opacity-70">{{ $t('mihomoCardProvidersTip') }}</div>
        </button>

        <button type="button" class="card items-start gap-2 p-3 text-left transition hover:bg-base-200/70" @click="goToRoute(ROUTE_NAME.proxies)">
          <div class="font-semibold">{{ $t('mihomoProvidersGroupsTitle') }}</div>
          <div class="text-sm opacity-70">{{ $t('mihomoProvidersGroupsTip') }}</div>
        </button>

        <button type="button" class="card items-start gap-2 p-3 text-left transition hover:bg-base-200/70" @click="goToRoute(ROUTE_NAME.subscriptions)">
          <div class="font-semibold">{{ $t('mihomoProvidersSubscriptionsTitle') }}</div>
          <div class="text-sm opacity-70">{{ $t('mihomoProvidersSubscriptionsTip') }}</div>
        </button>
      </div>
    </section>

    <section v-show="activeSection === 'rules'" class="space-y-2">
      <div class="px-1">
        <div class="text-xs font-semibold uppercase tracking-[0.12em] opacity-55">{{ $t('mihomoSectionRulesTitle') }}</div>
        <div class="text-sm opacity-70">{{ $t('mihomoSectionRulesTip') }}</div>
      </div>

      <div class="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <button type="button" class="card items-start gap-2 p-3 text-left transition hover:bg-base-200/70" @click="goToRoute(ROUTE_NAME.rules)">
          <div class="font-semibold">{{ $t('mihomoCardRulesTitle') }}</div>
          <div class="text-sm opacity-70">{{ $t('mihomoCardRulesTip') }}</div>
        </button>

        <button type="button" class="card items-start gap-2 p-3 text-left transition hover:bg-base-200/70" @click="goToRoute(ROUTE_NAME.policies)">
          <div class="font-semibold">{{ $t('mihomoRulesPoliciesTitle') }}</div>
          <div class="text-sm opacity-70">{{ $t('mihomoRulesPoliciesTip') }}</div>
        </button>

        <button type="button" class="card items-start gap-2 p-3 text-left transition hover:bg-base-200/70" @click="goToRoute(ROUTE_NAME.tasks)">
          <div class="font-semibold">{{ $t('mihomoRulesTasksTitle') }}</div>
          <div class="text-sm opacity-70">{{ $t('mihomoRulesTasksTip') }}</div>
        </button>
      </div>
    </section>

    <section v-show="activeSection === 'config'" class="space-y-2">
      <div class="px-1">
        <div class="text-xs font-semibold uppercase tracking-[0.12em] opacity-55">{{ $t('mihomoConfigSectionTitle') }}</div>
        <div class="text-sm opacity-70">{{ $t('mihomoConfigSectionTip') }}</div>
      </div>
      <MihomoConfigEditor />
    </section>
  </div>
</template>

<script setup lang="ts">
import MihomoConfigEditor from '@/components/settings/MihomoConfigEditor.vue'
import { ROUTE_NAME } from '@/constant'
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const router = useRouter()
const route = useRoute()

const mihomoSections = [
  { id: 'overview', labelKey: 'mihomoSectionOverviewTitle', tipKey: 'mihomoSectionOverviewTip' },
  { id: 'runtime', labelKey: 'mihomoSectionRuntimeTitle', tipKey: 'mihomoSectionRuntimeTip' },
  { id: 'providers', labelKey: 'mihomoSectionProvidersTitle', tipKey: 'mihomoSectionProvidersTip' },
  { id: 'rules', labelKey: 'mihomoSectionRulesTitle', tipKey: 'mihomoSectionRulesTip' },
  { id: 'config', labelKey: 'mihomoConfigSectionTitle', tipKey: 'mihomoConfigSectionTip' },
] as const

type MihomoSectionId = (typeof mihomoSections)[number]['id']

const resolveSectionId = (raw: unknown): MihomoSectionId => {
  const value = String(raw || '').trim()
  return (mihomoSections.find((item) => item.id === value)?.id || 'overview') as MihomoSectionId
}

const activeSection = computed<MihomoSectionId>(() => resolveSectionId(route.query.section))
const activeSectionMeta = computed(() => mihomoSections.find((item) => item.id === activeSection.value) || mihomoSections[0])

const goToRoute = (name: ROUTE_NAME) => {
  router.push({ name })
}

const setSection = (id: MihomoSectionId) => {
  if (activeSection.value === id) return
  router.replace({
    name: ROUTE_NAME.mihomo,
    query: {
      ...route.query,
      section: id,
    },
  })
}

watch(
  () => route.query.section,
  (value) => {
    const resolved = resolveSectionId(value)
    if (String(value || '').trim() === resolved) return
    router.replace({
      name: ROUTE_NAME.mihomo,
      query: {
        ...route.query,
        section: resolved,
      },
    })
  },
  { immediate: true },
)
</script>
