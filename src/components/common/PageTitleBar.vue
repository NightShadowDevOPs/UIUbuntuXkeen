<template>
  <div class="bg-base-100 border-b border-base-content/10 px-3 py-2">
    <div class="flex items-center gap-2">
      <component
        v-if="icon"
        :is="icon"
        class="h-5 w-5 opacity-80"
      />
      <div class="min-w-0">
        <div class="truncate text-sm font-semibold">
          {{ title }}
        </div>
      </div>

      <div class="ml-auto flex items-center gap-2">
        <button
          type="button"
          class="btn btn-ghost btn-xs"
          :title="$t('globalSearch')"
          @click="openGlobalSearch"
        >
          <MagnifyingGlassIcon class="h-4 w-4" />
          <span class="hidden md:inline">{{ $t('globalSearch') }}</span>
          <span class="hidden md:inline text-[10px] opacity-60">Ctrl+K</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ROUTE_ICON_MAP } from '@/constant'
import { globalSearchOpen } from '@/store/globalSearch'
import { MagnifyingGlassIcon } from '@heroicons/vue/24/outline'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ routeName: string | null | undefined }>()
const { t } = useI18n()

const title = computed(() => {
  const n = String(props.routeName || '').trim()
  return n ? t(n) : 'UI Mihomo/Ultra'
})

const icon = computed(() => {
  const n = String(props.routeName || '').trim()
  return (ROUTE_ICON_MAP as any)?.[n] || null
})

const openGlobalSearch = () => {
  globalSearchOpen.value = true
}
</script>
