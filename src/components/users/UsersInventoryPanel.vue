<template>
  <div class="card gap-3 p-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <div class="font-semibold">Контроль пользователей LAN / proxy</div>
        <div class="text-xs opacity-70">IP, MAC, обнаруженное имя хоста и индивидуальный доступ к proxy. Данные хранятся в общей БД.</div>
      </div>
      <div class="flex items-center gap-2">
        <select v-model="proxyAccessPolicyMode" class="select select-bordered select-sm">
          <option value="allowAll">Разрешить всем</option>
          <option value="allowListOnly">Только разрешённым</option>
        </select>
        <button type="button" class="btn btn-sm" @click="refreshNow" :disabled="busy">
          <span v-if="busy" class="loading loading-spinner loading-xs"></span>
          <span v-else>Обновить LAN</span>
        </button>
        <button type="button" class="btn btn-sm btn-primary" @click="applyNow" :disabled="busy">Применить доступ</button>
      </div>
    </div>

    <div class="flex flex-wrap gap-2 text-[11px]">
      <span class="badge badge-ghost badge-sm">Режим: {{ proxyAccessPolicyMode === 'allowListOnly' ? 'allow-list only' : 'allow all' }}</span>
      <span class="badge badge-ghost badge-sm">Хосты в БД: {{ rows.length }}</span>
      <span v-if="proxyAccessLastScanAt" class="badge badge-ghost badge-sm">LAN: {{ fmtTs(proxyAccessLastScanAt) }}</span>
      <span v-if="proxyAccessLastApplyAt" class="badge badge-ghost badge-sm">Применено: {{ fmtTs(proxyAccessLastApplyAt) }}</span>
      <span v-if="proxyAccessLastError" class="badge badge-error badge-sm">{{ proxyAccessLastError }}</span>
    </div>

    <div class="overflow-x-auto">
      <table class="table table-zebra table-sm">
        <thead>
          <tr>
            <th class="w-[220px]">Имя хоста</th>
            <th class="w-[150px]">IP</th>
            <th class="w-[170px]">MAC</th>
            <th>Обнаружено</th>
            <th class="w-[110px]">Источник</th>
            <th class="w-[140px]">Доступ к proxy</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id">
            <td>
              <input
                class="input input-bordered input-xs w-full"
                :value="row.label"
                @input="setLabel(row.id, ($event.target as HTMLInputElement).value)"
                placeholder="Имя хоста"
              />
            </td>
            <td class="font-mono text-xs">{{ row.key }}</td>
            <td class="font-mono text-xs">{{ row.mac || '—' }}</td>
            <td class="text-xs">{{ row.hostname || '—' }}</td>
            <td class="text-xs">{{ row.source || '—' }}</td>
            <td>
              <label class="label cursor-pointer justify-start gap-2">
                <input
                  type="checkbox"
                  class="checkbox checkbox-sm"
                  :checked="row.proxyAccess === true"
                  @change="setProxyAccess(row.id, ($event.target as HTMLInputElement).checked)"
                />
                <span class="label-text text-xs">{{ row.proxyAccess === true ? 'Разрешён' : 'Запрещён' }}</span>
              </label>
            </td>
          </tr>
          <tr v-if="!rows.length">
            <td colspan="6" class="text-sm opacity-70">Пока нет сохранённых хостов. Нажмите «Обновить LAN».</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'
import { computed, ref } from 'vue'
import { sourceIPLabelList } from '@/store/settings'
import { proxyAccessPolicyMode } from '@/store/proxyAccess'
import { applyProxyAccessControlNow, proxyAccessLastApplyAt, proxyAccessLastError, proxyAccessLastScanAt, refreshProxyAccessKnownHosts } from '@/composables/proxyAccessControl'
import type { SourceIPLabel } from '@/types'

const busy = ref(false)

const rows = computed(() => {
  return [...(sourceIPLabelList.value || [])]
    .filter((item) => {
      const key = String((item as any)?.key || '').trim()
      return !!key && !key.startsWith('/') && !key.includes('/')
    })
    .sort((a, b) => {
      const an = String((a as any)?.label || (a as any)?.hostname || (a as any)?.key || '').trim().toLowerCase()
      const bn = String((b as any)?.label || (b as any)?.hostname || (b as any)?.key || '').trim().toLowerCase()
      if (an !== bn) return an.localeCompare(bn)
      return String((a as any)?.key || '').localeCompare(String((b as any)?.key || ''))
    }) as SourceIPLabel[]
})

const mutateItem = (id: string, patch: Partial<SourceIPLabel>) => {
  const next = [...(sourceIPLabelList.value || [])]
  const idx = next.findIndex((item) => String((item as any)?.id || '') === String(id || ''))
  if (idx < 0) return
  next[idx] = {
    ...next[idx],
    ...patch,
  }
  sourceIPLabelList.value = next as any
}

const setLabel = (id: string, value: string) => {
  mutateItem(id, { label: String(value || '').trim() || '—' })
}

const setProxyAccess = (id: string, value: boolean) => {
  mutateItem(id, { proxyAccess: value })
}

const refreshNow = async () => {
  busy.value = true
  try {
    await refreshProxyAccessKnownHosts(true)
  } finally {
    busy.value = false
  }
}

const applyNow = async () => {
  busy.value = true
  try {
    await refreshProxyAccessKnownHosts(true)
    await applyProxyAccessControlNow()
  } finally {
    busy.value = false
  }
}

const fmtTs = (value: number) => {
  if (!value) return '—'
  return dayjs(value).format('DD.MM HH:mm')
}
</script>
