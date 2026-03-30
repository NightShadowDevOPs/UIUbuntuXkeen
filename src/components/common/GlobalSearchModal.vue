<template>
  <DialogWrapper v-model="globalSearchOpen" :no-padding="true">
    <div class="p-3">
      <div class="flex items-center gap-2">
        <MagnifyingGlassIcon class="h-5 w-5 opacity-70" />
        <input
          ref="inputRef"
          v-model="q"
          type="text"
          class="input input-sm w-full"
          :placeholder="$t('globalSearchPlaceholder')"
          @keydown="handleKeydown"
        />
      </div>
      <div class="mt-2 text-xs opacity-60">
        <span>{{ $t('globalSearchHint') }}</span>
      </div>
    </div>

    <div class="max-h-[60dvh] overflow-y-auto px-2 pb-2">
      <div v-if="!flatResults.length" class="p-3 text-sm opacity-70">
        {{ q.trim() ? $t('noResults') : $t('startTypingToSearch') }}
      </div>

      <template v-else>
        <div
          v-for="(group, gi) in groupedResults"
          :key="group.key"
          class="mb-2"
        >
          <div class="px-2 py-1 text-[11px] font-semibold uppercase opacity-60">
            {{ group.title }}
            <span class="ml-1 opacity-60">({{ group.items.length }})</span>
          </div>
          <div class="flex flex-col gap-1">
            <div
              v-for="(it, ii) in group.items"
              :key="it.key"
              class="flex gap-1"
              :class="isSelected(group.offset + ii) ? 'bg-base-200 ring-1 ring-base-300 rounded-xl' : ''"
              @mouseenter="selectedIdx = group.offset + ii"
            >
              <button
                type="button"
                class="btn btn-ghost btn-sm justify-start h-auto flex-1 rounded-xl px-2 py-2 text-left"
                @click="openItem(it)"
              >
                <div class="min-w-0">
                  <div class="flex items-center gap-2 min-w-0">
                    <component :is="it.icon" class="h-4 w-4 shrink-0 opacity-70" />
                    <div class="min-w-0">
                      <div class="truncate font-medium">{{ it.title }}</div>
                      <div v-if="it.subtitle" class="truncate text-xs opacity-60">{{ it.subtitle }}</div>
                    </div>
                  </div>
                </div>
              </button>

              <TopologyActionButtons
                :stage="stageForItem(it)"
                :value="String(it.focusValue || '').trim()"
                :grouped="true"
                @beforeNavigate="closeSearch"
              />
            </div>
          </div>
        </div>
      </template>
    </div>
  </DialogWrapper>
</template>

<script setup lang="ts">
import DialogWrapper from '@/components/common/DialogWrapper.vue'
import TopologyActionButtons from '@/components/common/TopologyActionButtons.vue'
import { ROUTE_NAME } from '@/constant'
import { isProxyGroup } from '@/helper'
import { navigateToTopology } from '@/helper/topologyNav'
import { setPendingPageFocus } from '@/helper/navFocus'
import router from '@/router'
import { proxyGroupList, proxyMap, proxyProviederList } from '@/store/proxies'
import { rules } from '@/store/rules'
import { sourceIPLabelList } from '@/store/settings'
import { globalSearchOpen } from '@/store/globalSearch'
import type { Proxy, Rule, SourceIPLabel } from '@/types'
import {
  MagnifyingGlassIcon,
  ServerStackIcon,
  Squares2X2Icon,
  CircleStackIcon,
  AdjustmentsHorizontalIcon,
  UsersIcon
} from '@heroicons/vue/24/outline'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

type SearchItem = {
  key: string
  group: 'providers' | 'proxyGroups' | 'proxies' | 'rules' | 'users'
  title: string
  subtitle?: string
  icon: any
  routeName: string
  focusKind: string
  focusValue: string
}


const q = ref('')
const selectedIdx = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)
const { t } = useI18n()

const normalize = (s: string) => String(s || '').toLowerCase()
const terms = computed(() =>
  q.value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean),
)

const matchAll = (text: string, ts: string[]) => {
  if (!ts.length) return true
  const t = normalize(text)
  return ts.every((x) => t.includes(x))
}

const providerItems = computed<SearchItem[]>(() => {
  const ts = terms.value
  const providers = (proxyProviederList.value || []) as any[]
  const out: SearchItem[] = []
  for (const p of providers) {
    const name = String(p?.name || '').trim()
    if (!name) continue
    if (!matchAll(name, ts)) continue
    out.push({
      key: `provider:${name}`,
      group: 'providers',
      title: name,
      subtitle: t('globalSearchItemProxyProvider'),
      icon: ServerStackIcon,
      routeName: ROUTE_NAME.proxyProviders,
      focusKind: 'provider',
      focusValue: name,
    })
    if (out.length >= 30) break
  }
  return out
})

const proxyGroupItems = computed<SearchItem[]>(() => {
  const ts = terms.value
  const out: SearchItem[] = []
  for (const name of proxyGroupList.value || []) {
    const n = String(name || '').trim()
    if (!n) continue
    if (!matchAll(n, ts)) continue
    out.push({
      key: `proxyGroup:${n}`,
      group: 'proxyGroups',
      title: n,
      subtitle: t('globalSearchItemProxyGroup'),
      icon: Squares2X2Icon,
      routeName: ROUTE_NAME.proxies,
      focusKind: 'proxyGroup',
      focusValue: n,
    })
    if (out.length >= 40) break
  }
  return out
})

const proxyNodeItems = computed<SearchItem[]>(() => {
  const ts = terms.value
  const out: SearchItem[] = []
  const entries = Object.entries(proxyMap.value || {}) as [string, Proxy][]

  for (const [name, proxy] of entries) {
    const n = String(name || '').trim()
    if (!n) continue
    // Skip groups; we render groups separately.
    if (proxy && isProxyGroup(proxy as any)) continue
    if (!matchAll(n, ts)) continue

    out.push({
      key: `proxy:${n}`,
      group: 'proxies',
      title: n,
      subtitle: String((proxy as any)?.type || t('globalSearchItemProxy')),
      icon: CircleStackIcon,
      routeName: ROUTE_NAME.proxies,
      focusKind: 'proxy',
      focusValue: n,
    })
    if (out.length >= 50) break
  }
  return out
})

const ruleItems = computed<SearchItem[]>(() => {
  const ts = terms.value
  const out: SearchItem[] = []
  for (const r of (rules.value || []) as Rule[]) {
    const type = String((r as any)?.type || '').trim()
    const payload = String((r as any)?.payload || '').trim()
    const proxy = String((r as any)?.proxy || '').trim()
    const title = payload ? `${type}: ${payload}` : type
    const hay = `${type} ${payload} ${proxy}`
    if (!matchAll(hay, ts)) continue
    out.push({
      key: `rule:${type}:${payload}`,
      group: 'rules',
      title,
      subtitle: proxy ? `→ ${proxy}` : undefined,
      icon: AdjustmentsHorizontalIcon,
      routeName: ROUTE_NAME.rules,
      focusKind: 'rule',
      focusValue: title,
    })
    if (out.length >= 60) break
  }
  return out
})

const userItems = computed<SearchItem[]>(() => {
  const ts = terms.value
  const out: SearchItem[] = []
  for (const u of (sourceIPLabelList.value || []) as SourceIPLabel[]) {
    const ip = String((u as any)?.key || '').trim()
    const label = String((u as any)?.label || '').trim()
    const scope = String((u as any)?.scope || '').trim()
    const title = label ? `${label}` : ip
    const subtitle = label ? `${ip}${scope ? ` • ${scope}` : ''}` : (scope ? scope : undefined)
    const hay = `${ip} ${label} ${scope}`
    if (!matchAll(hay, ts)) continue
    if (!ip) continue
    out.push({
      key: `user:${ip}`,
      group: 'users',
      title,
      subtitle,
      icon: UsersIcon,
      routeName: ROUTE_NAME.users,
      focusKind: 'user',
      focusValue: ip,
    })
    if (out.length >= 50) break
  }
  return out
})

const groupedResults = computed(() => {
  const groups: Array<{ key: string; title: string; items: SearchItem[]; offset: number }> = []
  const add = (key: string, title: string, items: SearchItem[], offset: number) => {
    if (!items.length) return offset
    groups.push({ key, title, items, offset })
    return offset + items.length
  }

  let offset = 0
  offset = add('providers', t('globalSearchGroupProviders'), providerItems.value, offset)
  offset = add('proxyGroups', t('globalSearchGroupProxyGroups'), proxyGroupItems.value, offset)
  offset = add('proxies', t('globalSearchGroupProxies'), proxyNodeItems.value, offset)
  offset = add('rules', t('globalSearchGroupRules'), ruleItems.value, offset)
  offset = add('users', t('globalSearchGroupUsers'), userItems.value, offset)
  return groups
})

const flatResults = computed(() => {
  const out: SearchItem[] = []
  for (const g of groupedResults.value) out.push(...g.items)
  return out
})

const closeSearch = () => {
  globalSearchOpen.value = false
}

const isSelected = (idx: number) => idx === selectedIdx.value

const openItem = async (it: SearchItem) => {
  globalSearchOpen.value = false
  // Set focus *before* navigation so the destination page can pick it up.
  setPendingPageFocus(it.routeName, it.focusKind, it.focusValue)
  await router.push({ name: it.routeName })
}

const stageForItem = (it: SearchItem): 'C' | 'R' | 'G' | 'S' | 'P' => {
  if (it.group === 'providers') return 'P'
  if (it.group === 'proxyGroups') return 'G'
  if (it.group === 'rules') return 'R'
  if (it.group === 'users') return 'C'
  return 'S'
}

const openItemInTopology = async (it: SearchItem) => {
  closeSearch()
  const stage = stageForItem(it)
  await navigateToTopology(router as any, { stage, value: String(it.focusValue || '').trim() }, 'only')
}

const clampSelection = () => {
  const len = flatResults.value.length
  if (len <= 0) {
    selectedIdx.value = 0
    return
  }
  if (selectedIdx.value < 0) selectedIdx.value = 0
  if (selectedIdx.value >= len) selectedIdx.value = len - 1
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedIdx.value += 1
    clampSelection()
    return
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedIdx.value -= 1
    clampSelection()
    return
  }
  if (e.key === 'Enter') {
    const it = flatResults.value[selectedIdx.value]
    if (it) {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        openItemInTopology(it)
      } else {
        openItem(it)
      }
    }
    return
  }
}

watch(
  globalSearchOpen,
  async (open) => {
    if (!open) {
      q.value = ''
      selectedIdx.value = 0
      return
    }
    await nextTick()
    inputRef.value?.focus()
  },
  { immediate: true },
)

watch([q, flatResults], () => {
  selectedIdx.value = 0
  clampSelection()
})

// Allow closing the dialog by clicking outside or pressing Escape (native <dialog> handles Escape).
// We still keep a safety handler for when focus is inside elements.
const escHandler = (e: KeyboardEvent) => {
  if (!globalSearchOpen.value) return
  if (e.key === 'Escape') {
    globalSearchOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('keydown', escHandler)
})

onUnmounted(() => {
  document.removeEventListener('keydown', escHandler)
})
</script>
