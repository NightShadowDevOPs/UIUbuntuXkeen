/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { getIPFrom2ipIoAPI, getIPFrom2ipMeGeoAPI, getIPFrom2ipMeProviderAPI, getIPFromIpipnetAPI, getIPInfoFromIPAPI, getIPInfoFromIPSB, getIPInfoFromIPWHOIS, getIPInfoFromWHATISMYIP, } from '@/api/geoip';
import { ipForChina } from '@/composables/overview';
import { useTooltip } from '@/helper/tooltip';
import { autoIPCheck, twoIpToken, twoIpTokens } from '@/store/settings';
import { BoltIcon, EyeIcon, EyeSlashIcon } from '@heroicons/vue/24/outline';
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
const showPrivacy = ref(false);
const { showTip } = useTooltip();
const handlerShowPrivacyTip = (e) => {
    showTip(e, t('ipScreenshotTip'));
};
const ipFor2ipRu = ref({ ip: [], ipWithPrivacy: [] });
const ipFor2ipIo = ref({ ip: [], ipWithPrivacy: [] });
const ipForIpsb = ref({ ip: [], ipWithPrivacy: [] });
const ipForIpwhois = ref({ ip: [], ipWithPrivacy: [] });
const ipForIpapi = ref({ ip: [], ipWithPrivacy: [] });
const ipForWhatismyip = ref({ ip: [], ipWithPrivacy: [] });
const QUERYING_IP_INFO = {
    ip: [t('getting'), ''],
    ipWithPrivacy: [t('getting'), ''],
};
const FAILED_IP_INFO = {
    ip: [t('testFailedTip'), ''],
    ipWithPrivacy: [t('testFailedTip'), ''],
};
const maskIP = (ip) => (ip ? '***.***.***.***' : '');
// 1h cache, чтобы не упираться в лимиты и не долбить источники каждый ререндер
const CACHE_TTL = 60 * 60 * 1000;
const cacheRead = (key) => {
    try {
        const raw = localStorage.getItem(key);
        if (!raw)
            return null;
        const parsed = JSON.parse(raw);
        if (!parsed?.expires || Date.now() > parsed.expires)
            return null;
        if (!parsed?.value?.ip?.length)
            return null;
        return parsed.value;
    }
    catch {
        return null;
    }
};
const cacheWrite = (key, value) => {
    try {
        localStorage.setItem(key, JSON.stringify({ expires: Date.now() + CACHE_TTL, value }));
    }
    catch {
        // ignore
    }
};
const CACHE_KEY_2IP_RU = 'cache/ipcheck-2ip-ru';
const CACHE_KEY_2IP_IO = 'cache/ipcheck-2ip-io';
const CACHE_KEY_IPSB = 'cache/ipcheck-ipsb';
const CACHE_KEY_IPWHOIS = 'cache/ipcheck-ipwhois';
const CACHE_KEY_IPAPI = 'cache/ipcheck-ipapi';
const CACHE_KEY_WHATISMYIP = 'cache/ipcheck-whatismyip-v1';
const safeText = (s) => (typeof s === 'string' ? s.trim() : '');
const pick = (obj, path) => {
    let cur = obj;
    for (const k of path) {
        if (!cur || typeof cur !== 'object')
            return undefined;
        cur = cur[k];
    }
    return cur;
};
const statusClass = (b) => {
    const v = (b?.ipWithPrivacy?.[1] || b?.ip?.[1] || '').toString().trim();
    const msg = (b?.ip?.[0] || '').toString();
    if (!v && msg === t('getting'))
        return 'text-base-content/60';
    if (!v && (msg === t('testFailedTip') || msg === t('twoIpTokenMissing')))
        return 'text-error';
    return v ? 'text-success' : 'text-base-content/60';
};
const format2ipIo = (data) => {
    const ip = safeText(data?.ip) ||
        safeText(data?.query) ||
        safeText(data?.address) ||
        safeText(pick(data, ['data', 'ip']));
    const country = safeText(data?.country) ||
        safeText(pick(data, ['geo', 'country'])) ||
        safeText(pick(data, ['location', 'country']));
    const city = safeText(data?.city) ||
        safeText(pick(data, ['geo', 'city'])) ||
        safeText(pick(data, ['location', 'city']));
    const org = safeText(data?.organization) ||
        safeText(data?.org) ||
        safeText(pick(data, ['asn', 'org'])) ||
        safeText(pick(data, ['asn', 'name'])) ||
        safeText(pick(data, ['connection', 'org'])) ||
        safeText(pick(data, ['connection', 'isp']));
    const text = [country, city, org].filter(Boolean).join(' ');
    return { text: text || t('noContent'), ip };
};
const loadGlobal = async (cacheKey, apiFn, target, force = false) => {
    const cached = !force ? cacheRead(cacheKey) : null;
    if (cached) {
        target.value = cached;
        return;
    }
    try {
        const res = await apiFn();
        const label = `${res.country} ${res.organization}`.trim() || t('noContent');
        const value = {
            ipWithPrivacy: [label, res.ip],
            ip: [label, maskIP(res.ip)],
        };
        target.value = value;
        cacheWrite(cacheKey, value);
    }
    catch {
        target.value = { ...FAILED_IP_INFO };
    }
};
const getIPs = (force = false) => {
    ipForChina.value = { ...QUERYING_IP_INFO };
    ipFor2ipRu.value = { ...QUERYING_IP_INFO };
    ipFor2ipIo.value = { ...QUERYING_IP_INFO };
    ipForIpsb.value = { ...QUERYING_IP_INFO };
    ipForIpwhois.value = { ...QUERYING_IP_INFO };
    ipForIpapi.value = { ...QUERYING_IP_INFO };
    ipForWhatismyip.value = { ...QUERYING_IP_INFO };
    // china (ipip.net)
    getIPFromIpipnetAPI()
        .then((res) => {
        ipForChina.value = {
            ipWithPrivacy: [res.data.location.join(' '), res.data.ip],
            ip: [`${res.data.location[0]} ** ** **`, maskIP(res.data.ip)],
        };
    })
        .catch(() => (ipForChina.value = { ...FAILED_IP_INFO }));
    // 2ip.ru (через публичный 2ip.me API)
    const cachedRu = !force ? cacheRead(CACHE_KEY_2IP_RU) : null;
    if (cachedRu) {
        ipFor2ipRu.value = cachedRu;
    }
    else {
        Promise.all([getIPFrom2ipMeGeoAPI(), getIPFrom2ipMeProviderAPI()])
            .then(([geo, provider]) => {
            const country = geo.country_rus || geo.country;
            const city = geo.city_rus || geo.city;
            const org = provider.name_rus || provider.name_ripe || '';
            const ip = geo.ip || provider.ip;
            const text = [country, city, org].filter(Boolean).join(' ') || t('noContent');
            const value = {
                ipWithPrivacy: [text, ip],
                ip: [text, maskIP(ip)],
            };
            ipFor2ipRu.value = value;
            cacheWrite(CACHE_KEY_2IP_RU, value);
        })
            .catch(() => (ipFor2ipRu.value = { ...FAILED_IP_INFO }));
    }
    // 2ip.io (token API) — supports multiple tokens (round-robin)
    const tokens = (twoIpTokens.value || []).map((x) => (x || '').trim()).filter(Boolean);
    const legacy = (twoIpToken.value || '').trim();
    if (legacy && !tokens.includes(legacy))
        tokens.unshift(legacy);
    if (!tokens.length) {
        ipFor2ipIo.value = {
            ipWithPrivacy: [t('twoIpTokenMissing'), ''],
            ip: [t('twoIpTokenMissing'), ''],
        };
    }
    else {
        const cachedIo = !force ? cacheRead(CACHE_KEY_2IP_IO) : null;
        if (cachedIo && tokens.length === 1) {
            ipFor2ipIo.value = cachedIo;
        }
        else {
            const cursorKey = 'cache/twoip-token-cursor';
            const start = (() => {
                const v = Number(localStorage.getItem(cursorKey) || '0');
                return Number.isFinite(v) ? v : 0;
            })();
            (async () => {
                for (let i = 0; i < tokens.length; i++) {
                    const idx = (start + i) % tokens.length;
                    const token = tokens[idx];
                    try {
                        const data = await getIPFrom2ipIoAPI(token);
                        if (!data || data.success === false)
                            throw new Error('2ip.io failed');
                        const { text, ip } = format2ipIo(data);
                        if (!ip)
                            throw new Error('2ip.io no ip');
                        const value = {
                            ipWithPrivacy: [text, ip],
                            ip: [text, maskIP(ip)],
                        };
                        ipFor2ipIo.value = value;
                        cacheWrite(CACHE_KEY_2IP_IO, value);
                        localStorage.setItem(cursorKey, String((idx + 1) % tokens.length));
                        return;
                    }
                    catch {
                        // try next token
                    }
                }
                ipFor2ipIo.value = { ...FAILED_IP_INFO };
            })();
        }
    }
    // global sources
    loadGlobal(CACHE_KEY_IPSB, () => getIPInfoFromIPSB(), ipForIpsb, force);
    loadGlobal(CACHE_KEY_IPWHOIS, () => getIPInfoFromIPWHOIS(), ipForIpwhois, force);
    loadGlobal(CACHE_KEY_IPAPI, () => getIPInfoFromIPAPI(), ipForIpapi, force);
    loadGlobal(CACHE_KEY_WHATISMYIP, () => getIPInfoFromWHATISMYIP(), ipForWhatismyip, force);
};
onMounted(() => {
    const hasAny = ipForChina.value.ip.length !== 0 ||
        ipFor2ipRu.value.ip.length !== 0 ||
        ipFor2ipIo.value.ip.length !== 0 ||
        ipForIpsb.value.ip.length !== 0 ||
        ipForIpwhois.value.ip.length !== 0 ||
        ipForIpapi.value.ip.length !== 0 ||
        ipForWhatismyip.value.ip.length !== 0;
    if (autoIPCheck.value && !hasAny)
        getIPs(false);
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "bg-base-200/50 relative flex min-h-28 flex-col gap-1 rounded-lg p-2" },
});
/** @type {__VLS_StyleScopedClasses['bg-base-200/50']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-28']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid grid-cols-[auto_auto_1fr] gap-x-2 gap-y-1" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-[auto_auto_1fr]']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-x-2']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-y-1']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: (['text-left text-sm', __VLS_ctx.statusClass(__VLS_ctx.ipForChina)]) },
});
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-right text-sm" },
});
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-sm" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
(__VLS_ctx.showPrivacy ? __VLS_ctx.ipForChina.ipWithPrivacy[0] : __VLS_ctx.ipForChina.ip[0]);
if (__VLS_ctx.ipForChina.ip[1]) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    (__VLS_ctx.showPrivacy ? __VLS_ctx.ipForChina.ipWithPrivacy[1] : __VLS_ctx.ipForChina.ip[1]);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: (['text-left text-sm', __VLS_ctx.statusClass(__VLS_ctx.ipFor2ipRu)]) },
});
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-right text-sm" },
});
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-sm" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
(__VLS_ctx.showPrivacy ? __VLS_ctx.ipFor2ipRu.ipWithPrivacy[0] : __VLS_ctx.ipFor2ipRu.ip[0]);
if (__VLS_ctx.ipFor2ipRu.ip[1]) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    (__VLS_ctx.showPrivacy ? __VLS_ctx.ipFor2ipRu.ipWithPrivacy[1] : __VLS_ctx.ipFor2ipRu.ip[1]);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: (['text-left text-sm', __VLS_ctx.statusClass(__VLS_ctx.ipFor2ipIo)]) },
});
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-right text-sm" },
});
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-sm" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
(__VLS_ctx.showPrivacy ? __VLS_ctx.ipFor2ipIo.ipWithPrivacy[0] : __VLS_ctx.ipFor2ipIo.ip[0]);
if (__VLS_ctx.ipFor2ipIo.ip[1]) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    (__VLS_ctx.showPrivacy ? __VLS_ctx.ipFor2ipIo.ipWithPrivacy[1] : __VLS_ctx.ipFor2ipIo.ip[1]);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: (['text-left text-sm', __VLS_ctx.statusClass(__VLS_ctx.ipForIpsb)]) },
});
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-right text-sm" },
});
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-sm" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
(__VLS_ctx.showPrivacy ? __VLS_ctx.ipForIpsb.ipWithPrivacy[0] : __VLS_ctx.ipForIpsb.ip[0]);
if (__VLS_ctx.ipForIpsb.ip[1]) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    (__VLS_ctx.showPrivacy ? __VLS_ctx.ipForIpsb.ipWithPrivacy[1] : __VLS_ctx.ipForIpsb.ip[1]);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: (['text-left text-sm', __VLS_ctx.statusClass(__VLS_ctx.ipForIpwhois)]) },
});
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-right text-sm" },
});
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-sm" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
(__VLS_ctx.showPrivacy ? __VLS_ctx.ipForIpwhois.ipWithPrivacy[0] : __VLS_ctx.ipForIpwhois.ip[0]);
if (__VLS_ctx.ipForIpwhois.ip[1]) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    (__VLS_ctx.showPrivacy ? __VLS_ctx.ipForIpwhois.ipWithPrivacy[1] : __VLS_ctx.ipForIpwhois.ip[1]);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: (['text-left text-sm', __VLS_ctx.statusClass(__VLS_ctx.ipForIpapi)]) },
});
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-right text-sm" },
});
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-sm" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
(__VLS_ctx.showPrivacy ? __VLS_ctx.ipForIpapi.ipWithPrivacy[0] : __VLS_ctx.ipForIpapi.ip[0]);
if (__VLS_ctx.ipForIpapi.ip[1]) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    (__VLS_ctx.showPrivacy ? __VLS_ctx.ipForIpapi.ipWithPrivacy[1] : __VLS_ctx.ipForIpapi.ip[1]);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: (['text-left text-sm', __VLS_ctx.statusClass(__VLS_ctx.ipForWhatismyip)]) },
});
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-right text-sm" },
});
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-sm" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
(__VLS_ctx.showPrivacy ? __VLS_ctx.ipForWhatismyip.ipWithPrivacy[0] : __VLS_ctx.ipForWhatismyip.ip[0]);
if (__VLS_ctx.ipForWhatismyip.ip[1]) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    (__VLS_ctx.showPrivacy ? __VLS_ctx.ipForWhatismyip.ipWithPrivacy[1] : __VLS_ctx.ipForWhatismyip.ip[1]);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "absolute right-2 bottom-2 flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['right-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bottom-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.showPrivacy = !__VLS_ctx.showPrivacy;
            // @ts-ignore
            [statusClass, statusClass, statusClass, statusClass, statusClass, statusClass, statusClass, ipForChina, ipForChina, ipForChina, ipForChina, ipForChina, ipForChina, showPrivacy, showPrivacy, showPrivacy, showPrivacy, showPrivacy, showPrivacy, showPrivacy, showPrivacy, showPrivacy, showPrivacy, showPrivacy, showPrivacy, showPrivacy, showPrivacy, showPrivacy, showPrivacy, ipFor2ipRu, ipFor2ipRu, ipFor2ipRu, ipFor2ipRu, ipFor2ipRu, ipFor2ipRu, ipFor2ipIo, ipFor2ipIo, ipFor2ipIo, ipFor2ipIo, ipFor2ipIo, ipFor2ipIo, ipForIpsb, ipForIpsb, ipForIpsb, ipForIpsb, ipForIpsb, ipForIpsb, ipForIpwhois, ipForIpwhois, ipForIpwhois, ipForIpwhois, ipForIpwhois, ipForIpwhois, ipForIpapi, ipForIpapi, ipForIpapi, ipForIpapi, ipForIpapi, ipForIpapi, ipForWhatismyip, ipForWhatismyip, ipForWhatismyip, ipForWhatismyip, ipForWhatismyip, ipForWhatismyip,];
        } },
    ...{ onMouseenter: (__VLS_ctx.handlerShowPrivacyTip) },
    ...{ class: "btn btn-circle btn-sm flex items-center justify-center" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
if (__VLS_ctx.showPrivacy) {
    let __VLS_0;
    /** @ts-ignore @type {typeof __VLS_components.EyeIcon} */
    EyeIcon;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        ...{ class: "h-4 w-4" },
    }));
    const __VLS_2 = __VLS_1({
        ...{ class: "h-4 w-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
}
else {
    let __VLS_5;
    /** @ts-ignore @type {typeof __VLS_components.EyeSlashIcon} */
    EyeSlashIcon;
    // @ts-ignore
    const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
        ...{ class: "h-4 w-4" },
    }));
    const __VLS_7 = __VLS_6({
        ...{ class: "h-4 w-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_6));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.getIPs(true);
            // @ts-ignore
            [showPrivacy, handlerShowPrivacyTip, getIPs,];
        } },
    ...{ class: "btn btn-circle btn-sm" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
let __VLS_10;
/** @ts-ignore @type {typeof __VLS_components.BoltIcon} */
BoltIcon;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
    ...{ class: "h-4 w-4" },
}));
const __VLS_12 = __VLS_11({
    ...{ class: "h-4 w-4" },
}, ...__VLS_functionalComponentArgsRest(__VLS_11));
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
