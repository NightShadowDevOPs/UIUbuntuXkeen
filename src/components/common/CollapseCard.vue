<template>
  <div :class="`collapse ${showCollapse ? 'collapse-open' : 'collapse-close'}`">
    <div
      class="collapse-title cursor-pointer overflow-visible pr-4 select-none"
      @click="showCollapse = !showCollapse"
    >
      <slot name="title" :open="showCollapse" />
      <slot
        v-if="!showCollapse"
        name="preview" :open="showCollapse"
      />
    </div>
    <div
      class="collapse-content max-sm:px-2"
      @transitionend="handlerTransitionEnd"
    >
      <div
        class="max-h-108 overflow-y-auto"
        :class="[SCROLLABLE_PARENT_CLASS, !showCollapse && 'opacity-0']"
      >
        <slot
          v-if="showContent"
          :show-full-content="showFullContent"
          name="content"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { collapsedBus } from '@/composables/bus'
import { SCROLLABLE_PARENT_CLASS } from '@/helper/utils'
import { collapseGroupMap } from '@/store/settings'
import { computed, onUnmounted, ref } from 'vue'

const props = defineProps<{
  name: string
}>()

const showCollapse = computed({
  get() {
    return collapseGroupMap.value[props.name]
  },
  set(value) {
    if (value) {
      showFullContent.value = false
      showContent.value = true
    }

    collapseGroupMap.value[props.name] = value
  },
})

const showContent = ref(showCollapse.value)
const showFullContent = ref(showCollapse.value)

const handlerTransitionEnd = () => {
  if (showCollapse.value) {
    showFullContent.value = true
  } else {
    showContent.value = false
  }
}

const busHandler = ({ open }: { open: boolean }) => {
  showCollapse.value = open
}

collapsedBus.on(busHandler)

onUnmounted(() => {
  collapsedBus.off(busHandler)
})
</script>
