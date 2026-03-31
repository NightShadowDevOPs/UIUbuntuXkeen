<template>
  <div class="grid grid-cols-1 gap-2 overflow-x-hidden p-2">
    <div class="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-base-content/80">{{ $t('legacyWorkspaceUsersNotice') }}</div>
    <UsersInventoryPanel />

    <div class="card">
      <div class="card-title px-4 pt-4">{{ t('users') }}</div>
      <div class="card-body gap-3">
        <div class="flex items-start justify-between gap-2">
          <div class="text-sm opacity-70">
            {{ t('usersTip') }}
          </div>
          <button
            type="button"
            class="btn btn-sm"
            @click="toggleImportPanel"
            :disabled="importLoading"
          >
            <ArrowDownTrayIcon class="h-4 w-4" />
            {{ t('importLanHosts') }}
          </button>
        </div>

        <CollapseCard name="usersImportLanHosts">
          <template #title="{ open }">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <ArrowDownTrayIcon class="h-4 w-4" />
                <span class="text-base font-semibold">{{ t('importLanHostsTitle') }}</span>
                <span v-if="importLoading" class="loading loading-spinner loading-sm"></span>
              </div>
              <ChevronDownIcon
                class="h-4 w-4 opacity-60 transition-transform"
                :class="open ? 'rotate-180' : ''"
              />
            </div>
          </template>

          <template #preview>
            <div class="mt-1 text-sm opacity-70">
              {{ t('importLanHostsTip') }}
            </div>
          </template>

          <template #content>
            <div class="flex flex-col gap-3 pt-1">
              <div class="text-sm opacity-70">{{ t('importLanHostsTip') }}</div>

              <div v-if="importLoading" class="flex items-center gap-2 text-sm opacity-70">
                <span class="loading loading-spinner loading-sm"></span>
                <span>{{ t('update') }}...</span>
              </div>

              <div v-else>
                <div v-if="importError" class="alert alert-error p-2 text-sm">
                  <span>{{ importError }}</span>
                </div>

                <div v-else>
                  <label class="label cursor-pointer justify-start gap-3">
                    <input v-model="overwriteExisting" type="checkbox" class="checkbox checkbox-sm" />
                    <span class="label-text">{{ t('importLanHostsOverwrite') }}</span>
                  </label>

                  <div v-if="!importItems.length" class="text-sm opacity-70">
                    {{ t('importLanHostsNone') }}
                  </div>

                  <div v-else class="overflow-x-auto">
                    <table class="table table-sm">
                      <thead>
                        <tr>
                          <th class="w-10"></th>
                          <th>{{ t('importLanHostsHost') }}</th>
                          <th>{{ t('importLanHostsIp') }}</th>
                          <th class="max-md:hidden">{{ t('importLanHostsMac') }}</th>
                          <th class="max-md:hidden">{{ t('importLanHostsSource') }}</th>
                          <th class="w-24"></th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="it in importItems" :key="it.ip" class="hover">
                          <td>
                            <input
                              type="checkbox"
                              class="checkbox checkbox-sm"
                              v-model="it.selected"
                              :disabled="it.status === 'same' || it.status === 'nohost'"
                            />
                          </td>
                          <td class="font-medium">
                            <div class="flex flex-col">
                              <span>{{ it.hostname || '—' }}</span>
                              <span v-if="it.currentLabel" class="text-xs opacity-60">{{ it.currentLabel }}</span>
                            </div>
                          </td>
                          <td class="font-mono text-xs">{{ it.ip }}</td>
                          <td class="font-mono text-xs max-md:hidden">{{ it.mac || '—' }}</td>
                          <td class="text-xs max-md:hidden">{{ it.source || '—' }}</td>
                          <td>
                            <span
                              class="badge badge-sm"
                              :class="
                                it.status === 'add'
                                  ? 'badge-success'
                                  : it.status === 'fill'
                                    ? 'badge-info'
                                    : it.status === 'overwrite'
                                      ? 'badge-warning'
                                      : it.status === 'skip'
                                        ? 'badge-ghost'
                                        : 'badge-neutral'
                              "
                            >
                              {{ statusText(it.status) }}
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div class="mt-3 flex items-center justify-between gap-2">
                    <div class="text-sm opacity-70">
                      {{ selectedCount }} / {{ importItems.length }}
                    </div>
                    <div class="flex items-center gap-2">
                      <button type="button" class="btn btn-sm btn-ghost" @click="closeImportPanel">
                        {{ t('close') }}
                      </button>
                      <button
                        type="button"
                        class="btn btn-sm btn-primary"
                        :disabled="selectedCount === 0"
                        @click="applyImport"
                      >
                        {{ t('importLanHostsApply') }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </CollapseCard>

        <CollapseCard name="usersSourceIpMapping">
          <template #title="{ open }">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <TagIcon class="h-4 w-4" />
                <span class="text-base font-semibold">
                  {{ t('sourceIPLabels') }}
                  <span v-if="sourceIPLabelList.length" class="opacity-70">({{ sourceIPLabelList.length }})</span>
                </span>
              </div>
              <ChevronDownIcon
                class="h-4 w-4 opacity-60 transition-transform"
                :class="open ? 'rotate-180' : ''"
              />
            </div>
          </template>

          <template #preview>
            <div class="mt-1 text-sm opacity-70">
              {{ t('usersTip') }}
            </div>
          </template>

          <template #content>
            <div class="flex flex-col gap-2 pt-1">
              <Draggable
                v-if="sourceIPLabelList.length"
                class="flex flex-1 flex-col gap-2"
                v-model="sourceIPLabelList"
                group="list"
                :animation="150"
                :handle="'.drag-handle'"
                :filter="'.no-drag'"
                :prevent-on-filter="false"
                :item-key="'id'"
                @start="disableSwipe = true"
                @end="disableSwipe = false"
              >
                <template #item="{ element: sourceIP }">
                  <div data-nav-kind="user" :data-nav-value="String(sourceIP.key || '')">
                    <SourceIPInput
                      :model-value="sourceIP"
                      @update:model-value="handlerLabelUpdate"
                    >
                      <template #prefix>
                        <ChevronUpDownIcon class="drag-handle h-4 w-4 shrink-0 cursor-grab" />
                        <LockClosedIcon
                          v-if="isBlockedUser(sourceIP)"
                          class="no-drag h-4 w-4 text-error"
                          :title="t('userBlockedTip')"
                        />
                        <CloudIcon
                          v-if="usersDbSyncActive && usersDbSyncedIdSet.has(sourceIP.id)"
                          class="no-drag h-4 w-4 text-success"
                          :title="t('usersDbSyncedUserTip')"
                        />
                      </template>
                      <template #default>
                        <TopologyActionButtons
                          :stage="'C'"
                          :value="String(sourceIP.key || '').trim()"
                          :grouped="false"
                          containerClass="no-drag"
                          buttonClass="no-drag"
                        />
                        <button
                          type="button"
                          class="no-drag btn btn-circle btn-ghost btn-sm"
                          @click.stop.prevent="handlerLabelRemove(sourceIP.id)"
                          @pointerdown.stop.prevent
                          @mousedown.stop.prevent
                          @touchstart.stop.prevent
                          :title="t('delete')"
                        >
                          <TrashIcon class="h-4 w-4" />
                        </button>
                      </template>
                    </SourceIPInput>
                    <div class="ml-10 flex flex-wrap items-center gap-1 text-xs">
                      <span class="badge badge-xs" :class="ruleKindBadgeClass(sourceIP.key)">
                        {{ ruleKindLabel(sourceIP.key) }}
                      </span>
                      <span
                        class="badge badge-xs badge-ghost"
                        :title="sourceIpLiveMatchesTitle(sourceIP.key)"
                      >
                        {{ t('sourceIpLiveMatchesShort', { count: sourceIpLiveMatchesCount(sourceIP.key) }) }}
                      </span>
                    </div>
                  </div>
                </template>
              </Draggable>

              <div v-else class="text-sm opacity-60">
                {{ t('usersEmpty') }}
              </div>

              <SourceIPInput
                v-model="newLabelForIP"
                @keydown.enter="handlerLabelAdd"
              >
                <template #prefix>
                  <TagIcon class="h-4 w-4 shrink-0" />
                </template>
                <template #default>
                  <button
                    type="button"
                    class="no-drag btn btn-circle btn-sm"
                    @click.stop.prevent="handlerLabelAdd"
                    @pointerdown.stop.prevent
                    @mousedown.stop.prevent
                    @touchstart.stop.prevent
                    :title="t('add')"
                  >
                    <PlusIcon class="h-4 w-4" />
                  </button>
                </template>
              </SourceIPInput>
              <div v-if="newLabelForIP.key" class="ml-10 flex flex-wrap items-center gap-1 text-xs">
                <span class="badge badge-xs" :class="ruleKindBadgeClass(newLabelForIP.key)">
                  {{ ruleKindLabel(newLabelForIP.key) }}
                </span>
                <span
                  class="badge badge-xs badge-ghost"
                  :title="sourceIpLiveMatchesTitle(newLabelForIP.key)"
                >
                  {{ t('sourceIpLiveMatchesShort', { count: sourceIpLiveMatchesCount(newLabelForIP.key) }) }}
                </span>
              </div>
            </div>
          </template>
        </CollapseCard>
      </div>
    </div>

    <div class="card">
      <div class="card-body gap-2">
        <div class="flex items-center justify-between gap-2">
          <div>
            <div class="font-semibold">{{ t('traffic') }}</div>
            <div class="text-sm opacity-70">{{ t('trafficMovedToTrafficSectionTip') }}</div>
          </div>
          <button type="button" class="btn btn-sm" @click="goTraffic">{{ t('open') }} · {{ t('traffic') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>


<script setup lang="ts">
import SourceIPInput from '@/components/settings/SourceIPInput.vue'
import CollapseCard from '@/components/common/CollapseCard.vue'
import TopologyActionButtons from '@/components/common/TopologyActionButtons.vue'
import { agentLanHostsAPI } from '@/api/agent'
import { showNotification } from '@/helper/notification'
import { i18n } from '@/i18n'
import { disableSwipe } from '@/composables/swipe'
import { ROUTE_NAME } from '@/constant'
import UsersInventoryPanel from '@/components/users/UsersInventoryPanel.vue'
import { cleanupExpiredPendingPageFocus, clearPendingPageFocus, flashNavHighlight, getPendingPageFocusForRoute } from '@/helper/navFocus'
import { getSourceIpRuleKind, matchesSourceIpRule } from '@/helper/sourceip'
import { connections } from '@/store/connections'
import { collapseGroupMap, sourceIPLabelList } from '@/store/settings'
import { usersDbSyncActive, usersDbSyncedIdSet } from '@/store/usersDbSync'
import type { SourceIPLabel } from '@/types'
import { ArrowDownTrayIcon, ChevronDownIcon, ChevronUpDownIcon, CloudIcon, LockClosedIcon, PlusIcon, TagIcon, TrashIcon } from '@heroicons/vue/24/outline'
import { v4 as uuid } from 'uuid'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import Draggable from 'vuedraggable'
import { useRouter } from 'vue-router'
import { getUserLimitState } from '@/composables/userLimits'

const t = i18n.global.t
const router = useRouter()
const goTraffic = () => router.push({ name: ROUTE_NAME.traffic })

const newLabelForIP = ref<Omit<SourceIPLabel, 'id'>>({
  key: '',
  label: '',
})

const handlerLabelAdd = () => {
  if (!newLabelForIP.value.key || !newLabelForIP.value.label) {
    return
  }
  sourceIPLabelList.value.push({
    ...newLabelForIP.value,
    id: uuid(),
  })
  newLabelForIP.value = {
    key: '',
    label: '',
  }
}

const handlerLabelRemove = (id: string) => {
  const idx = sourceIPLabelList.value.findIndex((item) => item.id === id)
  if (idx >= 0) sourceIPLabelList.value.splice(idx, 1)
}

const handlerLabelUpdate = (sourceIP: Partial<SourceIPLabel>) => {
  const index = sourceIPLabelList.value.findIndex((item) => item.id === sourceIP.id)
  if (index < 0) return
  sourceIPLabelList.value[index] = {
    ...sourceIPLabelList.value[index],
    ...sourceIP,
  }
}

const isBlockedUser = (sourceIP: Partial<SourceIPLabel>) => {
  const user = (sourceIP.label || sourceIP.key || '').toString().trim()
  if (!user) return false
  return getUserLimitState(user).blocked
}


const liveSourceIps = computed(() => {
  return Array.from(new Set(
    (connections.value || [])
      .map((conn) => String((conn as any)?.metadata?.sourceIP || '').trim())
      .filter(Boolean),
  )).sort((a, b) => a.localeCompare(b))
})

const ruleKindLabel = (key: string) => {
  const kind = getSourceIpRuleKind(String(key || '').trim())
  if (kind === 'cidr') return t('sourceIpRuleKindCidr')
  if (kind === 'regex') return t('sourceIpRuleKindRegex')
  if (kind === 'suffix') return t('sourceIpRuleKindSuffix')
  return t('sourceIpRuleKindExact')
}

const ruleKindBadgeClass = (key: string) => {
  const kind = getSourceIpRuleKind(String(key || '').trim())
  if (kind === 'cidr') return 'badge-info'
  if (kind === 'regex') return 'badge-warning'
  if (kind === 'suffix') return 'badge-secondary'
  return 'badge-neutral'
}

const sourceIpLiveMatches = (key: string) => {
  const raw = String(key || '').trim()
  if (!raw) return []
  return liveSourceIps.value.filter((ip) => matchesSourceIpRule(raw, ip))
}

const sourceIpLiveMatchesCount = (key: string) => sourceIpLiveMatches(key).length

const sourceIpLiveMatchesTitle = (key: string) => {
  const items = sourceIpLiveMatches(key)
  if (!items.length) return t('sourceIpLiveMatchesNone')
  return t('sourceIpLiveMatchesTitle', { count: items.length, ips: items.slice(0, 6).join(', ') })
}


type ImportItem = {
  ip: string
  hostname: string
  mac?: string
  source?: string
  status: 'add' | 'fill' | 'overwrite' | 'skip' | 'same' | 'nohost'
  selected: boolean
  currentLabel?: string
}

const importLoading = ref(false)
const importError = ref('')
const overwriteExisting = ref(false)
const importItems = ref<ImportItem[]>([])

const IMPORT_COLLAPSE_NAME = 'usersImportLanHosts'
const importLastFetchAt = ref(0)

const MAPPING_COLLAPSE_NAME = 'usersSourceIpMapping'
if (collapseGroupMap.value[MAPPING_COLLAPSE_NAME] === undefined) {
  // Keep the mapping visible by default (same behavior as before),
  // while allowing users to collapse it when the list grows.
  collapseGroupMap.value[MAPPING_COLLAPSE_NAME] = true
}

// --- Cross-page navigation focus (Topology -> Users) ---
const findUserEl = (ip: string) => {
  const v = String(ip || '').trim()
  if (!v) return null
  const items = Array.from(document.querySelectorAll('[data-nav-kind="user"]')) as HTMLElement[]
  return (
    items.find((el) => String((el as any).dataset?.navValue || '').trim() === v) ||
    null
  )
}

let focusApplied = false
const tryApplyPendingFocus = async () => {
  if (focusApplied) return
  const pf = getPendingPageFocusForRoute(ROUTE_NAME.users)
  if (!pf || pf.kind !== 'user') return

  const ip = String(pf.value || '').trim()
  if (!ip) return

  // Ensure mapping accordion is open.
  collapseGroupMap.value[MAPPING_COLLAPSE_NAME] = true

  const start = performance.now()
  const loop = async () => {
    await nextTick()
    const el = findUserEl(ip)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      flashNavHighlight(el)
      clearPendingPageFocus()
      focusApplied = true
      return
    }
    if (performance.now() - start < 2400) requestAnimationFrame(() => loop())
  }
  loop()
}

onMounted(() => {
  cleanupExpiredPendingPageFocus()
  tryApplyPendingFocus()
})

watch(sourceIPLabelList, () => {
  tryApplyPendingFocus()
})

const fetchImportItems = async () => {
  // Avoid re-fetch spam when user quickly toggles the panel.
  const now = Date.now()
  if (importLoading.value) return
  if (importItems.value.length && now - importLastFetchAt.value < 3000) return

  importLastFetchAt.value = now
  importLoading.value = true
  importError.value = ''
  importItems.value = []

  const res = await agentLanHostsAPI()
  importLoading.value = false

  if (!res?.ok) {
    importError.value = res?.error || 'offline'
    return
  }

  buildImportItems((res as any).items || [])
}

const normalizeName = (s: string) => (s || '').toString().trim().replace(/\s+/g, ' ').toLowerCase()

const buildImportItems = (raw: any[]) => {
  const byIp = new Map<string, any>()
  for (const it of raw || []) {
    const ip = String((it as any)?.ip || '').trim()
    if (!ip) continue
    const hostname = String((it as any)?.hostname || '').trim()
    const mac = String((it as any)?.mac || '').trim()
    const source = String((it as any)?.source || '').trim()

    // Prefer items with a hostname.
    if (!byIp.has(ip)) {
      byIp.set(ip, { ip, hostname, mac, source })
    } else {
      const cur = byIp.get(ip)
      if (!cur.hostname && hostname) byIp.set(ip, { ip, hostname, mac: mac || cur.mac, source: source || cur.source })
    }
  }

  const out: ImportItem[] = []
  for (const v of Array.from(byIp.values())) {
    const ip = v.ip
    const hostname = v.hostname
    const existing = sourceIPLabelList.value.find((x) => String(x.key || '').trim() === ip) || null
    const currentLabel = existing ? String(existing.label || '').trim() : ''

    let status: ImportItem['status'] = 'add'
    let selected = false

    if (!hostname) {
      status = 'nohost'
      selected = false
    } else if (!existing) {
      status = 'add'
      selected = true
    } else {
      const curN = normalizeName(currentLabel)
      const hostN = normalizeName(hostname)
      const keyN = normalizeName(existing.key || '')

      if (curN && curN === hostN) {
        status = 'same'
        selected = false
      } else if (!curN || curN === keyN) {
        status = 'fill'
        selected = true
      } else {
        status = overwriteExisting.value ? 'overwrite' : 'skip'
        selected = overwriteExisting.value
      }
    }

    out.push({
      ip,
      hostname,
      mac: v.mac,
      source: v.source,
      status,
      selected,
      currentLabel: currentLabel ? `${t('user')}: ${currentLabel}` : '',
    } as any)
  }

  out.sort((a, b) => {
    const ah = normalizeName(a.hostname)
    const bh = normalizeName(b.hostname)
    if (ah && bh && ah !== bh) return ah.localeCompare(bh)
    return a.ip.localeCompare(b.ip)
  })

  importItems.value = out
}

watch(overwriteExisting, () => {
  // Recompute statuses for items with existing custom labels.
  importItems.value = importItems.value.map((it) => {
    if (it.status === 'skip' || it.status === 'overwrite') {
      const existing = sourceIPLabelList.value.find((x) => String(x.key || '').trim() === it.ip) || null
      const currentLabel = existing ? String(existing.label || '').trim() : ''
      const curN = normalizeName(currentLabel)
      const hostN = normalizeName(it.hostname)
      const keyN = existing ? normalizeName(existing.key || '') : ''

      if (!existing) return { ...it, status: 'add', selected: true }
      if (curN && curN === hostN) return { ...it, status: 'same', selected: false }
      if (!curN || curN === keyN) return { ...it, status: 'fill', selected: true }
      return overwriteExisting.value
        ? { ...it, status: 'overwrite', selected: true }
        : { ...it, status: 'skip', selected: false }
    }
    return it
  })
})

const selectedCount = computed(() => importItems.value.filter((x) => x.selected).length)

const statusText = (s: ImportItem['status']) => {
  switch (s) {
    case 'add':
      return t('importLanHostsStatusAdd')
    case 'fill':
      return t('importLanHostsStatusFill')
    case 'overwrite':
      return t('importLanHostsStatusOverwrite')
    case 'skip':
      return t('importLanHostsStatusSkip')
    case 'same':
      return t('importLanHostsStatusSame')
    default:
      return '—'
  }
}

const closeImportPanel = () => {
  collapseGroupMap.value[IMPORT_COLLAPSE_NAME] = false
}

const openImportPanel = async () => {
  collapseGroupMap.value[IMPORT_COLLAPSE_NAME] = true

  await fetchImportItems()
}

const toggleImportPanel = async () => {
  const isOpen = !!collapseGroupMap.value[IMPORT_COLLAPSE_NAME]
  if (isOpen) {
    closeImportPanel()
    return
  }

  await openImportPanel()
}

watch(
  () => !!collapseGroupMap.value[IMPORT_COLLAPSE_NAME],
  (open) => {
    if (open && !importItems.value.length && !importLoading.value && !importError.value) {
      void fetchImportItems()
    }
  },
)

const applyImport = () => {
  let added = 0
  let updated = 0

  for (const it of importItems.value) {
    if (!it.selected) continue
    if (!it.hostname) continue

    const existing = sourceIPLabelList.value.find((x) => String(x.key || '').trim() === it.ip) || null
    if (!existing) {
      sourceIPLabelList.value.push({ id: uuid(), key: it.ip, label: it.hostname })
      added++
      continue
    }

    const cur = String(existing.label || '').trim()
    const curN = normalizeName(cur)
    const keyN = normalizeName(existing.key || '')
    const hostN = normalizeName(it.hostname)

    if (curN && curN === hostN) continue

    if (overwriteExisting.value || !curN || curN === keyN) {
      existing.label = it.hostname
      updated++
    }
  }

  showNotification({
    content: 'importLanHostsDone',
    params: { added: String(added), updated: String(updated) },
    type: 'alert-success',
  })

  closeImportPanel()
}
</script>
