<template>
  <div class="card">
    <div class="card-title px-4 pt-4">
      {{ $t('routerTrafficTunnelDescriptionsSettingsTitle') }}
    </div>
    <div class="card-body gap-4">
      <div class="rounded-2xl border border-base-content/10 bg-base-200/20 p-3">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="space-y-1">
            <div class="text-sm font-semibold">{{ $t('routerTrafficTunnelDescriptions') }}</div>
            <div class="text-xs opacity-70">{{ $t('routerTrafficTunnelDescriptionsSettingsHint') }}</div>
            <div class="text-[11px] opacity-55">{{ tunnelDescriptionStorageHint }}</div>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="badge badge-ghost badge-sm">{{ tunnelDescriptionEntries.length }}</span>
            <span class="badge badge-outline badge-sm">{{ tunnelDescriptionStorageBadge }}</span>
            <button type="button" class="btn btn-sm" @click="openRouterTraffic">
              {{ $t('open') }} · {{ $t('router') }}
            </button>
          </div>
        </div>
      </div>

      <div class="space-y-2">
        <div v-if="!tunnelDescriptionEntries.length" class="rounded-lg border border-dashed border-base-content/10 bg-base-100/30 px-3 py-3 text-sm opacity-70">
          {{ $t('routerTrafficTunnelDescriptionsSettingsEmpty') }}
        </div>

        <div
          v-for="entry in tunnelDescriptionEntries"
          :key="`settings-tunnel-desc-${entry.name}`"
          class="grid gap-2 rounded-lg border border-base-content/10 bg-base-100/40 p-2 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto_auto]"
        >
          <div class="min-w-0">
            <div class="truncate text-sm font-medium">{{ ifaceBaseDisplayName(entry.name, entry.kind) }}</div>
            <div class="mt-1 flex flex-wrap items-center gap-2">
              <span class="truncate font-mono text-[11px] opacity-60">{{ entry.name }}</span>
              <span class="badge badge-ghost badge-xs uppercase">{{ entry.kind || 'vpn' }}</span>
            </div>
          </div>
          <input
            v-model="tunnelDescriptionDrafts[entry.name]"
            class="input input-sm w-full"
            type="text"
            :placeholder="$t('routerTrafficTunnelDescriptionPlaceholder')"
          />
          <button type="button" class="btn btn-sm" @click="saveTunnelDescription(entry.name)">{{ $t('save') }}</button>
          <button type="button" class="btn btn-ghost btn-sm" @click="clearTunnelDescription(entry.name)">{{ $t('clear') }}</button>
        </div>
      </div>

      <div class="rounded-2xl border border-base-content/10 bg-base-200/15 p-3">
        <div class="mb-2 text-sm font-medium">{{ $t('add') }}</div>
        <div class="mb-3 text-xs opacity-65">{{ $t('routerTrafficTunnelDescriptionsHint') }}</div>

        <div v-if="tunnelDescriptionSuggestions.length" class="mb-3 flex flex-wrap gap-2">
          <button
            v-for="name in tunnelDescriptionSuggestions"
            :key="`settings-tunnel-desc-suggest-${name}`"
            type="button"
            class="btn btn-ghost btn-xs font-mono"
            @click="prefillTunnelDescriptionName(name)"
          >
            {{ name }}
          </button>
        </div>

        <div class="grid gap-2 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto]">
          <input
            v-model="newTunnelInterfaceName"
            class="input input-sm w-full font-mono"
            type="text"
            :placeholder="$t('routerTrafficTunnelInterfacePlaceholder')"
          />
          <input
            v-model="newTunnelInterfaceDescription"
            class="input input-sm w-full"
            type="text"
            :placeholder="$t('routerTrafficTunnelDescriptionPlaceholder')"
          />
          <button type="button" class="btn btn-sm" :disabled="!canAddTunnelDescription" @click="addTunnelDescriptionEntry">
            {{ $t('add') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ROUTE_NAME } from '@/constant'
import { COMMON_TUNNEL_INTERFACE_SUGGESTIONS, ifaceBaseDisplayName, inferTunnelKindFromName, normalizeTunnelDescription, normalizeTunnelInterfaceName } from '@/helper/tunnelDescriptions'
import { tunnelInterfaceDescriptionMap } from '@/store/settings'
import { usersDbSyncEnabled } from '@/store/usersDbSync'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

const router = useRouter()
const { t } = useI18n()
const tunnelDescriptionDrafts = ref<Record<string, string>>({})
const newTunnelInterfaceName = ref('')
const newTunnelInterfaceDescription = ref('')

const tunnelDescriptionEntries = computed(() => {
  return Array.from(new Set(Object.keys(tunnelInterfaceDescriptionMap.value || {}).map((name) => normalizeTunnelInterfaceName(name)).filter(Boolean)))
    .map((name) => ({
      name,
      kind: inferTunnelKindFromName(name),
      description: normalizeTunnelDescription((tunnelInterfaceDescriptionMap.value || {})[name] || ''),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
})

const tunnelDescriptionSuggestions = computed(() => {
  const names = [
    ...Object.keys(tunnelInterfaceDescriptionMap.value || {}),
    ...COMMON_TUNNEL_INTERFACE_SUGGESTIONS,
  ]
  return Array.from(new Set(names.map((name) => normalizeTunnelInterfaceName(name)).filter(Boolean)))
    .filter((name) => !tunnelDescriptionEntries.value.some((entry) => entry.name === name))
    .slice(0, 8)
})

const canAddTunnelDescription = computed(() => normalizeTunnelInterfaceName(newTunnelInterfaceName.value).length > 0)
const tunnelDescriptionStorageBadge = computed(() => usersDbSyncEnabled.value ? t('routerTrafficTunnelDescriptionsStorageSharedBadge') : t('routerTrafficTunnelDescriptionsStorageLocalBadge'))
const tunnelDescriptionStorageHint = computed(() => usersDbSyncEnabled.value ? t('routerTrafficTunnelDescriptionsStorageSharedHint') : t('routerTrafficTunnelDescriptionsStorageHint'))

const prefillTunnelDescriptionName = (name: string) => {
  const key = normalizeTunnelInterfaceName(name)
  if (!key) return
  newTunnelInterfaceName.value = key
}

watch(tunnelDescriptionEntries, (entries) => {
  const next: Record<string, string> = { ...tunnelDescriptionDrafts.value }
  for (const entry of entries) {
    if (!(entry.name in next)) next[entry.name] = entry.description
  }
  tunnelDescriptionDrafts.value = next
}, { immediate: true, deep: true })

const saveTunnelDescription = (name: string) => {
  const key = normalizeTunnelInterfaceName(name)
  if (!key) return
  const next = { ...(tunnelInterfaceDescriptionMap.value || {}) }
  const description = normalizeTunnelDescription(tunnelDescriptionDrafts.value[key] || '')
  if (description) next[key] = description
  else delete next[key]
  tunnelInterfaceDescriptionMap.value = next
  tunnelDescriptionDrafts.value = { ...tunnelDescriptionDrafts.value, [key]: description }
}

const clearTunnelDescription = (name: string) => {
  const key = normalizeTunnelInterfaceName(name)
  if (!key) return
  const next = { ...(tunnelInterfaceDescriptionMap.value || {}) }
  delete next[key]
  tunnelInterfaceDescriptionMap.value = next
  tunnelDescriptionDrafts.value = { ...tunnelDescriptionDrafts.value, [key]: '' }
}

const addTunnelDescriptionEntry = () => {
  const key = normalizeTunnelInterfaceName(newTunnelInterfaceName.value)
  if (!key) return
  const description = normalizeTunnelDescription(newTunnelInterfaceDescription.value)
  tunnelDescriptionDrafts.value = { ...tunnelDescriptionDrafts.value, [key]: description }
  const next = { ...(tunnelInterfaceDescriptionMap.value || {}) }
  if (description) next[key] = description
  else delete next[key]
  tunnelInterfaceDescriptionMap.value = next
  newTunnelInterfaceName.value = ''
  newTunnelInterfaceDescription.value = ''
}

const openRouterTraffic = () => {
  router.push({ name: ROUTE_NAME.router })
}
</script>
