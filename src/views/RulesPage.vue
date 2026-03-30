<template>
  <div
    class="flex flex-col gap-1"
    :class="[
      rulesViewMode === 'table' ? 'overflow-x-visible' : 'overflow-x-hidden',
      rulesViewMode !== 'table' && renderRules.length < 200 ? 'p-2' : '',
    ]"
  >
    <template v-if="rulesTabShow === RULE_TAB_TYPE.PROVIDER">
      <RuleProvider
        v-for="(ruleProvider, index) in renderRulesProvider"
        :key="ruleProvider.name"
        :ruleProvider="ruleProvider"
        :index="index + 1"
      />
    </template>
    <template v-else-if="rulesViewMode === 'table'">
      <RulesTable
        ref="vsRef"
        :rules="renderRules"
      />
    </template>
    <template v-else-if="renderRules.length < 200">
      <RuleCard
        v-for="rule in renderRules"
        :key="rule.payload"
        :rule="rule"
        :index="rules.indexOf(rule) + 1"
      />
    </template>
    <VirtualScroller
      v-else
      ref="vsRef"
      :data="renderRules"
      :size="64"
      class="p-2"
    >
      <template v-slot="{ item: rule }: { item: Rule }">
        <RuleCard
          class="mb-1"
          :key="rule.payload"
          :rule="rule"
          :index="rules.indexOf(rule) + 1"
        />
      </template>
    </VirtualScroller>
  </div>
</template>

<script setup lang="ts">
import VirtualScroller from '@/components/common/VirtualScroller.vue'
import RuleCard from '@/components/rules/RuleCard.vue'
import RulesTable from '@/components/rules/RulesTable.vue'
import RuleProvider from '@/components/rules/RuleProvider.vue'
import { RULE_TAB_TYPE } from '@/constant'
import { ROUTE_NAME } from '@/constant'
import { cleanupExpiredPendingPageFocus, clearPendingPageFocus, flashNavHighlight, getPendingPageFocusForRoute } from '@/helper/navFocus'
import { fetchRules, renderRules, renderRulesProvider, rules, rulesTabShow, rulesViewMode } from '@/store/rules'
import type { Rule } from '@/types'
import { nextTick, onMounted, ref, watch } from 'vue'

const vsRef = ref<any>(null)

const parseRuleText = (s: string) => {
  const v = String(s || '').trim()
  const i = v.indexOf(': ')
  if (i <= 0) return { type: v, payload: '' }
  return { type: v.slice(0, i).trim(), payload: v.slice(i + 2).trim() }
}

const findRuleCardEl = (type: string, payload: string) => {
  const items = Array.from(document.querySelectorAll('[data-nav-kind="rule"]')) as HTMLElement[]
  return (
    items.find((el) => {
      const dt = String((el as any).dataset?.ruleType || '').trim()
      const dp = String((el as any).dataset?.rulePayload || '').trim()
      return dt === type && dp === payload
    }) || null
  )
}

let focusApplied = false
const tryApplyPendingFocus = async () => {
  if (focusApplied) return
  const pf = getPendingPageFocusForRoute(ROUTE_NAME.rules)
  if (!pf || pf.kind !== 'rule') return

  const { type, payload } = parseRuleText(pf.value)
  if (!type) return

  // Ensure we are on the Rules list (not Provider tab)
  if (rulesTabShow.value !== RULE_TAB_TYPE.RULES) rulesTabShow.value = RULE_TAB_TYPE.RULES

  const idx = (renderRules.value || []).findIndex((r: Rule) => {
    const rt = String((r as any)?.type || '').trim()
    const rp = String((r as any)?.payload || '').trim()
    return rt === type && rp === payload
  })

  if (idx < 0) return

  // If the list is virtualized, scroll by index first.
  if ((renderRules.value?.length || 0) >= 200) {
    try {
      vsRef.value?.scrollToIndex?.(idx, 'center')
    } catch {
      // ignore
    }
  }

  const start = performance.now()
  const loop = async () => {
    await nextTick()
    const el = findRuleCardEl(type, payload)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      flashNavHighlight(el)
      clearPendingPageFocus()
      focusApplied = true
      return
    }

    if (performance.now() - start < 2200) {
      requestAnimationFrame(() => {
        loop()
      })
    }
  }

  loop()
}

fetchRules()

onMounted(() => {
  cleanupExpiredPendingPageFocus()
  tryApplyPendingFocus()
})

watch([renderRules, rulesTabShow], () => {
  tryApplyPendingFocus()
})
</script>
