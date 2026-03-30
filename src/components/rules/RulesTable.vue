<template>
  <div class="overflow-x-auto">
    <div class="min-w-[860px]">
      <!-- header -->
      <div
        class="sticky top-0 z-10 grid grid-cols-12 gap-2 border-b border-base-300 bg-base-100 px-2 py-2 text-xs font-medium opacity-80"
      >
        <div class="col-span-1">#</div>
        <div class="col-span-2">{{ $t('type') }}</div>
        <div class="col-span-4">Payload</div>
        <div class="col-span-2">{{ $t('proxy') }}</div>
        <div class="col-span-1">{{ $t('hits') }}</div>
        <div class="col-span-1">{{ $t('size') }}</div>
        <div class="col-span-1 text-right">Topology</div>
      </div>

      <template v-if="rules.length < virtualThreshold">
        <div
          v-for="(rule, idx) in rules"
          :key="`${rule.type}\u0000${rule.payload}\u0000${idx}`"
          class="grid grid-cols-12 items-center gap-2 border-b border-base-200 px-2 py-2 text-sm hover:bg-base-200"
          data-nav-kind="rule"
          :data-rule-type="rule.type"
          :data-rule-payload="String(rule.payload || '')"
        >
          <div class="col-span-1 text-xs opacity-70">{{ idx + 1 }}.</div>

          <div class="col-span-2 min-w-0">
            <span class="badge badge-sm font-medium whitespace-nowrap">
              {{ rule.type }}
            </span>
          </div>

          <div class="col-span-4 min-w-0">
            <div v-if="rule.payload" class="min-w-0">
              <div class="truncate font-mono text-xs" :title="String(rule.payload)">
                {{ rule.payload }}
              </div>
              <div
                v-if="updatedOf(rule)"
                class="mt-0.5 text-xs text-base-content/60"
              >
                {{ $t('updated') }} {{ updatedOf(rule) }}
              </div>
            </div>
            <span v-else class="text-base-content/50 text-xs">—</span>
          </div>

          <div class="col-span-2 min-w-0">
            <ProxyName :name="rule.proxy" class="badge badge-sm gap-0" />
          </div>

          <div class="col-span-1 whitespace-nowrap text-xs">{{ hitsOf(rule) }}</div>
          <div class="col-span-1 whitespace-nowrap text-xs">{{ sizeOf(rule) }}</div>

          <div class="col-span-1 flex justify-end">
            <TopologyActionButtons :stage="'R'" :value="topologyValue(rule)" :grouped="true" />
          </div>
        </div>
      </template>

      <VirtualScroller
        v-else
        ref="vsRef"
        :data="rules"
        :size="rowSize"
      >
        <template v-slot="{ item: rule, index }: { item: Rule; index: number }">
          <div
            class="grid grid-cols-12 items-center gap-2 border-b border-base-200 px-2 py-2 text-sm hover:bg-base-200"
            data-nav-kind="rule"
            :data-rule-type="rule.type"
            :data-rule-payload="String(rule.payload || '')"
          >
            <div class="col-span-1 text-xs opacity-70">{{ index + 1 }}.</div>

            <div class="col-span-2 min-w-0">
              <span class="badge badge-sm font-medium whitespace-nowrap">
                {{ rule.type }}
              </span>
            </div>

            <div class="col-span-4 min-w-0">
              <div v-if="rule.payload" class="min-w-0">
                <div class="truncate font-mono text-xs" :title="String(rule.payload)">
                  {{ rule.payload }}
                </div>
                <div
                  v-if="updatedOf(rule)"
                  class="mt-0.5 text-xs text-base-content/60"
                >
                  {{ $t('updated') }} {{ updatedOf(rule) }}
                </div>
              </div>
              <span v-else class="text-base-content/50 text-xs">—</span>
            </div>

            <div class="col-span-2 min-w-0">
              <ProxyName :name="rule.proxy" class="badge badge-sm gap-0" />
            </div>

            <div class="col-span-1 whitespace-nowrap text-xs">{{ hitsOf(rule) }}</div>
            <div class="col-span-1 whitespace-nowrap text-xs">{{ sizeOf(rule) }}</div>

            <div class="col-span-1 flex justify-end">
              <TopologyActionButtons :stage="'R'" :value="topologyValue(rule)" :grouped="true" />
            </div>
          </div>
        </template>
      </VirtualScroller>
    </div>
  </div>
</template>

<script setup lang="ts">
import VirtualScroller from '@/components/common/VirtualScroller.vue'
import TopologyActionButtons from '@/components/common/TopologyActionButtons.vue'
import ProxyName from '@/components/proxies/ProxyName.vue'
import { fromNow } from '@/helper/utils'
import { getRuleHitCount, ruleProviderList } from '@/store/rules'
import type { Rule } from '@/types'
import { computed, ref } from 'vue'

const props = defineProps<{
  rules: Rule[]
}>()

const rowSize = 44
const virtualThreshold = 240
const vsRef = ref<any>(null)

defineExpose({
  scrollToIndex: (idx: number, align?: any) => {
    try {
      vsRef.value?.scrollToIndex?.(idx, align)
    } catch {
      // ignore
    }
  },
})

const rules = computed(() => props.rules || [])

const hitsOf = (r: Rule) => getRuleHitCount(r.type, r.payload)

const sizeOf = (r: Rule) => {
  if (r.type === 'RuleSet') {
    const v = ruleProviderList.value.find((provider) => provider.name === r.payload)?.ruleCount
    return typeof v === 'number' ? v : '—'
  }
  return typeof r.size === 'number' ? r.size : '—'
}

const updatedOf = (r: Rule) => {
  if (r.type !== 'RuleSet') return ''
  const provider = ruleProviderList.value.find((x) => x.name === r.payload)
  if (!provider?.updatedAt) return ''
  return fromNow(provider.updatedAt)
}

const topologyValue = (r: Rule) => {
  const type = String(r.type || '').trim()
  const payload = String(r.payload || '').trim()
  return payload ? `${type}: ${payload}` : type
}
</script>
