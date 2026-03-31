import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
const uiBuildId = ref(__APP_BUILD_ID__);
const currentBundleTag = ref('—');
const onlineBundleTag = ref('—');
const isUiBuildChecking = ref(false);
const uiBuildCheckError = ref('');
const lastUiBuildCheckedAt = ref(0);
const BUNDLE_SELECTOR = 'script[src], link[rel="modulepreload"][href], link[rel="stylesheet"][href]';
const normalizeAssetUrl = (raw) => {
    const value = String(raw || '').trim();
    if (!value || value.startsWith('blob:') || value.startsWith('data:'))
        return '';
    try {
        const url = new URL(value, window.location.href);
        return `${url.pathname}${url.search}`;
    }
    catch {
        return value.split('#')[0] || '';
    }
};
const basename = (path) => {
    const clean = path.split('?')[0] || path;
    const parts = clean.split('/').filter(Boolean);
    return (parts.length ? parts[parts.length - 1] : clean) || '—';
};
const formatBundleTag = (entries) => {
    if (!entries.length)
        return '—';
    return entries.map(basename).join(' · ');
};
const extractBundleEntriesFromDocument = (doc) => {
    const nodes = Array.from(doc.querySelectorAll(BUNDLE_SELECTOR));
    return Array.from(new Set(nodes
        .map((node) => {
        if ('src' in node && node.src)
            return normalizeAssetUrl(node.src);
        return normalizeAssetUrl(node.getAttribute('href'));
    })
        .filter((entry) => entry && (entry.includes('/assets/') || entry.includes('/src/'))))).sort();
};
const extractBundleEntriesFromHtml = (html) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    return extractBundleEntriesFromDocument(doc);
};
const refreshCurrentBundleTag = () => {
    currentBundleTag.value = formatBundleTag(extractBundleEntriesFromDocument(document));
};
const fetchOnlineBundleTag = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set('_ui_build_check', String(Date.now()));
    const response = await fetch(url.toString(), {
        cache: 'no-store',
        headers: {
            'Cache-Control': 'no-cache, no-store, max-age=0',
            Pragma: 'no-cache',
        },
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    const html = await response.text();
    const bundleEntries = extractBundleEntriesFromHtml(html);
    onlineBundleTag.value = formatBundleTag(bundleEntries);
    lastUiBuildCheckedAt.value = Date.now();
    return onlineBundleTag.value;
};
const isFreshUiBuildAvailable = computed(() => {
    return Boolean(currentBundleTag.value !== '—' && onlineBundleTag.value !== '—' && currentBundleTag.value !== onlineBundleTag.value);
});
const uiBuildStatusKey = computed(() => {
    if (isUiBuildChecking.value)
        return 'uiCacheStatusChecking';
    if (uiBuildCheckError.value)
        return 'uiCacheStatusCheckFailed';
    if (isFreshUiBuildAvailable.value)
        return 'uiCacheStatusNewBuild';
    if (onlineBundleTag.value !== '—' && currentBundleTag.value !== '—')
        return 'uiCacheStatusCurrent';
    return 'uiCacheStatusUnknown';
});
const checkFreshUiBuild = async () => {
    if (isUiBuildChecking.value)
        return false;
    isUiBuildChecking.value = true;
    uiBuildCheckError.value = '';
    try {
        refreshCurrentBundleTag();
        await fetchOnlineBundleTag();
        return isFreshUiBuildAvailable.value;
    }
    catch (error) {
        uiBuildCheckError.value = error instanceof Error ? error.message : String(error);
        return false;
    }
    finally {
        isUiBuildChecking.value = false;
    }
};
const hardRefreshUiCache = async () => {
    try {
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.allSettled(registrations.map((registration) => registration.unregister()));
        }
        if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.allSettled(keys.map((key) => caches.delete(key)));
        }
    }
    catch {
        // best effort only
    }
    const url = new URL(window.location.href);
    url.searchParams.set('_ui_reload', String(Date.now()));
    window.location.replace(url.toString());
};
let lastAutoCheckAt = 0;
let uiBuildVisibilityAttached = false;
let uiBuildConsumerCount = 0;
const AUTO_CHECK_COOLDOWN_MS = 8000;
const AUTO_RECHECK_AFTER_MS = 5 * 60 * 1000;
const maybeCheckFreshUiBuild = (force = false) => {
    refreshCurrentBundleTag();
    const now = Date.now();
    const shouldCheck = force
        || !lastUiBuildCheckedAt.value
        || now - lastUiBuildCheckedAt.value > AUTO_RECHECK_AFTER_MS
        || now - lastAutoCheckAt > AUTO_CHECK_COOLDOWN_MS;
    if (!shouldCheck)
        return;
    lastAutoCheckAt = now;
    void checkFreshUiBuild();
};
const handleVisibilityChange = () => {
    if (document.visibilityState !== 'visible')
        return;
    maybeCheckFreshUiBuild();
};
const attachUiBuildVisibilityListener = () => {
    if (uiBuildVisibilityAttached)
        return;
    document.addEventListener('visibilitychange', handleVisibilityChange);
    uiBuildVisibilityAttached = true;
};
const detachUiBuildVisibilityListener = () => {
    if (!uiBuildVisibilityAttached || uiBuildConsumerCount > 0)
        return;
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    uiBuildVisibilityAttached = false;
};
export const useUiBuild = () => {
    onMounted(() => {
        uiBuildConsumerCount += 1;
        attachUiBuildVisibilityListener();
        maybeCheckFreshUiBuild();
    });
    onBeforeUnmount(() => {
        uiBuildConsumerCount = Math.max(0, uiBuildConsumerCount - 1);
        detachUiBuildVisibilityListener();
    });
    return {
        uiBuildId,
        currentBundleTag,
        onlineBundleTag,
        isUiBuildChecking,
        isFreshUiBuildAvailable,
        uiBuildStatusKey,
        uiBuildCheckError,
        lastUiBuildCheckedAt,
        checkFreshUiBuild,
        hardRefreshUiCache,
    };
};
