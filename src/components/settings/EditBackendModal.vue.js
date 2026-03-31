/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { isBackendAvailable } from '@/api';
import DialogWrapper from '@/components/common/DialogWrapper.vue';
import TextInput from '@/components/common/TextInput.vue';
import BackendContractCard from '@/components/settings/BackendContractCard.vue';
import BackendDataFlowCard from '@/components/settings/BackendDataFlowCard.vue';
import { BACKEND_KINDS } from '@/config/backendContract';
import { getRecommendedSecondaryPath, normalizeBackendInput } from '@/helper/backend';
import { showNotification } from '@/helper/notification';
import { getLabelFromBackend } from '@/helper/utils';
import { activeBackend, backendList, updateBackend } from '@/store/setup';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
const props = defineProps();
const emit = defineEmits();
const { t } = useI18n();
const isVisible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value),
});
const editForm = ref(null);
const selectedBackendUuid = ref('');
const isSaving = ref(false);
const selectedBackend = computed(() => {
    return backendList.value.find((b) => b.uuid === selectedBackendUuid.value) || null;
});
const recommendedSecondaryPath = computed(() => getRecommendedSecondaryPath(editForm.value?.kind || BACKEND_KINDS.COMPATIBILITY_BRIDGE));
const backendModeHelpText = computed(() => editForm.value?.kind === BACKEND_KINDS.UBUNTU_SERVICE
    ? t('backendModeUbuntuServiceHelp')
    : t('backendModeCompatibilityHelp'));
watch(() => props.modelValue, (isOpen) => {
    if (isOpen) {
        if (props.defaultBackendUuid) {
            selectedBackendUuid.value = props.defaultBackendUuid;
        }
        else if (activeBackend.value) {
            selectedBackendUuid.value = activeBackend.value.uuid;
        }
    }
});
watch(selectedBackend, (backend) => {
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
        };
    }
}, { immediate: true });
const handleCancel = () => {
    isVisible.value = false;
    editForm.value = null;
    selectedBackendUuid.value = '';
};
const handleSave = async () => {
    if (!editForm.value || !selectedBackend.value)
        return;
    isSaving.value = true;
    try {
        const normalizedForm = normalizeBackendInput(editForm.value);
        const testBackend = {
            uuid: selectedBackend.value.uuid,
            ...normalizedForm,
        };
        const isAvailable = await isBackendAvailable(testBackend, 10000);
        if (!isAvailable) {
            showNotification({
                content: t('backendConnectionFailed'),
                type: 'alert-error',
            });
            return;
        }
        updateBackend(selectedBackend.value.uuid, normalizedForm);
        showNotification({
            content: t('backendConfigSaved'),
            type: 'alert-success',
        });
        isVisible.value = false;
        editForm.value = null;
        selectedBackendUuid.value = '';
        emit('saved');
    }
    catch (error) {
        showNotification({
            content: `${t('saveFailed')}: ${error}`,
            type: 'alert-error',
        });
    }
    finally {
        isSaving.value = false;
    }
};
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
const __VLS_0 = DialogWrapper || DialogWrapper;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    ...{ 'onKeydown': {} },
    modelValue: (__VLS_ctx.isVisible),
}));
const __VLS_2 = __VLS_1({
    ...{ 'onKeydown': {} },
    modelValue: (__VLS_ctx.isVisible),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
let __VLS_5;
const __VLS_6 = ({ keydown: {} },
    { onKeydown: (...[$event]) => {
            !__VLS_ctx.isSaving && __VLS_ctx.handleSave();
            // @ts-ignore
            [isVisible, isSaving, handleSave,];
        } });
var __VLS_7 = {};
const { default: __VLS_8 } = __VLS_3.slots;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-col gap-4" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
    ...{ class: "text-lg font-bold" },
});
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
(__VLS_ctx.t('editBackendTitle'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-col gap-1" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "text-sm" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
(__VLS_ctx.t('selectBackend'));
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ class: "select select-sm w-full" },
    value: (__VLS_ctx.selectedBackendUuid),
});
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
for (const [backend] of __VLS_vFor((__VLS_ctx.backendList))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (backend.uuid),
        value: (backend.uuid),
    });
    (__VLS_ctx.getLabelFromBackend(backend));
    // @ts-ignore
    [t, t, selectedBackendUuid, backendList, getLabelFromBackend,];
}
if (__VLS_ctx.editForm) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-col gap-3" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-col gap-1" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "text-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    (__VLS_ctx.t('protocol'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        ...{ class: "select select-sm w-full" },
        value: (__VLS_ctx.editForm.protocol),
    });
    /** @type {__VLS_StyleScopedClasses['select']} */ ;
    /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "http",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "https",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-col gap-1" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "text-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    (__VLS_ctx.t('backendMode'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        ...{ class: "select select-sm w-full" },
        value: (__VLS_ctx.editForm.kind),
    });
    /** @type {__VLS_StyleScopedClasses['select']} */ ;
    /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: (__VLS_ctx.BACKEND_KINDS.COMPATIBILITY_BRIDGE),
    });
    (__VLS_ctx.t('backendModeCompatibility'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: (__VLS_ctx.BACKEND_KINDS.UBUNTU_SERVICE),
    });
    (__VLS_ctx.t('backendModeUbuntuService'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-2xl border border-base-300/70 bg-base-100/70 px-3 py-2 text-xs leading-5 opacity-85" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-base-300/70']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-85']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "font-semibold" },
    });
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    (__VLS_ctx.t('backendModeHelpTitle'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    (__VLS_ctx.backendModeHelpText);
    if (__VLS_ctx.editForm) {
        const __VLS_9 = BackendContractCard;
        // @ts-ignore
        const __VLS_10 = __VLS_asFunctionalComponent1(__VLS_9, new __VLS_9({
            backend: (__VLS_ctx.editForm),
            kind: (__VLS_ctx.editForm.kind),
        }));
        const __VLS_11 = __VLS_10({
            backend: (__VLS_ctx.editForm),
            kind: (__VLS_ctx.editForm.kind),
        }, ...__VLS_functionalComponentArgsRest(__VLS_10));
    }
    if (__VLS_ctx.editForm) {
        const __VLS_14 = BackendDataFlowCard;
        // @ts-ignore
        const __VLS_15 = __VLS_asFunctionalComponent1(__VLS_14, new __VLS_14({
            backend: (__VLS_ctx.editForm),
            kind: (__VLS_ctx.editForm.kind),
        }));
        const __VLS_16 = __VLS_15({
            backend: (__VLS_ctx.editForm),
            kind: (__VLS_ctx.editForm.kind),
        }, ...__VLS_functionalComponentArgsRest(__VLS_15));
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-col gap-1" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "text-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    (__VLS_ctx.t('host'));
    const __VLS_19 = TextInput;
    // @ts-ignore
    const __VLS_20 = __VLS_asFunctionalComponent1(__VLS_19, new __VLS_19({
        ...{ class: "w-full" },
        name: "username",
        modelValue: (__VLS_ctx.editForm.host),
        placeholder: "127.0.0.1",
    }));
    const __VLS_21 = __VLS_20({
        ...{ class: "w-full" },
        name: "username",
        modelValue: (__VLS_ctx.editForm.host),
        placeholder: "127.0.0.1",
    }, ...__VLS_functionalComponentArgsRest(__VLS_20));
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-col gap-1" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "text-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    (__VLS_ctx.t('port'));
    const __VLS_24 = TextInput;
    // @ts-ignore
    const __VLS_25 = __VLS_asFunctionalComponent1(__VLS_24, new __VLS_24({
        ...{ class: "w-full" },
        modelValue: (__VLS_ctx.editForm.port),
        placeholder: "9090",
    }));
    const __VLS_26 = __VLS_25({
        ...{ class: "w-full" },
        modelValue: (__VLS_ctx.editForm.port),
        placeholder: "9090",
    }, ...__VLS_functionalComponentArgsRest(__VLS_25));
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-col gap-1" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "text-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    (__VLS_ctx.$t('secondaryPath'));
    (__VLS_ctx.$t('optional'));
    const __VLS_29 = TextInput;
    // @ts-ignore
    const __VLS_30 = __VLS_asFunctionalComponent1(__VLS_29, new __VLS_29({
        ...{ class: "w-full" },
        modelValue: (__VLS_ctx.editForm.secondaryPath),
        placeholder: (__VLS_ctx.t('optional')),
    }));
    const __VLS_31 = __VLS_30({
        ...{ class: "w-full" },
        modelValue: (__VLS_ctx.editForm.secondaryPath),
        placeholder: (__VLS_ctx.t('optional')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_30));
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center justify-between gap-3 text-xs opacity-75" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-75']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.$t('backendModeRecommendedPath'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
    (__VLS_ctx.recommendedSecondaryPath || '—');
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.editForm))
                    return;
                __VLS_ctx.editForm.secondaryPath = __VLS_ctx.recommendedSecondaryPath;
                // @ts-ignore
                [t, t, t, t, t, t, t, t, editForm, editForm, editForm, editForm, editForm, editForm, editForm, editForm, editForm, editForm, editForm, editForm, editForm, BACKEND_KINDS, BACKEND_KINDS, backendModeHelpText, $t, $t, $t, recommendedSecondaryPath, recommendedSecondaryPath,];
            } },
        type: "button",
        ...{ class: "btn btn-ghost btn-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    (__VLS_ctx.$t('backendModeUseRecommendedPath'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-col gap-1" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "text-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    (__VLS_ctx.t('password'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "password",
        ...{ class: "input input-sm w-full" },
    });
    (__VLS_ctx.editForm.password);
    /** @type {__VLS_StyleScopedClasses['input']} */ ;
    /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-col gap-1" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "text-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    (__VLS_ctx.t('label'));
    (__VLS_ctx.t('optional'));
    const __VLS_34 = TextInput;
    // @ts-ignore
    const __VLS_35 = __VLS_asFunctionalComponent1(__VLS_34, new __VLS_34({
        ...{ class: "w-full" },
        modelValue: (__VLS_ctx.editForm.label),
        placeholder: (__VLS_ctx.t('label')),
    }));
    const __VLS_36 = __VLS_35({
        ...{ class: "w-full" },
        modelValue: (__VLS_ctx.editForm.label),
        placeholder: (__VLS_ctx.t('label')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_35));
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex justify-end gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.handleCancel) },
    ...{ class: "btn btn-sm" },
    disabled: (__VLS_ctx.isSaving),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
(__VLS_ctx.t('cancel'));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.handleSave) },
    ...{ class: "btn btn-primary btn-sm" },
    disabled: (__VLS_ctx.isSaving),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
if (__VLS_ctx.isSaving) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "loading loading-spinner loading-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['loading']} */ ;
    /** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
    /** @type {__VLS_StyleScopedClasses['loading-xs']} */ ;
}
(__VLS_ctx.isSaving ? __VLS_ctx.t('checking') : __VLS_ctx.t('save'));
// @ts-ignore
[isSaving, isSaving, isSaving, isSaving, handleSave, t, t, t, t, t, t, t, editForm, editForm, $t, handleCancel,];
var __VLS_3;
var __VLS_4;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
