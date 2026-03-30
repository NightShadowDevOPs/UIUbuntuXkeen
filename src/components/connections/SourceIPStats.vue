<template>
  <div class="card p-2">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <span class="font-medium">{{ $t('allSourceIP') }}</span>
        <span class="opacity-60 text-sm">({{ stats.length }})</span>

        <span
          v-if="selectedCount"
          class="badge badge-primary badge-sm"
        >
          {{ selectedCount }}
        </span>
      </div>

      <div class="flex items-center gap-2">
        <TextInput
          v-model="search"
          class="w-40"
          :placeholder="$t('search')"
          :clearable="true"
        />
        <button
          v-if="sourceIPFilter !== null"
          class="btn btn-sm"
          @click="clearSelection"
        >
          {{ $t('reset') }}
        </button>
      </div>
    </div>

    <div
      v-if="filteredStats.length"
      class="mt-2 flex flex-wrap gap-2"
    >
      <div
        v-for="item in filteredStats"
        :key="item.ip"
        class="rounded-field flex cursor-pointer items-center gap-2 px-2 py-1 text-xs transition"
        :class="isSelected(item.ip) ? 'bg-primary text-primary-content' : 'bg-base-200 hover:bg-base-300'"
        @click="toggle(item.ip)"
        :title="item.ip"
      >
        <span class="max-w-40 truncate">
          {{ item.display }}
        </span>

        <span v-if="item.kindBadge" class="badge badge-xs badge-ghost">
          {{ item.kindBadge }}
        </span>

        <span class="opacity-70">
          {{ item.count }}
        </span>

        <span class="opacity-80 font-mono">
          ↓ {{ prettyBytesHelper(item.dlSpeed) }}/s
        </span>

        <span class="opacity-80 font-mono">
          ↑ {{ prettyBytesHelper(item.ulSpeed) }}/s
        </span>
      </div>
    </div>

    <div
      v-else
      class="mt-2 text-sm opacity-60"
    >
      {{ $t('noContent') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { getIPLabelFromMap, getPrimarySourceIpRule, type SourceIpRuleKind } from '@/helper/sourceip'
import { prettyBytesHelper } from '@/helper/utils'
import { connections, sourceIPFilter } from '@/store/connections'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import TextInput from '../common/TextInput.vue'

type StatItem = {
  ip: string
  count: number
  dlSpeed: number
  ulSpeed: number
  display: string
  kindBadge: string
}

const { t } = useI18n()
const search = ref('')

const ruleKindBadge = (kind?: SourceIpRuleKind | null) => {
  if (!kind) return ''
  if (kind === 'cidr') return t('sourceIpRuleKindCidr')
  if (kind === 'regex') return t('sourceIpRuleKindRegex')
  if (kind === 'suffix') return t('sourceIpRuleKindSuffix')
  return t('sourceIpRuleKindExact')
}

const stats = computed<StatItem[]>(() => {
  const map = new Map<string, Omit<StatItem, 'display' | 'kindBadge'>>()

  for (const c of connections.value) {
    const ip = c.metadata.sourceIP || ''
    if (!ip) continue

    const prev = map.get(ip) || { ip, count: 0, dlSpeed: 0, ulSpeed: 0 }
    prev.count += 1
    prev.dlSpeed += c.downloadSpeed || 0
    prev.ulSpeed += c.uploadSpeed || 0
    map.set(ip, prev)
  }

  const list = Array.from(map.values())
    .sort((a, b) => (b.dlSpeed + b.ulSpeed) - (a.dlSpeed + a.ulSpeed))
    .slice(0, 60)
    .map((x) => {
      const label = String(getIPLabelFromMap(x.ip) || '').trim()
      const primaryRule = getPrimarySourceIpRule(x.ip)
      const display = label && label !== x.ip ? `${label} (${x.ip})` : x.ip
      return {
        ...x,
        display,
        kindBadge: label && label !== x.ip ? ruleKindBadge(primaryRule?.kind) : '',
      }
    })

  return list
})

const selectedCount = computed(() => sourceIPFilter.value?.length || 0)

const isSelected = (ip: string) => {
  return Array.isArray(sourceIPFilter.value) && sourceIPFilter.value.includes(ip)
}

const toggle = (ip: string) => {
  const cur = sourceIPFilter.value
  if (cur === null) {
    sourceIPFilter.value = [ip]
    return
  }

  const next = cur.includes(ip) ? cur.filter((x) => x !== ip) : [...cur, ip]
  sourceIPFilter.value = next.length ? next : null
}

const clearSelection = () => {
  sourceIPFilter.value = null
}

const filteredStats = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return stats.value
  return stats.value.filter((x) => x.display.toLowerCase().includes(q) || x.ip.includes(q))
})
</script>