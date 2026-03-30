<template>
  <div class="grid grid-cols-1 gap-3 overflow-x-hidden p-2">
    <div class="card gap-3 p-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div class="font-semibold">{{ $t('settingsSectionsTitle') }}</div>
          <div class="text-sm opacity-70">{{ $t('settingsSectionsTip') }}</div>
        </div>

        <button type="button" class="btn btn-sm" @click="openMihomo">
          {{ $t('openMihomoSection') }}
        </button>
      </div>

      <div class="flex flex-wrap gap-2">
        <button type="button" class="btn btn-xs btn-ghost" @click="scrollToSection('settings-interface')">
          {{ $t('settingsSectionInterface') }}
        </button>
        <button type="button" class="btn btn-xs btn-ghost" @click="scrollToSection('settings-backend')">
          {{ $t('settingsSectionBackend') }}
        </button>
        <button type="button" class="btn btn-xs btn-ghost" @click="scrollToSection('settings-traffic')">
          {{ $t('settingsSectionTraffic') }}
        </button>
        <button type="button" class="btn btn-xs btn-ghost" @click="scrollToSection('settings-pages')">
          {{ $t('settingsSectionPages') }}
        </button>
      </div>
    </div>

    <section id="settings-interface" class="space-y-2">
      <div class="px-1">
        <div class="text-xs font-semibold uppercase tracking-[0.12em] opacity-55">{{ $t('settingsSectionInterface') }}</div>
        <div class="text-sm opacity-70">{{ $t('settingsSectionInterfaceTip') }}</div>
      </div>
      <ZashboardSettings />
      <GeneralSettings />
    </section>

    <section id="settings-backend" class="space-y-2">
      <div class="px-1">
        <div class="text-xs font-semibold uppercase tracking-[0.12em] opacity-55">{{ $t('settingsSectionBackend') }}</div>
        <div class="text-sm opacity-70">{{ $t('settingsSectionBackendTip') }}</div>
      </div>
      <BackendSettings />
    </section>

    <section id="settings-traffic" class="space-y-2">
      <div class="px-1">
        <div class="text-xs font-semibold uppercase tracking-[0.12em] opacity-55">{{ $t('settingsSectionTraffic') }}</div>
        <div class="text-sm opacity-70">{{ $t('settingsSectionTrafficTip') }}</div>
      </div>
      <TunnelDescriptionsSettings />
    </section>

    <section id="settings-pages" class="space-y-2">
      <div class="px-1">
        <div class="text-xs font-semibold uppercase tracking-[0.12em] opacity-55">{{ $t('settingsSectionPages') }}</div>
        <div class="text-sm opacity-70">{{ $t('settingsSectionPagesTip') }}</div>
      </div>
      <ProxiesSettings />

      <template v-if="isMounted">
        <ConnectionsSettings />
        <OverviewSettings />
      </template>
    </section>
  </div>
</template>

<script setup lang="ts">
import BackendSettings from '@/components/settings/BackendSettings.vue'
import ConnectionsSettings from '@/components/settings/ConnectionsSettings.vue'
import GeneralSettings from '@/components/settings/GeneralSettings.vue'
import OverviewSettings from '@/components/settings/OverviewSettings.vue'
import ProxiesSettings from '@/components/settings/ProxiesSettings.vue'
import TunnelDescriptionsSettings from '@/components/settings/TunnelDescriptionsSettings.vue'
import ZashboardSettings from '@/components/settings/ZashboardSettings.vue'
import { ROUTE_NAME } from '@/constant'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const isMounted = ref(false)
const router = useRouter()

onMounted(() => {
  requestAnimationFrame(() => {
    isMounted.value = true
  })
})

const scrollToSection = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const openMihomo = () => {
  router.push({ name: ROUTE_NAME.mihomo, query: { section: 'config' } })
}
</script>
