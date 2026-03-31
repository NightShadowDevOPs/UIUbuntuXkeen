/// <reference types="../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import ImportSettings from '@/components/common/ImportSettings.vue';
import TextInput from '@/components/common/TextInput.vue';
import EditBackendModal from '@/components/settings/EditBackendModal.vue';
import BackendContractCard from '@/components/settings/BackendContractCard.vue';
import BackendDataFlowCard from '@/components/settings/BackendDataFlowCard.vue';
import LanguageSelect from '@/components/settings/LanguageSelect.vue';
import { BACKEND_KINDS } from '@/config/backendContract';
import { ROUTE_NAME } from '@/constant';
import { getBackendKindBadgeClass, getRecommendedSecondaryPath, normalizeBackendInput, } from '@/helper/backend';
import { showNotification } from '@/helper/notification';
import { getLabelFromBackend, getUrlFromBackend } from '@/helper/utils';
import router from '@/router';
import { activeUuid, addBackend, backendList, removeBackend } from '@/store/setup';
import { ChevronUpDownIcon, PencilIcon, QuestionMarkCircleIcon, TrashIcon, } from '@heroicons/vue/24/outline';
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import Draggable from 'vuedraggable';
const { t } = useI18n();
const form = reactive({
    protocol: 'http',
    host: '127.0.0.1',
    port: '9090',
    secondaryPath: '',
    password: '',
    label: '',
    kind: BACKEND_KINDS.COMPATIBILITY_BRIDGE,
});
const showEditModal = ref(false);
const editingBackendUuid = ref('');
const recommendedSecondaryPath = computed(() => getRecommendedSecondaryPath(form.kind));
const backendModeHelpText = computed(() => form.kind === BACKEND_KINDS.UBUNTU_SERVICE
    ? t('backendModeUbuntuServiceHelp')
    : t('backendModeCompatibilityHelp'));
const applyRecommendedPath = () => {
    form.secondaryPath = recommendedSecondaryPath.value;
};
watch(() => router.currentRoute.value.query.editBackend, (backendUuid) => {
    if (backendUuid && typeof backendUuid === 'string') {
        editingBackendUuid.value = backendUuid;
        showEditModal.value = true;
        router.replace({ query: {} });
    }
}, { immediate: true });
const selectBackend = (uuid) => {
    activeUuid.value = uuid;
    router.push({ name: ROUTE_NAME.proxies });
};
const editBackend = (backend) => {
    editingBackendUuid.value = backend.uuid;
    showEditModal.value = true;
};
const handleSubmit = async (form, quiet = false) => {
    const normalizedForm = normalizeBackendInput(form);
    const { protocol, host, port, password } = normalizedForm;
    if (!protocol || !host || !port) {
        alert('Please fill in all the fields.');
        return;
    }
    if (window.location.protocol === 'https:' &&
        protocol === 'http' &&
        !['::1', '0.0.0.0', '127.0.0.1', 'localhost'].includes(host) &&
        !quiet) {
        showNotification({
            content: 'protocolTips',
        });
    }
    try {
        const data = await fetch(`${getUrlFromBackend(normalizedForm)}/version`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${password}`,
            },
        });
        if (data.status !== 200) {
            if (!quiet) {
                alert(data.statusText);
            }
            return;
        }
        const { version, message } = await data.json();
        if (!version) {
            if (!quiet) {
                alert(message);
            }
            return;
        }
        addBackend(normalizedForm);
        router.push({ name: ROUTE_NAME.proxies });
    }
    catch (e) {
        if (!quiet) {
            alert(e);
        }
    }
};
const query = new URLSearchParams(window.location.search || location.hash.match(/\?.*$/)?.[0]?.replace('?', ''));
if (query.has('hostname')) {
    handleSubmit({
        protocol: query.get('http')
            ? 'http'
            : query.get('https')
                ? 'https'
                : window.location.protocol.replace(':', ''),
        secondaryPath: query.get('secondaryPath') || '',
        host: query.get('hostname'),
        port: query.get('port'),
        password: query.get('secret') || '',
        label: query.get('label') || '',
        kind: query.get('kind') || BACKEND_KINDS.COMPATIBILITY_BRIDGE,
        disableUpgradeCore: query.get('disableUpgradeCore') === '1' || query.get('disableUpgradeCore') === 'core',
    });
}
else if (backendList.value.length === 0) {
    handleSubmit(form, true);
}
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ onKeydown: (...[$event]) => {
            __VLS_ctx.handleSubmit(__VLS_ctx.form);
            // @ts-ignore
            [handleSubmit, form,];
        } },
    ...{ class: "bg-base-200/50 h-full w-full items-center justify-center overflow-auto sm:flex" },
});
/** @type {__VLS_StyleScopedClasses['bg-base-200/50']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:flex']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "absolute top-4 right-4 max-sm:hidden" },
});
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['top-4']} */ ;
/** @type {__VLS_StyleScopedClasses['right-4']} */ ;
/** @type {__VLS_StyleScopedClasses['max-sm:hidden']} */ ;
const __VLS_0 = ImportSettings;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "absolute right-4 bottom-4 max-sm:hidden" },
});
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['right-4']} */ ;
/** @type {__VLS_StyleScopedClasses['bottom-4']} */ ;
/** @type {__VLS_StyleScopedClasses['max-sm:hidden']} */ ;
const __VLS_5 = LanguageSelect;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({}));
const __VLS_7 = __VLS_6({}, ...__VLS_functionalComponentArgsRest(__VLS_6));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card mx-auto w-96 max-w-[90%] gap-3 px-6 py-2 max-sm:my-4" },
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['w-96']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-[90%]']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['px-6']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['max-sm:my-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h1, __VLS_intrinsics.h1)({
    ...{ class: "text-2xl font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
(__VLS_ctx.$t('setup'));
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
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.$t('protocol'));
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ class: "select select-sm w-full" },
    value: (__VLS_ctx.form.protocol),
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
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.$t('backendMode'));
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ class: "select select-sm w-full" },
    value: (__VLS_ctx.form.kind),
});
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: (__VLS_ctx.BACKEND_KINDS.COMPATIBILITY_BRIDGE),
});
(__VLS_ctx.$t('backendModeCompatibility'));
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: (__VLS_ctx.BACKEND_KINDS.UBUNTU_SERVICE),
});
(__VLS_ctx.$t('backendModeUbuntuService'));
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
(__VLS_ctx.$t('backendModeHelpTitle'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
(__VLS_ctx.backendModeHelpText);
const __VLS_10 = BackendContractCard;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
    backend: (__VLS_ctx.form),
    kind: (__VLS_ctx.form.kind),
}));
const __VLS_12 = __VLS_11({
    backend: (__VLS_ctx.form),
    kind: (__VLS_ctx.form.kind),
}, ...__VLS_functionalComponentArgsRest(__VLS_11));
const __VLS_15 = BackendDataFlowCard;
// @ts-ignore
const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({
    backend: (__VLS_ctx.form),
    kind: (__VLS_ctx.form.kind),
}));
const __VLS_17 = __VLS_16({
    backend: (__VLS_ctx.form),
    kind: (__VLS_ctx.form.kind),
}, ...__VLS_functionalComponentArgsRest(__VLS_16));
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
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.$t('host'));
const __VLS_20 = TextInput;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent1(__VLS_20, new __VLS_20({
    ...{ class: "w-full" },
    name: "username",
    autocomplete: "username",
    modelValue: (__VLS_ctx.form.host),
}));
const __VLS_22 = __VLS_21({
    ...{ class: "w-full" },
    name: "username",
    autocomplete: "username",
    modelValue: (__VLS_ctx.form.host),
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
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
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.$t('port'));
const __VLS_25 = TextInput;
// @ts-ignore
const __VLS_26 = __VLS_asFunctionalComponent1(__VLS_25, new __VLS_25({
    ...{ class: "w-full" },
    modelValue: (__VLS_ctx.form.port),
}));
const __VLS_27 = __VLS_26({
    ...{ class: "w-full" },
    modelValue: (__VLS_ctx.form.port),
}, ...__VLS_functionalComponentArgsRest(__VLS_26));
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-col gap-1" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "flex items-center gap-1 text-sm" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.$t('secondaryPath'));
(__VLS_ctx.$t('optional'));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "tooltip" },
    'data-tip': (__VLS_ctx.$t('secondaryPathTip')),
});
/** @type {__VLS_StyleScopedClasses['tooltip']} */ ;
let __VLS_30;
/** @ts-ignore @type {typeof __VLS_components.QuestionMarkCircleIcon} */
QuestionMarkCircleIcon;
// @ts-ignore
const __VLS_31 = __VLS_asFunctionalComponent1(__VLS_30, new __VLS_30({
    ...{ class: "h-4 w-4" },
}));
const __VLS_32 = __VLS_31({
    ...{ class: "h-4 w-4" },
}, ...__VLS_functionalComponentArgsRest(__VLS_31));
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
const __VLS_35 = TextInput;
// @ts-ignore
const __VLS_36 = __VLS_asFunctionalComponent1(__VLS_35, new __VLS_35({
    ...{ class: "w-full" },
    modelValue: (__VLS_ctx.form.secondaryPath),
}));
const __VLS_37 = __VLS_36({
    ...{ class: "w-full" },
    modelValue: (__VLS_ctx.form.secondaryPath),
}, ...__VLS_functionalComponentArgsRest(__VLS_36));
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
            __VLS_ctx.applyRecommendedPath();
            // @ts-ignore
            [form, form, form, form, form, form, form, form, form, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, BACKEND_KINDS, BACKEND_KINDS, backendModeHelpText, recommendedSecondaryPath, applyRecommendedPath,];
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
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.$t('password'));
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "password",
    ...{ class: "input input-sm w-full" },
});
(__VLS_ctx.form.password);
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
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.$t('label'));
(__VLS_ctx.$t('optional'));
const __VLS_40 = TextInput;
// @ts-ignore
const __VLS_41 = __VLS_asFunctionalComponent1(__VLS_40, new __VLS_40({
    ...{ class: "w-full" },
    modelValue: (__VLS_ctx.form.label),
}));
const __VLS_42 = __VLS_41({
    ...{ class: "w-full" },
    modelValue: (__VLS_ctx.form.label),
}, ...__VLS_functionalComponentArgsRest(__VLS_41));
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.handleSubmit(__VLS_ctx.form);
            // @ts-ignore
            [handleSubmit, form, form, form, $t, $t, $t, $t,];
        } },
    ...{ class: "btn btn-primary btn-sm w-full" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
(__VLS_ctx.$t('submit'));
let __VLS_45;
/** @ts-ignore @type {typeof __VLS_components.Draggable | typeof __VLS_components.Draggable} */
Draggable;
// @ts-ignore
const __VLS_46 = __VLS_asFunctionalComponent1(__VLS_45, new __VLS_45({
    ...{ class: "flex flex-1 flex-col gap-2" },
    modelValue: (__VLS_ctx.backendList),
    group: "list",
    animation: (150),
    itemKey: ('uuid'),
}));
const __VLS_47 = __VLS_46({
    ...{ class: "flex flex-1 flex-col gap-2" },
    modelValue: (__VLS_ctx.backendList),
    group: "list",
    animation: (150),
    itemKey: ('uuid'),
}, ...__VLS_functionalComponentArgsRest(__VLS_46));
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
const { default: __VLS_50 } = __VLS_48.slots;
{
    const { item: __VLS_51 } = __VLS_48.slots;
    const [{ element }] = __VLS_vSlot(__VLS_51);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        key: (element.uuid),
        ...{ class: "flex items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ class: "btn btn-circle btn-ghost btn-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
    let __VLS_52;
    /** @ts-ignore @type {typeof __VLS_components.ChevronUpDownIcon} */
    ChevronUpDownIcon;
    // @ts-ignore
    const __VLS_53 = __VLS_asFunctionalComponent1(__VLS_52, new __VLS_52({
        ...{ class: "h-4 w-4 cursor-grab" },
    }));
    const __VLS_54 = __VLS_53({
        ...{ class: "h-4 w-4 cursor-grab" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_53));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['cursor-grab']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.selectBackend(element.uuid);
                // @ts-ignore
                [$t, backendList, selectBackend,];
            } },
        ...{ class: "btn btn-sm flex-1 justify-between" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "truncate" },
    });
    /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
    (__VLS_ctx.getLabelFromBackend(element));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: (__VLS_ctx.getBackendKindBadgeClass(element.kind)) },
    });
    (element.kind === __VLS_ctx.BACKEND_KINDS.UBUNTU_SERVICE ? __VLS_ctx.$t('backendModeShortUbuntu') : __VLS_ctx.$t('backendModeShortDirect'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.editBackend(element);
                // @ts-ignore
                [$t, $t, BACKEND_KINDS, getLabelFromBackend, getBackendKindBadgeClass, editBackend,];
            } },
        ...{ class: "btn btn-circle btn-ghost btn-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
    let __VLS_57;
    /** @ts-ignore @type {typeof __VLS_components.PencilIcon} */
    PencilIcon;
    // @ts-ignore
    const __VLS_58 = __VLS_asFunctionalComponent1(__VLS_57, new __VLS_57({
        ...{ class: "h-4 w-4" },
    }));
    const __VLS_59 = __VLS_58({
        ...{ class: "h-4 w-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_58));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (() => __VLS_ctx.removeBackend(element.uuid)) },
        ...{ class: "btn btn-circle btn-ghost btn-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
    let __VLS_62;
    /** @ts-ignore @type {typeof __VLS_components.TrashIcon} */
    TrashIcon;
    // @ts-ignore
    const __VLS_63 = __VLS_asFunctionalComponent1(__VLS_62, new __VLS_62({
        ...{ class: "h-4 w-4" },
    }));
    const __VLS_64 = __VLS_63({
        ...{ class: "h-4 w-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_63));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    // @ts-ignore
    [removeBackend,];
}
// @ts-ignore
[];
var __VLS_48;
const __VLS_67 = LanguageSelect;
// @ts-ignore
const __VLS_68 = __VLS_asFunctionalComponent1(__VLS_67, new __VLS_67({
    ...{ class: "mt-4 sm:hidden" },
}));
const __VLS_69 = __VLS_68({
    ...{ class: "mt-4 sm:hidden" },
}, ...__VLS_functionalComponentArgsRest(__VLS_68));
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:hidden']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "absolute top-2 right-2 sm:hidden" },
});
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['top-2']} */ ;
/** @type {__VLS_StyleScopedClasses['right-2']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:hidden']} */ ;
const __VLS_72 = ImportSettings;
// @ts-ignore
const __VLS_73 = __VLS_asFunctionalComponent1(__VLS_72, new __VLS_72({}));
const __VLS_74 = __VLS_73({}, ...__VLS_functionalComponentArgsRest(__VLS_73));
const __VLS_77 = EditBackendModal;
// @ts-ignore
const __VLS_78 = __VLS_asFunctionalComponent1(__VLS_77, new __VLS_77({
    modelValue: (__VLS_ctx.showEditModal),
    defaultBackendUuid: (__VLS_ctx.editingBackendUuid),
}));
const __VLS_79 = __VLS_78({
    modelValue: (__VLS_ctx.showEditModal),
    defaultBackendUuid: (__VLS_ctx.editingBackendUuid),
}, ...__VLS_functionalComponentArgsRest(__VLS_78));
// @ts-ignore
[showEditModal, editingBackendUuid,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
