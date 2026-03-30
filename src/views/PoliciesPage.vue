<template>
  <div class="flex h-full flex-col gap-2 overflow-x-hidden overflow-y-auto p-2">
    <div class="card gap-2 p-3">
      <div class="flex items-center justify-between gap-2">
        <div class="font-semibold">{{ $t('limitProfiles') }}</div>
        <div class="flex items-center gap-2">
          <button type="button" class="btn btn-sm" @click="addProfile">{{ $t('add') }}</button>
          <button type="button" class="btn btn-sm btn-ghost" @click="resetDefaults">{{ $t('resetToDefaults') }}</button>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div class="overflow-x-auto">
          <table class="table table-sm">
            <thead>
              <tr>
                <th>{{ $t('name') }}</th>
                <th class="text-right">{{ $t('trafficLimit') }}</th>
                <th class="text-right">{{ $t('bandwidthLimit') }}</th>
                <th class="text-right">{{ $t('status') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="p in profiles"
                :key="p.id"
                class="cursor-pointer"
                :class="selectedId === p.id ? 'bg-base-200/70' : ''"
                @click="selectProfile(p.id)"
              >
                <td class="font-medium">
                  <span class="truncate inline-block max-w-[280px]" :title="p.name">{{ p.name }}</span>
                </td>
                <td class="text-right font-mono whitespace-nowrap">
                  <span v-if="p.trafficLimitBytes && p.trafficLimitBytes > 0">
                    {{ fmtBytes(p.trafficLimitBytes) }} / {{ p.trafficPeriod || '30d' }}
                  </span>
                  <span v-else class="opacity-60">—</span>
                </td>
                <td class="text-right font-mono whitespace-nowrap">
                  <span v-if="p.bandwidthLimitBps && p.bandwidthLimitBps > 0">{{ fmtMbps(p.bandwidthLimitBps) }}</span>
                  <span v-else class="opacity-60">—</span>
                </td>
                <td class="text-right">
                  <span v-if="p.enabled" class="badge badge-success">ON</span>
                  <span v-else class="badge">OFF</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="rounded-lg border border-base-content/10 bg-base-200/30 p-3">
          <div v-if="!selected" class="text-sm opacity-70">{{ $t('selectProfileToEdit') }}</div>
          <div v-else class="flex flex-col gap-2">
            <div class="flex items-center justify-between gap-2">
              <div class="text-sm font-semibold">{{ $t('edit') }}</div>
              <button
                type="button"
                class="btn btn-sm btn-ghost"
                @click="deleteProfile"
                :disabled="selectedId === 'unlimited'"
                :title="selectedId === 'unlimited' ? $t('cannotDeleteDefault') : ''"
              >
                {{ $t('delete') }}
              </button>
            </div>

            <label class="flex flex-col gap-1">
              <span class="text-sm opacity-70">{{ $t('name') }}</span>
              <input class="input input-sm" v-model="draft.name" />
            </label>

            <div class="flex items-center justify-between gap-2">
              <div class="text-sm opacity-70">{{ $t('enabled') }}</div>
              <input type="checkbox" class="toggle toggle-sm" v-model="draft.enabled" />
            </div>

            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label class="flex flex-col gap-1">
                <span class="text-sm opacity-70">{{ $t('trafficLimit') }}</span>
                <div class="flex items-center gap-2">
                  <input class="input input-sm flex-1" type="number" min="0" step="0.1" v-model.number="draft.trafficValue" />
                  <select class="select select-sm w-20" v-model="draft.trafficUnit">
                    <option value="GB">GB</option>
                    <option value="MB">MB</option>
                  </select>
                </div>
              </label>

              <label class="flex flex-col gap-1">
                <span class="text-sm opacity-70">{{ $t('period') }}</span>
                <select class="select select-sm" v-model="draft.trafficPeriod">
                  <option value="1d">{{ $t('last24h') }}</option>
                  <option value="30d">{{ $t('last30d') }}</option>
                  <option value="month">{{ $t('thisMonth') }}</option>
                </select>
              </label>
            </div>

            <label class="flex flex-col gap-1">
              <span class="text-sm opacity-70">{{ $t('bandwidthLimit') }} (Mbps)</span>
              <input class="input input-sm" type="number" min="0" step="0.1" v-model.number="draft.bandwidthMbps" />
            </label>

            <div class="flex items-center justify-end gap-2">
              <button type="button" class="btn btn-sm" @click="revertDraft">{{ $t('revert') }}</button>
              <button type="button" class="btn btn-primary btn-sm" @click="saveDraft">{{ $t('save') }}</button>
            </div>
          </div>
        </div>
      </div>

      <div class="text-xs opacity-70">
        {{ $t('profilesTip') }}
      </div>
    </div>

    <div class="card gap-2 p-3">
      <div class="flex items-center justify-between gap-2">
        <div class="font-semibold">{{ $t('snapshots') }}</div>
        <div class="flex items-center gap-2">
          <button type="button" class="btn btn-sm" @click="createSnapshot">{{ $t('createSnapshot') }}</button>
          <button type="button" class="btn btn-sm btn-ghost" @click="clearSnapshots" :disabled="!snapshots.length">{{ $t('clear') }}</button>
        </div>
      </div>

      <div v-if="!snapshots.length" class="text-sm opacity-70">{{ $t('noSnapshotsYet') }}</div>

      <div v-else class="overflow-x-auto">
        <table class="table table-sm">
          <thead>
            <tr>
              <th style="width: 170px">{{ $t('time') }}</th>
              <th>{{ $t('label') }}</th>
              <th style="width: 120px" class="text-right">{{ $t('actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in snapshotsSorted" :key="s.id">
              <td class="font-mono text-xs">{{ fmtTime(s.createdAt) }}</td>
              <td class="text-sm">{{ s.label }}</td>
              <td class="text-right">
                <button type="button" class="btn btn-xs" @click="restore(s.id)">{{ $t('restore') }}</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card gap-2 p-3">
      <div class="flex items-center justify-between gap-2">
        <div class="font-semibold">{{ $t('exportImport') }}</div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="btn btn-sm" @click="exportBundle">{{ $t('export') }}</button>
        <input ref="fileInput" type="file" accept="application/json" class="file-input file-input-sm" @change="onPickFile" />
        <button type="button" class="btn btn-sm" @click="importBundle('merge')" :disabled="!pickedRaw">{{ $t('importMerge') }}</button>
        <button type="button" class="btn btn-sm btn-warning" @click="importBundle('replace')" :disabled="!pickedRaw">{{ $t('importReplace') }}</button>
      </div>

      <div class="text-xs opacity-70">
        {{ $t('exportImportTip') }}
      </div>
    </div>

    <div class="flex-1"></div>
  </div>
</template>

<script setup lang="ts">
import { prettyBytesHelper } from '@/helper/utils'
import { showNotification } from '@/helper/notification'
import { userLimitProfiles, DEFAULT_LIMIT_PROFILES, type UserLimitProfile } from '@/store/userLimitProfiles'
import { userLimitSnapshots } from '@/store/userLimitSnapshots'
import { createSnapshotNow, exportLimitsBundle, importLimitsBundle, resetProfilesToDefault, restoreSnapshot } from '@/composables/userLimitProfiles'
import dayjs from 'dayjs'
import { computed, ref, watch } from 'vue'

const profiles = computed(() => userLimitProfiles.value || [])
const snapshots = computed(() => userLimitSnapshots.value || [])
const snapshotsSorted = computed(() => [...snapshots.value].sort((a, b) => b.createdAt - a.createdAt))

const selectedId = ref<string>('unlimited')
const selected = computed(() => profiles.value.find((p) => p.id === selectedId.value) || null)

const draft = ref({
  name: '',
  enabled: true,
  trafficValue: 0,
  trafficUnit: 'GB' as 'GB' | 'MB',
  trafficPeriod: '30d' as any,
  bandwidthMbps: 0,
})

const loadDraft = (p: UserLimitProfile | null) => {
  if (!p) return
  draft.value.name = p.name
  draft.value.enabled = !!p.enabled
  draft.value.trafficUnit = (p.trafficLimitUnit || 'GB') as any
  draft.value.trafficPeriod = (p.trafficPeriod || '30d') as any
  // show value in chosen unit
  const b = p.trafficLimitBytes || 0
  if (!b) draft.value.trafficValue = 0
  else if (draft.value.trafficUnit === 'GB') draft.value.trafficValue = +(b / (1024 ** 3)).toFixed(2)
  else draft.value.trafficValue = +(b / (1024 ** 2)).toFixed(1)

  const bl = p.bandwidthLimitBps || 0
  draft.value.bandwidthMbps = bl ? +((bl * 8) / (1024 ** 2)).toFixed(1) : 0
}

watch(selected, () => loadDraft(selected.value), { immediate: true })

const selectProfile = (id: string) => {
  selectedId.value = id
}

const fmtBytes = (b: number) => prettyBytesHelper(b)
const fmtMbps = (bps: number) => `${((bps * 8) / (1024 ** 2)).toFixed(1)} Mbps`
const fmtTime = (ts: number) => dayjs(ts).format('YYYY-MM-DD HH:mm:ss')

const revertDraft = () => loadDraft(selected.value)

const saveDraft = () => {
  const p = selected.value
  if (!p) return

  const trafficBytes = (() => {
    const v = Number(draft.value.trafficValue || 0)
    if (!Number.isFinite(v) || v <= 0) return 0
    if (draft.value.trafficUnit === 'GB') return Math.round(v * (1024 ** 3))
    return Math.round(v * (1024 ** 2))
  })()

  const bandwidthBps = (() => {
    const v = Number(draft.value.bandwidthMbps || 0)
    if (!Number.isFinite(v) || v <= 0) return 0
    return Math.round((v * 1024 * 1024) / 8)
  })()

  const next: UserLimitProfile = {
    ...p,
    name: (draft.value.name || '').trim() || p.name,
    enabled: !!draft.value.enabled,
    trafficLimitBytes: trafficBytes,
    trafficLimitUnit: draft.value.trafficUnit,
    trafficPeriod: draft.value.trafficPeriod,
    bandwidthLimitBps: bandwidthBps,
  }

  userLimitProfiles.value = profiles.value.map((x) => (x.id === p.id ? next : x))
  showNotification({ content: 'saved', type: 'alert-success', timeout: 1400 })
}

const addProfile = () => {
  const id = `p_${Math.random().toString(16).slice(2, 8)}`
  const p: UserLimitProfile = {
    id,
    name: 'New profile',
    enabled: true,
    trafficLimitBytes: 0,
    trafficLimitUnit: 'GB',
    trafficPeriod: '30d',
    bandwidthLimitBps: 0,
  }
  userLimitProfiles.value = [...profiles.value, p]
  selectedId.value = id
}

const deleteProfile = () => {
  const p = selected.value
  if (!p) return
  if (p.id === 'unlimited') return
  userLimitProfiles.value = profiles.value.filter((x) => x.id !== p.id)
  selectedId.value = 'unlimited'
}

const resetDefaults = () => {
  resetProfilesToDefault()
  selectedId.value = 'unlimited'
  showNotification({ content: 'resetToDefaults', type: 'alert-success', timeout: 1600 })
}

const createSnapshot = () => {
  createSnapshotNow('Manual snapshot')
  showNotification({ content: 'snapshotCreated', type: 'alert-success', timeout: 1500 })
}

const restore = async (id: string) => {
  await restoreSnapshot(id)
  showNotification({ content: 'operationDone', type: 'alert-success', timeout: 1500 })
}

const clearSnapshots = () => {
  userLimitSnapshots.value = []
}

// Export / import
const exportBundle = () => exportLimitsBundle()

const pickedRaw = ref<any>(null)
const fileInput = ref<HTMLInputElement | null>(null)

const onPickFile = async () => {
  const f = fileInput.value?.files?.[0]
  if (!f) {
    pickedRaw.value = null
    return
  }
  try {
    const text = await f.text()
    pickedRaw.value = JSON.parse(text)
    showNotification({ content: 'fileLoaded', type: 'alert-success', timeout: 1200 })
  } catch {
    pickedRaw.value = null
    showNotification({ content: 'invalidFile', type: 'alert-error', timeout: 2000 })
  }
}

const importBundle = async (mode: 'merge' | 'replace') => {
  if (!pickedRaw.value) return
  try {
    await importLimitsBundle(pickedRaw.value, mode)
    showNotification({ content: 'operationDone', type: 'alert-success', timeout: 1600 })
  } catch {
    showNotification({ content: 'operationFailed', type: 'alert-error', timeout: 2200 })
  }
}
</script>
