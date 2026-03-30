<template>
  <DialogWrapper
    v-model="isVisible"
    @keydown.enter="!isSaving && handleSave()"
  >
    <div class="flex flex-col gap-4">
      <h3 class="text-lg font-bold">{{ t('editBackendTitle') }}</h3>

      <div class="flex flex-col gap-1">
        <label class="text-sm">{{ t('selectBackend') }}</label>
        <select
          class="select select-sm w-full"
          v-model="selectedBackendUuid"
        >
          <option
            v-for="backend in backendList"
            :key="backend.uuid"
            :value="backend.uuid"
          >
            {{ getLabelFromBackend(backend) }}
          </option>
        </select>
      </div>

      <div
        class="flex flex-col gap-3"
        v-if="editForm"
      >
        <div class="flex flex-col gap-1">
          <label class="text-sm">{{ t('protocol') }}</label>
          <select
            class="select select-sm w-full"
            v-model="editForm.protocol"
          >
            <option value="http">HTTP</option>
            <option value="https">HTTPS</option>
          </select>
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-sm">{{ t('backendMode') }}</label>
          <select
            class="select select-sm w-full"
            v-model="editForm.kind"
          >
            <option :value="BACKEND_KINDS.COMPATIBILITY_BRIDGE">{{ t('backendModeCompatibility') }}</option>
            <option :value="BACKEND_KINDS.UBUNTU_SERVICE">{{ t('backendModeUbuntuService') }}</option>
          </select>
        </div>

        <div class="rounded-2xl border border-base-300/70 bg-base-100/70 px-3 py-2 text-xs leading-5 opacity-85">
          <div class="font-semibold">{{ t('backendModeHelpTitle') }}</div>
          <div>{{ backendModeHelpText }}</div>
        </div>

        <BackendContractCard v-if="editForm" :backend="editForm" :kind="editForm.kind" />
        <BackendDataFlowCard v-if="editForm" :backend="editForm" :kind="editForm.kind" />

        <div class="flex flex-col gap-1">
          <label class="text-sm">{{ t('host') }}</label>
          <TextInput
            class="w-full"
            name="username"
            v-model="editForm.host"
            placeholder="127.0.0.1"
          />
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-sm">{{ t('port') }}</label>
          <TextInput
            class="w-full"
            v-model="editForm.port"
            placeholder="9090"
          />
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-sm">{{ $t('secondaryPath') }} ({{ $t('optional') }})</label>
          <TextInput
            class="w-full"
            v-model="editForm.secondaryPath"
            :placeholder="t('optional')"
          />
          <div class="flex items-center justify-between gap-3 text-xs opacity-75">
            <span>
              {{ $t('backendModeRecommendedPath') }}:
              <code>{{ recommendedSecondaryPath || '—' }}</code>
            </span>
            <button
              type="button"
              class="btn btn-ghost btn-xs"
              @click="editForm.secondaryPath = recommendedSecondaryPath"
            >
              {{ $t('backendModeUseRecommendedPath') }}
            </button>
          </div>
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-sm">{{ t('password') }}</label>
          <input
            type="password"
            class="input input-sm w-full"
            v-model="editForm.password"
          />
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-sm">{{ t('label') }} ({{ t('optional') }})</label>
          <TextInput
            class="w-full"
            v-model="editForm.label"
            :placeholder="t('label')"
          />
        </div>
      </div>

      <div class="flex justify-end gap-2">
        <button
          class="btn btn-sm"
          @click="handleCancel"
          :disabled="isSaving"
        >
          {{ t('cancel') }}
        </button>
        <button
          class="btn btn-primary btn-sm"
          @click="handleSave"
          :disabled="isSaving"
        >
          <span
            v-if="isSaving"
            class="loading loading-spinner loading-xs"
          ></span>
          {{ isSaving ? t('checking') : t('save') }}
        </button>
      </div>
    </div>
  </DialogWrapper>
</template>

<script setup lang="ts">
import { isBackendAvailable } from '@/api'
import DialogWrapper from '@/components/common/DialogWrapper.vue'
import TextInput from '@/components/common/TextInput.vue'
import BackendContractCard from '@/components/settings/BackendContractCard.vue'
import BackendDataFlowCard from '@/components/settings/BackendDataFlowCard.vue'
import { BACKEND_KINDS } from '@/config/backendContract'
import { getRecommendedSecondaryPath, normalizeBackendInput } from '@/helper/backend'
import { showNotification } from '@/helper/notification'
import { getLabelFromBackend } from '@/helper/utils'
import { activeBackend, backendList, updateBackend } from '@/store/setup'
import type { Backend } from '@/types'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

interface Props {
  modelValue: boolean
  defaultBackendUuid?: string
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'saved'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()

const isVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const editForm = ref<Omit<Backend, 'uuid'> | null>(null)
const selectedBackendUuid = ref<string>('')
const isSaving = ref(false)

const selectedBackend = computed(() => {
  return backendList.value.find((b) => b.uuid === selectedBackendUuid.value) || null
})

const recommendedSecondaryPath = computed(() =>
  getRecommendedSecondaryPath(editForm.value?.kind || BACKEND_KINDS.COMPATIBILITY_BRIDGE),
)
const backendModeHelpText = computed(() =>
  editForm.value?.kind === BACKEND_KINDS.UBUNTU_SERVICE
    ? t('backendModeUbuntuServiceHelp')
    : t('backendModeCompatibilityHelp'),
)

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      if (props.defaultBackendUuid) {
        selectedBackendUuid.value = props.defaultBackendUuid
      } else if (activeBackend.value) {
        selectedBackendUuid.value = activeBackend.value.uuid
      }
    }
  },
)

watch(
  selectedBackend,
  (backend) => {
    if (backend) {
      editForm.value = {
        protocol: backend.protocol,
        host: backend.host,
        port: backend.port,
        secondaryPath: backend.secondaryPath,
        password: backend.password,
        label: backend.label || '',
        kind: backend.kind || BACKEND_KINDS.COMPATIBILITY_BRIDGE,
        disableUpgradeCore: backend.disableUpgradeCore || false,
      }
    }
  },
  { immediate: true },
)

const handleCancel = () => {
  isVisible.value = false
  editForm.value = null
  selectedBackendUuid.value = ''
}

const handleSave = async () => {
  if (!editForm.value || !selectedBackend.value) return

  isSaving.value = true

  try {
    const normalizedForm = normalizeBackendInput(editForm.value)
    const testBackend: Backend = {
      uuid: selectedBackend.value.uuid,
      ...normalizedForm,
    }

    const isAvailable = await isBackendAvailable(testBackend, 10000)

    if (!isAvailable) {
      showNotification({
        content: t('backendConnectionFailed'),
        type: 'alert-error',
      })
      return
    }

    updateBackend(selectedBackend.value.uuid, normalizedForm)
    showNotification({
      content: t('backendConfigSaved'),
      type: 'alert-success',
    })

    isVisible.value = false
    editForm.value = null
    selectedBackendUuid.value = ''
    emit('saved')
  } catch (error) {
    showNotification({
      content: `${t('saveFailed')}: ${error}`,
      type: 'alert-error',
    })
  } finally {
    isSaving.value = false
  }
}
</script>
