/// <reference types="../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import QrCodeSvg from '@/components/common/QrCodeSvg.vue';
import { ROUTE_NAME } from '@/constant';
import { countryCodeToFlagEmoji, flagEmojiToCountryCode } from '@/helper/providerIcon';
import { getProxyProtoLabel } from '@/helper/proxyProto';
import { getProviderHealth } from '@/helper/providerHealth';
import { showNotification } from '@/helper/notification';
import { agentToken, agentUrl } from '@/store/agent';
import { agentProviderByName, agentProvidersSslRefreshPending, agentProvidersSslRefreshing, } from '@/store/providerHealth';
import { fetchProxyProvidersOnly, proxyProviederList } from '@/store/proxies';
import { proxyProviderSslWarnDaysMap, sslNearExpiryDaysDefault } from '@/store/settings';
import { useStorage } from '@vueuse/core';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
defineOptions({ name: ROUTE_NAME.subscriptions });
const bundleName = useStorage('config/subscriptions-bundle-name-v1', 'Zash Aggregated');
const selectionMode = useStorage('config/subscriptions-selection-mode-v1', 'all');
const customProviderNames = useStorage('config/subscriptions-custom-providers-v1', []);
const mihomoQrMode = useStorage('config/subscriptions-mihomo-qr-mode-v1', 'url');
const universalQrMode = useStorage('config/subscriptions-universal-qr-mode-v1', 'url');
const publishedBaseUrl = useStorage('config/subscriptions-published-base-v1', '');
const publicationSettingsOpen = ref(!!String(publishedBaseUrl.value || '').trim());
const busy = ref(false);
const providerQuickAvailableOnly = useStorage('config/subscriptions-provider-quick-available-only-v1', false);
const providerQuickProtoFilter = useStorage('config/subscriptions-provider-quick-proto-filter-v1', 'all');
const providerQuickCountryFilter = useStorage('config/subscriptions-provider-quick-country-filter-v1', 'all');
const COUNTRY_HINTS = {
    germany: 'DE', deutschland: 'DE', berlin: 'DE', frankfurt: 'DE',
    finland: 'FI', helsinki: 'FI', suomi: 'FI',
    sweden: 'SE', stockholm: 'SE', sverige: 'SE',
    netherlands: 'NL', holland: 'NL', amsterdam: 'NL',
    swiss: 'CH', switzerland: 'CH', zurich: 'CH',
    russia: 'RU', russian: 'RU', moscow: 'RU', moskva: 'RU', spb: 'RU',
    france: 'FR', paris: 'FR',
    poland: 'PL', warsaw: 'PL',
    czech: 'CZ', prague: 'CZ',
    austria: 'AT', vienna: 'AT',
    spain: 'ES', madrid: 'ES',
    italy: 'IT', milan: 'IT', rome: 'IT',
    norway: 'NO', oslo: 'NO',
    japan: 'JP', tokyo: 'JP',
    singapore: 'SG',
    hongkong: 'HK', 'hong kong': 'HK',
    turkey: 'TR', istanbul: 'TR',
    ukraine: 'UA', kyiv: 'UA', kiev: 'UA',
    britain: 'GB', england: 'GB', london: 'GB',
    usa: 'US', america: 'US', 'united states': 'US',
};
const COUNTRY_CODE_ALLOW = new Set(Object.values(COUNTRY_HINTS).concat(['DE', 'FI', 'SE', 'NL', 'CH', 'RU', 'FR', 'PL', 'CZ', 'AT', 'ES', 'IT', 'NO', 'JP', 'SG', 'HK', 'TR', 'UA', 'GB', 'US']));
const COUNTRY_CODE_STOP = new Set(['WG', 'SS', 'WS', 'TCP', 'UDP', 'TLS', 'MT', 'HY', 'VM', 'GR', 'IP', 'DNS', 'CDN']);
const inferCountryCode = (input) => {
    const text = String(input || '').trim();
    if (!text)
        return '';
    const fromFlag = flagEmojiToCountryCode(text);
    if (fromFlag)
        return fromFlag;
    const low = text.toLowerCase();
    for (const [needle, code] of Object.entries(COUNTRY_HINTS)) {
        if (low.includes(needle))
            return code;
    }
    const matches = text.match(/(?:^|[\s\[\](){}._\-])([A-Z]{2})(?=$|[\s\[\](){}._\-])/g) || [];
    for (const raw of matches) {
        const code = raw.replace(/[^A-Z]/g, '');
        if (!code || COUNTRY_CODE_STOP.has(code))
            continue;
        if (COUNTRY_CODE_ALLOW.has(code))
            return code;
    }
    return '';
};
const summarizeProviderNodes = (provider) => {
    const protocolCounts = {};
    const countryCounts = {};
    const nodes = Array.isArray(provider?.proxies) ? provider.proxies : [];
    for (const node of nodes) {
        const proto = getProxyProtoLabel(node?.type || '');
        if (proto)
            protocolCounts[proto] = (protocolCounts[proto] || 0) + 1;
        const country = inferCountryCode(node?.name || node?.server || '');
        if (country)
            countryCounts[country] = (countryCounts[country] || 0) + 1;
    }
    const topProtocols = Object.entries(protocolCounts)
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => (b.count - a.count) || a.label.localeCompare(b.label))
        .slice(0, 4);
    const topCountries = Object.entries(countryCounts)
        .map(([code, count]) => ({ code, count, flag: countryCodeToFlagEmoji(code) }))
        .sort((a, b) => (b.count - a.count) || a.code.localeCompare(b.code))
        .slice(0, 4);
    return { protocolCounts, countryCounts, topProtocols, topCountries };
};
const providers = computed(() => (proxyProviederList.value || []).filter((p) => Array.isArray(p?.proxies) && String(p?.name || '') !== 'default'));
const providerNames = computed(() => providers.value.map((p) => String(p.name || '')).filter(Boolean));
const providerWarnDays = (providerName) => {
    const key = String(providerName || '').trim();
    const override = Number((proxyProviderSslWarnDaysMap.value || {})[key]);
    if (Number.isFinite(override))
        return Math.max(0, Math.min(365, Math.trunc(override)));
    const base = Number(sslNearExpiryDaysDefault.value);
    return Number.isFinite(base) ? Math.max(0, Math.min(365, Math.trunc(base))) : 2;
};
const providerMetaList = computed(() => {
    return providers.value.map((provider) => {
        const health = getProviderHealth(provider, agentProviderByName.value?.[provider.name], {
            nearExpiryDays: providerWarnDays(String(provider?.name || '')),
            sslRefreshing: agentProvidersSslRefreshing.value || agentProvidersSslRefreshPending.value,
        });
        const nodeCount = Array.isArray(provider?.proxies) ? provider.proxies.length : 0;
        const available = nodeCount > 0 && health.status !== 'offline';
        const summary = summarizeProviderNodes(provider);
        return {
            provider,
            name: String(provider?.name || ''),
            nodeCount,
            available,
            health,
            protocolCounts: summary.protocolCounts,
            countryCounts: summary.countryCounts,
            topProtocols: summary.topProtocols,
            topCountries: summary.topCountries,
        };
    });
});
const providerProtoOptions = computed(() => {
    const set = new Set();
    for (const provider of providerMetaList.value) {
        for (const key of Object.keys(provider.protocolCounts || {}))
            if (key)
                set.add(key);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
});
const providerCountryOptions = computed(() => {
    const set = new Set();
    for (const provider of providerMetaList.value) {
        for (const key of Object.keys(provider.countryCounts || {}))
            if (key)
                set.add(key);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
});
const inventoryProviders = computed(() => {
    const protoRaw = String(providerQuickProtoFilter.value || 'all').trim();
    const countryRaw = String(providerQuickCountryFilter.value || 'all').trim().toUpperCase();
    const proto = protoRaw !== 'all' && providerProtoOptions.value.includes(protoRaw) ? protoRaw : 'all';
    const country = countryRaw !== 'all' && providerCountryOptions.value.includes(countryRaw) ? countryRaw : 'all';
    return providerMetaList.value.filter((provider) => {
        if (providerQuickAvailableOnly.value && !provider.available)
            return false;
        if (proto !== 'all' && !provider.protocolCounts?.[proto])
            return false;
        if (country !== 'all' && !provider.countryCounts?.[country])
            return false;
        return true;
    });
});
const availableProviderNames = computed(() => providerMetaList.value.filter((provider) => provider.available).map((provider) => provider.name));
const selectedProviderNames = computed(() => {
    if (selectionMode.value === 'custom') {
        const wanted = new Set(customProviderNames.value || []);
        return providerNames.value.filter((name) => wanted.has(name));
    }
    if (selectionMode.value === 'available') {
        return availableProviderNames.value.length ? availableProviderNames.value : providerNames.value;
    }
    return providerNames.value;
});
const selectedProvidersMeta = computed(() => {
    const wanted = new Set(selectedProviderNames.value);
    return providerMetaList.value.filter((provider) => wanted.has(provider.name));
});
const agentBase = computed(() => String(agentUrl.value || '').trim().replace(/\/+$/g, ''));
const agentReady = computed(() => !!agentBase.value);
const safeBundleName = computed(() => String(bundleName.value || '').trim() || 'Zash Aggregated');
const noProvidersSelected = computed(() => selectionMode.value === 'custom' && selectedProviderNames.value.length === 0);
const normalizeSubscriptionBase = (value) => {
    const raw = String(value || '').trim();
    if (!raw)
        return '';
    const withProto = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
        const url = new URL(withProto);
        url.hash = '';
        url.search = '';
        url.pathname = url.pathname.replace(/\/+$/g, '');
        return url.toString().replace(/\/+$/g, '');
    }
    catch {
        return raw.replace(/\/+$/g, '');
    }
};
const buildSubscriptionUrlFromBase = (base, format) => {
    const normalizedBase = normalizeSubscriptionBase(base);
    if (!normalizedBase || noProvidersSelected.value)
        return '';
    const params = new URLSearchParams({
        cmd: 'subscription',
        format,
        name: safeBundleName.value,
    });
    const token = String(agentToken.value || '').trim();
    if (token)
        params.set('token', token);
    if (selectedProviderNames.value.length && selectedProviderNames.value.length !== providerNames.value.length) {
        params.set('providers', selectedProviderNames.value.join(','));
    }
    return `${normalizedBase}/cgi-bin/api.sh?${params.toString()}`;
};
const buildSubscriptionUrl = (format) => buildSubscriptionUrlFromBase(agentBase.value, format);
const mihomoUrl = computed(() => buildSubscriptionUrl('mihomo'));
const universalUrl = computed(() => buildSubscriptionUrl('b64'));
const jsonUrl = computed(() => buildSubscriptionUrl('json'));
const v2rayTunUrl = computed(() => buildSubscriptionUrl('v2raytun'));
const publishedBaseUrlNormalized = computed(() => normalizeSubscriptionBase(publishedBaseUrl.value));
const publishedBaseUrlLooksHttps = computed(() => /^https:\/\//i.test(publishedBaseUrlNormalized.value));
const publishedHttpsReady = computed(() => !!publishedBaseUrlNormalized.value && publishedBaseUrlLooksHttps.value);
const publishedMihomoUrl = computed(() => buildSubscriptionUrlFromBase(publishedBaseUrlNormalized.value, 'mihomo'));
const publishedUniversalUrl = computed(() => buildSubscriptionUrlFromBase(publishedBaseUrlNormalized.value, 'b64'));
const publishedJsonUrl = computed(() => buildSubscriptionUrlFromBase(publishedBaseUrlNormalized.value, 'json'));
const publishedV2rayTunUrl = computed(() => buildSubscriptionUrlFromBase(publishedBaseUrlNormalized.value, 'v2raytun'));
const effectiveMihomoUrl = computed(() => publishedMihomoUrl.value || mihomoUrl.value);
const effectiveUniversalUrl = computed(() => publishedUniversalUrl.value || universalUrl.value);
const effectiveJsonUrl = computed(() => publishedJsonUrl.value || jsonUrl.value);
const effectiveV2rayTunUrl = computed(() => publishedV2rayTunUrl.value || v2rayTunUrl.value);
const effectiveMihomoUsesPublished = computed(() => !!publishedMihomoUrl.value);
const effectiveUniversalUsesPublished = computed(() => !!publishedUniversalUrl.value);
const effectiveJsonUsesPublished = computed(() => !!publishedJsonUrl.value);
const effectiveV2rayTunUsesPublished = computed(() => !!publishedV2rayTunUrl.value);
const encodedMihomoUrl = computed(() => (effectiveMihomoUrl.value ? encodeURIComponent(effectiveMihomoUrl.value) : ''));
const clashDeepLink = computed(() => (encodedMihomoUrl.value ? `clash://install-config?url=${encodedMihomoUrl.value}` : ''));
const encodedUniversalUrl = computed(() => (effectiveUniversalUrl.value ? encodeURIComponent(effectiveUniversalUrl.value) : ''));
const encodedBundleName = computed(() => encodeURIComponent(safeBundleName.value));
const v2rayNgDeepLink = computed(() => (encodedUniversalUrl.value
    ? `v2rayng://install-config?url=${encodedUniversalUrl.value}&name=${encodedBundleName.value}`
    : ''));
const hiddifyDeepLink = computed(() => (encodedUniversalUrl.value
    ? `hiddify://import/${encodedUniversalUrl.value}#${encodedBundleName.value}`
    : ''));
const v2rayTunDeepLink = computed(() => (effectiveV2rayTunUrl.value
    ? `v2raytun://import/${effectiveV2rayTunUrl.value}`
    : ''));
const mihomoQrText = computed(() => (mihomoQrMode.value === 'clash' ? clashDeepLink.value : effectiveMihomoUrl.value));
const universalQrText = computed(() => {
    switch (universalQrMode.value) {
        case 'v2rayng':
            return v2rayNgDeepLink.value;
        case 'hiddify':
            return hiddifyDeepLink.value;
        case 'v2raytun':
            return v2rayTunDeepLink.value;
        default:
            return effectiveUniversalUrl.value;
    }
});
const countryOptionLabel = (code) => {
    const cc = String(code || '').trim().toUpperCase();
    if (!cc)
        return cc;
    const flag = countryCodeToFlagEmoji(cc);
    return flag ? `${flag} ${cc}` : cc;
};
const providerChipClass = (provider) => {
    const selected = selectedProviderNames.value.includes(provider.name);
    return [
        selected ? 'border-primary/45 bg-primary/10 text-base-content' : 'border-base-300 bg-base-100 hover:border-base-content/20',
        !provider.available && !selected ? 'opacity-80' : '',
        provider.health.status === 'offline' && !selected ? 'border-error/30' : '',
    ];
};
const handleProviderChipClick = (name) => {
    if (!name)
        return;
    if (selectionMode.value !== 'custom') {
        selectionMode.value = 'custom';
        customProviderNames.value = [...selectedProviderNames.value];
    }
    const next = new Set(customProviderNames.value || []);
    if (next.has(name))
        next.delete(name);
    else
        next.add(name);
    customProviderNames.value = providerNames.value.filter((providerName) => next.has(providerName));
};
const togglePublicationSettings = () => {
    publicationSettingsOpen.value = !publicationSettingsOpen.value;
};
const clearPublishedBase = () => {
    publishedBaseUrl.value = '';
};
const copyText = async (value) => {
    if (!value)
        return;
    try {
        if (navigator?.clipboard?.writeText) {
            await navigator.clipboard.writeText(value);
        }
        else {
            throw new Error('clipboard-unavailable');
        }
        showNotification({ content: 'copySuccess', type: 'alert-success', timeout: 1400 });
    }
    catch {
        const textArea = document.createElement('textarea');
        textArea.value = value;
        textArea.setAttribute('readonly', 'readonly');
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        textArea.style.pointerEvents = 'none';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            const ok = document.execCommand('copy');
            if (!ok)
                throw new Error('execCommand-copy-failed');
            showNotification({ content: 'copySuccess', type: 'alert-success', timeout: 1400 });
        }
        catch {
            showNotification({ content: 'operationFailed', type: 'alert-error', timeout: 2200 });
        }
        finally {
            document.body.removeChild(textArea);
        }
    }
};
const refreshProviders = async () => {
    if (busy.value)
        return;
    busy.value = true;
    try {
        await fetchProxyProvidersOnly();
    }
    finally {
        busy.value = false;
    }
};
const selectAllProviders = () => {
    customProviderNames.value = [...providerNames.value];
};
const selectAvailableProviders = () => {
    customProviderNames.value = [...availableProviderNames.value];
};
const clearSelectedProviders = () => {
    customProviderNames.value = [];
};
onMounted(() => {
    if (!['url', 'v2rayng', 'hiddify', 'v2raytun'].includes(String(universalQrMode.value || '')))
        universalQrMode.value = 'url';
    if (!providerNames.value.length) {
        fetchProxyProvidersOnly();
    }
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "page px-4 pb-6 pt-4 lg:px-6" },
});
/** @type {__VLS_StyleScopedClasses['page']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:px-6']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mx-auto flex max-w-7xl flex-col gap-4" },
});
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-7xl']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm" },
});
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:flex-row']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:justify-between']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "space-y-2" },
});
/** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ class: "text-xl font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
(__VLS_ctx.$t('subscriptionsTitle'));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-sm text-base-content/70" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/70']} */ ;
(__VLS_ctx.$t('subscriptionsDesc'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "badge badge-info badge-outline gap-2" },
});
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-info']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.$t('subscriptionsDirectNote'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid gap-2 sm:grid-cols-2 lg:w-[32rem]" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:w-[32rem]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "form-control" },
});
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "label py-1" },
});
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "label-text text-xs text-base-content/70" },
});
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/70']} */ ;
(__VLS_ctx.$t('subscriptionsName'));
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ class: "input input-bordered input-sm" },
    placeholder: (__VLS_ctx.$t('subscriptionsNamePlaceholder')),
});
(__VLS_ctx.bundleName);
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "form-control" },
});
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "label py-1" },
});
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "label-text text-xs text-base-content/70" },
});
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/70']} */ ;
(__VLS_ctx.$t('subscriptionsMode'));
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (__VLS_ctx.selectionMode),
    ...{ class: "select select-bordered select-sm" },
});
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "all",
});
(__VLS_ctx.$t('subscriptionsModeAll'));
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "available",
});
(__VLS_ctx.$t('subscriptionsModeAvailable'));
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "custom",
});
(__VLS_ctx.$t('subscriptionsModeCustom'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-4 flex flex-wrap items-center gap-2 text-xs text-base-content/70" },
});
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/70']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "badge badge-neutral badge-outline" },
});
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-neutral']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
(__VLS_ctx.$t('subscriptionsProvidersSelected'));
(__VLS_ctx.selectedProviderNames.length);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "badge badge-neutral badge-outline" },
});
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-neutral']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
(__VLS_ctx.$t('subscriptionsProvidersTotal'));
(__VLS_ctx.providers.length);
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.refreshProviders) },
    ...{ class: "btn btn-ghost btn-xs" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
(__VLS_ctx.$t('refresh'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-2 text-xs text-base-content/60" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/60']} */ ;
(__VLS_ctx.$t('subscriptionsProvidersHint'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-4 rounded-2xl border border-base-300 bg-base-200/40 p-3" },
});
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200/40']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:flex-row']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:justify-between']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "space-y-1" },
});
/** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-sm font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
(__VLS_ctx.$t('subscriptionsProvidersInventoryTitle'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-xs text-base-content/60" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/60']} */ ;
(__VLS_ctx.$t('subscriptionsProvidersCardsHint'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-col gap-2 lg:items-end" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:items-end']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "label cursor-pointer justify-start gap-2 rounded-xl border border-base-300 bg-base-100 px-3 py-2 lg:self-start" },
});
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-start']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:self-start']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "label-text text-xs" },
});
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
(__VLS_ctx.$t('subscriptionsAvailableOnlyFilter'));
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "checkbox",
    ...{ class: "toggle toggle-xs" },
});
(__VLS_ctx.providerQuickAvailableOnly);
/** @type {__VLS_StyleScopedClasses['toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['toggle-xs']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "form-control w-full min-w-[11rem] sm:w-48" },
});
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-[11rem]']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:w-48']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "label py-1" },
});
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "label-text text-xs text-base-content/70" },
});
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/70']} */ ;
(__VLS_ctx.$t('subscriptionsProtocolFilter'));
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (__VLS_ctx.providerQuickProtoFilter),
    ...{ class: "select select-bordered select-sm bg-base-100" },
});
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "all",
});
(__VLS_ctx.$t('all'));
for (const [proto] of __VLS_vFor((__VLS_ctx.providerProtoOptions))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (proto),
        value: (proto),
    });
    (proto);
    // @ts-ignore
    [$t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, bundleName, selectionMode, selectedProviderNames, providers, refreshProviders, providerQuickAvailableOnly, providerQuickProtoFilter, providerProtoOptions,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "form-control w-full min-w-[11rem] sm:w-48" },
});
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-[11rem]']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:w-48']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "label py-1" },
});
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "label-text text-xs text-base-content/70" },
});
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/70']} */ ;
(__VLS_ctx.$t('subscriptionsCountryFilter'));
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (__VLS_ctx.providerQuickCountryFilter),
    ...{ class: "select select-bordered select-sm bg-base-100" },
});
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "all",
});
(__VLS_ctx.$t('all'));
for (const [country] of __VLS_vFor((__VLS_ctx.providerCountryOptions))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (country),
        value: (country),
    });
    (__VLS_ctx.countryOptionLabel(country));
    // @ts-ignore
    [$t, $t, providerQuickCountryFilter, providerCountryOptions, countryOptionLabel,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-[11px] text-base-content/55" },
});
/** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/55']} */ ;
(__VLS_ctx.$t('subscriptionsInventoryFilterHint'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3" },
});
/** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['xl:grid-cols-3']} */ ;
for (const [provider] of __VLS_vFor((__VLS_ctx.inventoryProviders))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.handleProviderChipClick(provider.name);
                // @ts-ignore
                [$t, inventoryProviders, handleProviderChipClick,];
            } },
        key: (provider.name),
        type: "button",
        ...{ class: "flex h-full min-h-[7.5rem] flex-col items-start gap-2 rounded-2xl border px-3 py-3 text-left shadow-sm transition-colors" },
        ...{ class: (__VLS_ctx.providerChipClass(provider)) },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-h-[7.5rem]']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-left']} */ ;
    /** @type {__VLS_StyleScopedClasses['shadow-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex w-full flex-wrap items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "min-w-0 flex-1 truncate font-medium" },
    });
    /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    (provider.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-xs badge-neutral badge-outline" },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-neutral']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
    (provider.nodeCount);
    (__VLS_ctx.$t('subscriptionsNodesShort'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-xs" },
        ...{ class: (provider.health.badgeCls) },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
    (__VLS_ctx.$t(provider.health.labelKey));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-wrap gap-1 text-[11px]" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
    for (const [proto] of __VLS_vFor((provider.topProtocols))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            key: (`${provider.name}-proto-${proto.label}`),
            ...{ class: "badge badge-xs badge-outline border-primary/30 bg-primary/5" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-primary/30']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-primary/5']} */ ;
        (proto.label);
        (proto.count);
        // @ts-ignore
        [$t, $t, providerChipClass,];
    }
    if (!provider.topProtocols.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-xs badge-ghost" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
        (__VLS_ctx.$t('subscriptionsNoProtoHints'));
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-wrap gap-1 text-[11px]" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
    for (const [country] of __VLS_vFor((provider.topCountries))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            key: (`${provider.name}-country-${country.code}`),
            ...{ class: "badge badge-xs badge-outline border-secondary/30 bg-secondary/5" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-secondary/30']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-secondary/5']} */ ;
        (country.flag || '🌐');
        (country.code);
        (country.count);
        // @ts-ignore
        [$t,];
    }
    if (!provider.topCountries.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-xs badge-ghost" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
        (__VLS_ctx.$t('subscriptionsMixedCountries'));
    }
    // @ts-ignore
    [$t,];
}
if (!__VLS_ctx.inventoryProviders.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-sm text-base-content/60" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-base-content/60']} */ ;
    (__VLS_ctx.$t('subscriptionsNoProvidersFiltered'));
}
if (__VLS_ctx.selectionMode === 'custom') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-4 rounded-2xl border border-base-300 bg-base-200/40 p-3" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-200/40']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mb-3 flex flex-wrap items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.selectAllProviders) },
        ...{ class: "btn btn-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    (__VLS_ctx.$t('subscriptionsSelectAll'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.selectAvailableProviders) },
        ...{ class: "btn btn-ghost btn-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    (__VLS_ctx.$t('subscriptionsSelectAvailable'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.clearSelectedProviders) },
        ...{ class: "btn btn-ghost btn-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    (__VLS_ctx.$t('clear'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "text-xs text-base-content/60" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-base-content/60']} */ ;
    (__VLS_ctx.$t('subscriptionsCustomSelectionHint'));
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm" },
});
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:flex-row']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:justify-between']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "space-y-2" },
});
/** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
    ...{ class: "text-lg font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
(__VLS_ctx.$t('subscriptionsHttpsTitle'));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-sm text-base-content/70" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/70']} */ ;
(__VLS_ctx.$t('subscriptionsHttpsDesc'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "badge gap-1" },
    ...{ class: (__VLS_ctx.publishedHttpsReady ? 'badge-success badge-outline' : 'badge-neutral badge-outline') },
});
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
(__VLS_ctx.publishedHttpsReady ? __VLS_ctx.$t('subscriptionsHttpsReady') : __VLS_ctx.$t('subscriptionsHttpsLocalMode'));
if (__VLS_ctx.publishedBaseUrlNormalized && !__VLS_ctx.publishedBaseUrlLooksHttps) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-warning badge-outline" },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-warning']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
    (__VLS_ctx.$t('subscriptionsHttpsNeedsTls'));
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-3 rounded-2xl bg-base-200/40 p-3 text-xs text-base-content/70" },
});
/** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200/40']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/70']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
(__VLS_ctx.publishedHttpsReady ? __VLS_ctx.$t('subscriptionsHttpsHintConfigured') : __VLS_ctx.$t('subscriptionsHttpsHintLocalOnly'));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-2" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
(__VLS_ctx.$t('subscriptionsHttpsHint2'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-3 flex flex-wrap gap-2" },
});
/** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.togglePublicationSettings) },
    ...{ class: "btn btn-sm btn-outline" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-outline']} */ ;
(__VLS_ctx.publicationSettingsOpen ? __VLS_ctx.$t('subscriptionsHttpsAdvancedHide') : __VLS_ctx.$t('subscriptionsHttpsAdvancedShow'));
if (__VLS_ctx.publishedBaseUrlNormalized) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.publishedBaseUrlNormalized))
                    return;
                __VLS_ctx.copyText(__VLS_ctx.publishedBaseUrlNormalized);
                // @ts-ignore
                [$t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, selectionMode, inventoryProviders, selectAllProviders, selectAvailableProviders, clearSelectedProviders, publishedHttpsReady, publishedHttpsReady, publishedHttpsReady, publishedBaseUrlNormalized, publishedBaseUrlNormalized, publishedBaseUrlNormalized, publishedBaseUrlLooksHttps, togglePublicationSettings, publicationSettingsOpen, copyText,];
            } },
        ...{ class: "btn btn-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
    (__VLS_ctx.$t('copyLink'));
}
if (__VLS_ctx.publishedBaseUrl) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.clearPublishedBase) },
        ...{ class: "btn btn-sm btn-ghost" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    (__VLS_ctx.$t('clear'));
}
if (__VLS_ctx.publicationSettingsOpen) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['xl:grid-cols-[minmax(0,1fr)_auto]']} */ ;
    /** @type {__VLS_StyleScopedClasses['xl:items-start']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "space-y-3" },
    });
    /** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "form-control" },
    });
    /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "label py-1" },
    });
    /** @type {__VLS_StyleScopedClasses['label']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "label-text text-xs text-base-content/70" },
    });
    /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-base-content/70']} */ ;
    (__VLS_ctx.$t('subscriptionsPublishedBase'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ class: "input input-bordered input-sm" },
        placeholder: (__VLS_ctx.$t('subscriptionsPublishedBasePlaceholder')),
    });
    (__VLS_ctx.publishedBaseUrl);
    /** @type {__VLS_StyleScopedClasses['input']} */ ;
    /** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
    /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-2xl border border-base-300 bg-base-100 p-3 text-xs text-base-content/70" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-base-content/70']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    (__VLS_ctx.$t('subscriptionsHttpsHint'));
    if (__VLS_ctx.publishedBaseUrlNormalized) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "mt-2 break-all" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "font-medium" },
        });
        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
        (__VLS_ctx.$t('subscriptionsPublishedLink'));
        (__VLS_ctx.publishedBaseUrlNormalized);
    }
}
if (!__VLS_ctx.agentReady) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "alert alert-warning shadow-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['alert']} */ ;
    /** @type {__VLS_StyleScopedClasses['alert-warning']} */ ;
    /** @type {__VLS_StyleScopedClasses['shadow-sm']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.$t('subscriptionsAgentRequired'));
}
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm" },
});
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "space-y-2" },
});
/** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
    ...{ class: "text-lg font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
(__VLS_ctx.$t('subscriptionsUsageModesTitle'));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-sm text-base-content/70" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/70']} */ ;
(__VLS_ctx.$t('subscriptionsUsageModesDesc'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-4 grid gap-4 xl:grid-cols-2" },
});
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['xl:grid-cols-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-2xl border border-success/30 bg-success/5 p-4" },
});
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-success/30']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-success/5']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-sm font-semibold text-base-content" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content']} */ ;
(__VLS_ctx.$t('subscriptionsUsageImportTitle'));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "badge badge-success badge-outline" },
});
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-success']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
(__VLS_ctx.$t('subscriptionsUsageImportBadge'));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-2 text-sm leading-6 text-base-content/75" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/75']} */ ;
(__VLS_ctx.$t('subscriptionsUsageImportDesc'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-2xl border border-warning/30 bg-warning/10 p-4" },
});
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-warning/30']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-warning/10']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-sm font-semibold text-base-content" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content']} */ ;
(__VLS_ctx.$t('subscriptionsUsageRefreshTitle'));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "badge badge-warning badge-outline" },
});
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-warning']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
(__VLS_ctx.$t('subscriptionsUsageRefreshBadge'));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-2 text-sm leading-6 text-base-content/75" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/75']} */ ;
(__VLS_ctx.$t('subscriptionsUsageRefreshDesc'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-4 rounded-2xl border border-base-300 bg-base-200/40 p-4" },
});
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200/40']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-sm font-semibold text-base-content" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content']} */ ;
(__VLS_ctx.$t('subscriptionsUsageClientsTitle'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-3 grid gap-3 lg:grid-cols-2" },
});
/** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:grid-cols-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-2xl border border-base-300 bg-base-100 px-3 py-3 text-sm" },
});
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "font-medium" },
});
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "badge badge-success badge-outline" },
});
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-success']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
(__VLS_ctx.$t('subscriptionsUsageReadyBadge'));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-2 text-sm leading-6 text-base-content/75" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/75']} */ ;
(__VLS_ctx.$t('subscriptionsUsageMihomoDesc'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-2xl border border-base-300 bg-base-100 px-3 py-3 text-sm" },
});
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "font-medium" },
});
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "badge badge-info badge-outline" },
});
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-info']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
(__VLS_ctx.$t('subscriptionsUsagePartialBadge'));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-2 text-sm leading-6 text-base-content/75" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/75']} */ ;
(__VLS_ctx.$t('subscriptionsUsageUniversalDesc'));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-2 text-sm leading-6 text-warning-content/90" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-warning-content/90']} */ ;
(__VLS_ctx.$t('subscriptionsUsageV2RayTunDesc'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid gap-4 xl:grid-cols-2" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['xl:grid-cols-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm" },
});
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between" },
});
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:flex-row']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:justify-between']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "min-w-0 flex-1" },
});
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
    ...{ class: "text-lg font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
(__VLS_ctx.$t('subscriptionsMihomoTitle'));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 text-sm text-base-content/70" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/70']} */ ;
(__VLS_ctx.$t('subscriptionsMihomoDesc'));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "badge badge-primary badge-outline self-start whitespace-nowrap shrink-0" },
});
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
/** @type {__VLS_StyleScopedClasses['self-start']} */ ;
/** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "space-y-3" },
});
/** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-2xl border border-success/30 bg-success/5 p-3 text-xs text-base-content/80" },
});
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-success/30']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-success/5']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/80']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "font-semibold text-base-content" },
});
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content']} */ ;
(__VLS_ctx.$t('subscriptionsImportReadyTitle'));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 leading-5" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
(__VLS_ctx.$t('subscriptionsImportReadyMihomoDesc'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-2xl border border-base-300 bg-base-200/40 p-3 text-xs text-base-content/75" },
});
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200/40']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/75']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "font-medium text-base-content" },
});
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content']} */ ;
(__VLS_ctx.$t('subscriptionsCurrentSourceLabel'));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "badge badge-outline" },
    ...{ class: (__VLS_ctx.effectiveMihomoUsesPublished ? 'badge-success' : 'badge-neutral') },
});
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
(__VLS_ctx.effectiveMihomoUsesPublished ? __VLS_ctx.$t('subscriptionsCurrentSourcePublished') : __VLS_ctx.$t('subscriptionsCurrentSourceLocal'));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-2 leading-5" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
(__VLS_ctx.$t('subscriptionsCurrentSourceHint'));
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "form-control" },
});
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "label py-1" },
});
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "label-text text-xs text-base-content/70" },
});
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/70']} */ ;
(__VLS_ctx.$t('subscriptionsLocalLink'));
__VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
    ...{ class: "textarea textarea-bordered min-h-28 text-xs" },
    value: (__VLS_ctx.mihomoUrl),
    readonly: true,
});
/** @type {__VLS_StyleScopedClasses['textarea']} */ ;
/** @type {__VLS_StyleScopedClasses['textarea-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-28']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
if (__VLS_ctx.publishedMihomoUrl) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "form-control" },
    });
    /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "label py-1" },
    });
    /** @type {__VLS_StyleScopedClasses['label']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "label-text text-xs text-base-content/70" },
    });
    /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-base-content/70']} */ ;
    (__VLS_ctx.$t('subscriptionsPublishedLink'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
        ...{ class: "textarea textarea-bordered min-h-24 text-xs" },
        value: (__VLS_ctx.publishedMihomoUrl),
        readonly: true,
    });
    /** @type {__VLS_StyleScopedClasses['textarea']} */ ;
    /** @type {__VLS_StyleScopedClasses['textarea-bordered']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-h-24']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.copyText(__VLS_ctx.effectiveMihomoUrl);
            // @ts-ignore
            [$t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, publishedBaseUrlNormalized, publishedBaseUrlNormalized, publicationSettingsOpen, copyText, publishedBaseUrl, publishedBaseUrl, clearPublishedBase, agentReady, effectiveMihomoUsesPublished, effectiveMihomoUsesPublished, mihomoUrl, publishedMihomoUrl, publishedMihomoUrl, effectiveMihomoUrl,];
        } },
    ...{ class: "btn btn-sm" },
    disabled: (!__VLS_ctx.effectiveMihomoUrl),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
(__VLS_ctx.$t('subscriptionsCopyCurrentUrl'));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.copyText(__VLS_ctx.mihomoUrl);
            // @ts-ignore
            [$t, copyText, mihomoUrl, effectiveMihomoUrl,];
        } },
    ...{ class: "btn btn-sm" },
    disabled: (!__VLS_ctx.mihomoUrl),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
(__VLS_ctx.$t('subscriptionsCopyLocalUrl'));
__VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
    ...{ class: "btn btn-sm btn-primary" },
    ...{ class: (!__VLS_ctx.clashDeepLink && 'btn-disabled') },
    href: (__VLS_ctx.clashDeepLink || undefined),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
(__VLS_ctx.$t('subscriptionsOpenInClash'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:grid-cols-[minmax(0,1fr)_auto]']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:items-start']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "space-y-2" },
});
/** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "form-control max-w-xs" },
});
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-xs']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "label py-1" },
});
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "label-text text-xs text-base-content/70" },
});
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/70']} */ ;
(__VLS_ctx.$t('subscriptionsQrMode'));
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (__VLS_ctx.mihomoQrMode),
    ...{ class: "select select-bordered select-sm" },
});
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "url",
});
(__VLS_ctx.$t('subscriptionsQrModeUrl'));
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "clash",
});
(__VLS_ctx.$t('subscriptionsQrModeClash'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-2xl bg-base-200/40 p-3 text-xs text-base-content/70" },
});
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200/40']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/70']} */ ;
(__VLS_ctx.$t('subscriptionsMihomoTip'));
const __VLS_0 = QrCodeSvg;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    text: (__VLS_ctx.mihomoQrText),
}));
const __VLS_2 = __VLS_1({
    text: (__VLS_ctx.mihomoQrText),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm" },
});
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between" },
});
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:flex-row']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:justify-between']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "min-w-0 flex-1" },
});
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
    ...{ class: "text-lg font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
(__VLS_ctx.$t('subscriptionsUniversalTitle'));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 text-sm text-base-content/70" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/70']} */ ;
(__VLS_ctx.$t('subscriptionsUniversalDesc'));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "badge badge-secondary badge-outline self-start whitespace-nowrap shrink-0" },
});
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
/** @type {__VLS_StyleScopedClasses['self-start']} */ ;
/** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "space-y-3" },
});
/** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-2xl border border-info/30 bg-info/10 p-3 text-xs text-base-content/80" },
});
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-info/30']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-info/10']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/80']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "font-semibold text-base-content" },
});
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content']} */ ;
(__VLS_ctx.$t('subscriptionsImportReadyTitle'));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 leading-5" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
(__VLS_ctx.$t('subscriptionsImportReadyUniversalDesc'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-2xl border border-base-300 bg-base-200/40 p-3 text-xs text-base-content/75" },
});
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200/40']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/75']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "font-medium text-base-content" },
});
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content']} */ ;
(__VLS_ctx.$t('subscriptionsCurrentSourceLabel'));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "badge badge-outline" },
    ...{ class: (__VLS_ctx.effectiveUniversalUsesPublished ? 'badge-success' : 'badge-neutral') },
});
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
(__VLS_ctx.effectiveUniversalUsesPublished ? __VLS_ctx.$t('subscriptionsCurrentSourcePublished') : __VLS_ctx.$t('subscriptionsCurrentSourceLocal'));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "badge badge-outline" },
    ...{ class: (__VLS_ctx.effectiveJsonUsesPublished ? 'badge-success' : 'badge-neutral') },
});
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
(__VLS_ctx.effectiveJsonUsesPublished ? __VLS_ctx.$t('subscriptionsCurrentSourcePublished') : __VLS_ctx.$t('subscriptionsCurrentSourceLocal'));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "badge badge-outline" },
    ...{ class: (__VLS_ctx.effectiveV2rayTunUsesPublished ? 'badge-success' : 'badge-neutral') },
});
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
(__VLS_ctx.effectiveV2rayTunUsesPublished ? __VLS_ctx.$t('subscriptionsCurrentSourcePublished') : __VLS_ctx.$t('subscriptionsCurrentSourceLocal'));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-2 leading-5" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
(__VLS_ctx.$t('subscriptionsCurrentSourceHint'));
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "form-control" },
});
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "label py-1" },
});
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "label-text text-xs text-base-content/70" },
});
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/70']} */ ;
(__VLS_ctx.$t('subscriptionsLocalLink'));
__VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
    ...{ class: "textarea textarea-bordered min-h-28 text-xs" },
    value: (__VLS_ctx.universalUrl),
    readonly: true,
});
/** @type {__VLS_StyleScopedClasses['textarea']} */ ;
/** @type {__VLS_StyleScopedClasses['textarea-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-28']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "form-control" },
});
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "label py-1" },
});
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "label-text text-xs text-base-content/70" },
});
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/70']} */ ;
(__VLS_ctx.$t('subscriptionsLocalJsonLink'));
__VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
    ...{ class: "textarea textarea-bordered min-h-24 text-xs" },
    value: (__VLS_ctx.jsonUrl),
    readonly: true,
});
/** @type {__VLS_StyleScopedClasses['textarea']} */ ;
/** @type {__VLS_StyleScopedClasses['textarea-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-24']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "form-control" },
});
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "label py-1" },
});
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "label-text text-xs text-base-content/70" },
});
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/70']} */ ;
(__VLS_ctx.$t('subscriptionsLocalV2rayTunLink'));
__VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
    ...{ class: "textarea textarea-bordered min-h-24 text-xs" },
    value: (__VLS_ctx.v2rayTunUrl),
    readonly: true,
});
/** @type {__VLS_StyleScopedClasses['textarea']} */ ;
/** @type {__VLS_StyleScopedClasses['textarea-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-24']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
if (__VLS_ctx.publishedUniversalUrl) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "form-control" },
    });
    /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "label py-1" },
    });
    /** @type {__VLS_StyleScopedClasses['label']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "label-text text-xs text-base-content/70" },
    });
    /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-base-content/70']} */ ;
    (__VLS_ctx.$t('subscriptionsPublishedLink'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
        ...{ class: "textarea textarea-bordered min-h-24 text-xs" },
        value: (__VLS_ctx.publishedUniversalUrl),
        readonly: true,
    });
    /** @type {__VLS_StyleScopedClasses['textarea']} */ ;
    /** @type {__VLS_StyleScopedClasses['textarea-bordered']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-h-24']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
}
if (__VLS_ctx.publishedJsonUrl) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "form-control" },
    });
    /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "label py-1" },
    });
    /** @type {__VLS_StyleScopedClasses['label']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "label-text text-xs text-base-content/70" },
    });
    /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-base-content/70']} */ ;
    (__VLS_ctx.$t('subscriptionsPublishedJsonLink'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
        ...{ class: "textarea textarea-bordered min-h-24 text-xs" },
        value: (__VLS_ctx.publishedJsonUrl),
        readonly: true,
    });
    /** @type {__VLS_StyleScopedClasses['textarea']} */ ;
    /** @type {__VLS_StyleScopedClasses['textarea-bordered']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-h-24']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
}
if (__VLS_ctx.publishedV2rayTunUrl) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "form-control" },
    });
    /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "label py-1" },
    });
    /** @type {__VLS_StyleScopedClasses['label']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "label-text text-xs text-base-content/70" },
    });
    /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-base-content/70']} */ ;
    (__VLS_ctx.$t('subscriptionsPublishedV2rayTunLink'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
        ...{ class: "textarea textarea-bordered min-h-24 text-xs" },
        value: (__VLS_ctx.publishedV2rayTunUrl),
        readonly: true,
    });
    /** @type {__VLS_StyleScopedClasses['textarea']} */ ;
    /** @type {__VLS_StyleScopedClasses['textarea-bordered']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-h-24']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-2xl border border-warning/30 bg-warning/10 p-3 text-xs text-base-content/80" },
});
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-warning/30']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-warning/10']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/80']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "font-semibold text-base-content" },
});
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content']} */ ;
(__VLS_ctx.$t('subscriptionsV2rayTunPendingTitle'));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 leading-5" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
(__VLS_ctx.$t('subscriptionsV2rayTunPendingDesc'));
if (__VLS_ctx.publishedHttpsReady) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-2 leading-5" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
    (__VLS_ctx.$t('subscriptionsV2rayTunPendingHttpsReady'));
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-2 leading-5" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
    (__VLS_ctx.$t('subscriptionsV2rayTunPendingLocalOnly'));
}
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-2 leading-5" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
(__VLS_ctx.$t('subscriptionsV2rayTunExperimentalNote'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.copyText(__VLS_ctx.effectiveUniversalUrl);
            // @ts-ignore
            [$t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, publishedHttpsReady, copyText, mihomoUrl, clashDeepLink, clashDeepLink, mihomoQrMode, mihomoQrText, effectiveUniversalUsesPublished, effectiveUniversalUsesPublished, effectiveJsonUsesPublished, effectiveJsonUsesPublished, effectiveV2rayTunUsesPublished, effectiveV2rayTunUsesPublished, universalUrl, jsonUrl, v2rayTunUrl, publishedUniversalUrl, publishedUniversalUrl, publishedJsonUrl, publishedJsonUrl, publishedV2rayTunUrl, publishedV2rayTunUrl, effectiveUniversalUrl,];
        } },
    ...{ class: "btn btn-sm" },
    disabled: (!__VLS_ctx.effectiveUniversalUrl),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
(__VLS_ctx.$t('subscriptionsCopyCurrentUrl'));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.copyText(__VLS_ctx.universalUrl);
            // @ts-ignore
            [$t, copyText, universalUrl, effectiveUniversalUrl,];
        } },
    ...{ class: "btn btn-sm" },
    disabled: (!__VLS_ctx.universalUrl),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
(__VLS_ctx.$t('subscriptionsCopyLocalUrl'));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.copyText(__VLS_ctx.effectiveJsonUrl);
            // @ts-ignore
            [$t, copyText, universalUrl, effectiveJsonUrl,];
        } },
    ...{ class: "btn btn-sm" },
    disabled: (!__VLS_ctx.effectiveJsonUrl),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
(__VLS_ctx.$t('subscriptionsCopyCurrentJsonUrl'));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.copyText(__VLS_ctx.effectiveV2rayTunUrl);
            // @ts-ignore
            [$t, copyText, effectiveJsonUrl, effectiveV2rayTunUrl,];
        } },
    ...{ class: "btn btn-sm" },
    disabled: (!__VLS_ctx.effectiveV2rayTunUrl),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
(__VLS_ctx.$t('subscriptionsCopyCurrentV2rayTunUrl'));
__VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
    ...{ class: "btn btn-sm" },
    ...{ class: (!__VLS_ctx.v2rayNgDeepLink && 'btn-disabled') },
    href: (__VLS_ctx.v2rayNgDeepLink || undefined),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
    ...{ class: "btn btn-sm" },
    ...{ class: (!__VLS_ctx.hiddifyDeepLink && 'btn-disabled') },
    href: (__VLS_ctx.hiddifyDeepLink || undefined),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
    ...{ class: "btn btn-sm btn-secondary" },
    ...{ class: (!__VLS_ctx.v2rayTunDeepLink && 'btn-disabled') },
    href: (__VLS_ctx.v2rayTunDeepLink || undefined),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
(__VLS_ctx.$t('subscriptionsOpenInV2rayTun'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:grid-cols-[minmax(0,1fr)_auto]']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:items-start']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "space-y-2" },
});
/** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "form-control max-w-xs" },
});
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-xs']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "label py-1" },
});
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "label-text text-xs text-base-content/70" },
});
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/70']} */ ;
(__VLS_ctx.$t('subscriptionsQrMode'));
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (__VLS_ctx.universalQrMode),
    ...{ class: "select select-bordered select-sm" },
});
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "url",
});
(__VLS_ctx.$t('subscriptionsQrModeUrl'));
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "v2rayng",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "hiddify",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "v2raytun",
});
(__VLS_ctx.$t('subscriptionsQrModeV2rayTun'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-2xl bg-base-200/40 p-3 text-xs text-base-content/70" },
});
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200/40']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/70']} */ ;
(__VLS_ctx.$t('subscriptionsUniversalTip'));
const __VLS_5 = QrCodeSvg;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
    text: (__VLS_ctx.universalQrText),
}));
const __VLS_7 = __VLS_6({
    text: (__VLS_ctx.universalQrText),
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm" },
});
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mb-3 flex flex-wrap items-center justify-between gap-2" },
});
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
    ...{ class: "text-lg font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
(__VLS_ctx.$t('subscriptionsSelectedProvidersTitle'));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "text-xs text-base-content/60" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/60']} */ ;
(__VLS_ctx.$t('subscriptionsSelectedProvidersHint'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid gap-3 md:grid-cols-2 xl:grid-cols-3" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['xl:grid-cols-3']} */ ;
for (const [provider] of __VLS_vFor((__VLS_ctx.selectedProvidersMeta))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        key: (provider.name),
        ...{ class: "rounded-2xl border border-base-300 bg-base-200/40 px-3 py-3 text-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-200/40']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-wrap items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "min-w-0 flex-1 truncate font-medium" },
    });
    /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    (provider.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-xs badge-neutral badge-outline" },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-neutral']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
    (provider.nodeCount);
    (__VLS_ctx.$t('subscriptionsNodesShort'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-xs" },
        ...{ class: (provider.health.badgeCls) },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
    (__VLS_ctx.$t(provider.health.labelKey));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-2 flex flex-wrap gap-1 text-[11px]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
    for (const [proto] of __VLS_vFor((provider.topProtocols))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            key: (`${provider.name}-selected-proto-${proto.label}`),
            ...{ class: "badge badge-xs badge-outline border-primary/30 bg-primary/5" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-primary/30']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-primary/5']} */ ;
        (proto.label);
        (proto.count);
        // @ts-ignore
        [$t, $t, $t, $t, $t, $t, $t, $t, $t, $t, effectiveV2rayTunUrl, v2rayNgDeepLink, v2rayNgDeepLink, hiddifyDeepLink, hiddifyDeepLink, v2rayTunDeepLink, v2rayTunDeepLink, universalQrMode, universalQrText, selectedProvidersMeta,];
    }
    if (!provider.topProtocols.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-xs badge-ghost" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
        (__VLS_ctx.$t('subscriptionsNoProtoHints'));
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-2 flex flex-wrap gap-1 text-[11px]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
    for (const [country] of __VLS_vFor((provider.topCountries))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            key: (`${provider.name}-selected-country-${country.code}`),
            ...{ class: "badge badge-xs badge-outline border-secondary/30 bg-secondary/5" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-secondary/30']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-secondary/5']} */ ;
        (country.flag || '🌐');
        (country.code);
        (country.count);
        // @ts-ignore
        [$t,];
    }
    if (!provider.topCountries.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-xs badge-ghost" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
        (__VLS_ctx.$t('subscriptionsMixedCountries'));
    }
    // @ts-ignore
    [$t,];
}
if (!__VLS_ctx.selectedProvidersMeta.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-sm text-base-content/60" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-base-content/60']} */ ;
    (__VLS_ctx.$t('subscriptionsNoProviders'));
}
// @ts-ignore
[$t, selectedProvidersMeta,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
