<template>
  <div
    v-if="enabled"
    :class="twMerge(grouped ? 'join' : 'flex items-center gap-1', props.containerClass)"
  >
    <button
      type="button"
      :class="btnClass"
      :title="t('openInTopology')"
      @click.stop="() => go('none')"
    >
      <PresentationChartLineIcon :class="iconClass" />
    </button>
    <button
      type="button"
      :class="btnClass"
      :title="t('topologyOnlyThis')"
      @click.stop="() => go('only')"
    >
      <FunnelIcon :class="iconClass" />
    </button>
    <button
      type="button"
      :class="btnClass"
      :title="t('topologyExcludeThis')"
      @click.stop="() => go('exclude')"
    >
      <NoSymbolIcon :class="iconClass" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { navigateToTopology, type TopologyNavMode, type TopologyNavStage } from '@/helper/topologyNav'
import { FunnelIcon, NoSymbolIcon, PresentationChartLineIcon } from '@heroicons/vue/24/outline'
import { twMerge } from 'tailwind-merge'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const props = defineProps<{
  stage: TopologyNavStage
  value: string
  fallbackProxyName?: string
  grouped?: boolean
  buttonClass?: string
  iconClass?: string
  containerClass?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'beforeNavigate', mode: TopologyNavMode): void
}>()

const router = useRouter()
const { t } = useI18n()

const grouped = computed(() => props.grouped !== false)

const enabled = computed(() => {
  if (props.disabled) return false
  return String(props.value || '').trim().length > 0
})

const btnClass = computed(() =>
  twMerge(
    grouped.value ? 'btn btn-ghost btn-xs join-item' : 'btn btn-ghost btn-xs btn-circle',
    props.buttonClass,
  ),
)

const iconClass = computed(() => twMerge('h-4 w-4', props.iconClass))

const go = async (mode: TopologyNavMode) => {
  emit('beforeNavigate', mode)
  await navigateToTopology(
    router,
    { stage: props.stage, value: String(props.value || '').trim() },
    mode,
    { fallbackProxyName: props.fallbackProxyName },
  )
}
</script>
