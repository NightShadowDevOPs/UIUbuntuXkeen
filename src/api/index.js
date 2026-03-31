import { APP_RELEASES_API_URL } from '@/config/project';
import { ROUTE_NAME } from '@/constant';
import { showNotification } from '@/helper/notification';
import { getUrlFromBackend } from '@/helper/utils';
import router from '@/router';
import { autoUpgradeCore, checkUpgradeCore } from '@/store/settings';
import { activeBackend, activeUuid } from '@/store/setup';
import axios from 'axios';
import { debounce } from 'lodash';
import ReconnectingWebSocket from 'reconnectingwebsocket';
import { computed, nextTick, ref, watch } from 'vue';
axios.interceptors.request.use((config) => {
    config.baseURL = getUrlFromBackend(activeBackend.value);
    config.headers['Authorization'] = 'Bearer ' + activeBackend.value?.password;
    return config;
});
axios.interceptors.response.use(null, (error) => {
    if (error.status === 401 && activeUuid.value) {
        const currentBackendUuid = activeUuid.value;
        activeUuid.value = null;
        router.push({
            name: ROUTE_NAME.setup,
            query: { editBackend: currentBackendUuid },
        });
        nextTick(() => {
            showNotification({ content: 'unauthorizedTip' });
        });
    }
    else if (!error.config?.url?.endsWith('/delay')) {
        const h = error.config?.headers || {};
        const silent = error.config?.silent === true ||
            h['X-Zash-Silent'] ||
            h['x-zash-silent'] ||
            h['X-ZASH-SILENT'] ||
            h?.get?.('X-Zash-Silent') ||
            h?.get?.('x-zash-silent');
        if (silent) {
            return Promise.reject(error);
        }
        const errorMessage = error.response?.data?.message || error.message;
        showNotification({
            key: errorMessage,
            content: errorMessage,
            type: 'alert-error',
        });
        return Promise.reject(error);
    }
    return error;
});
export const version = ref();
export const isCoreUpdateAvailable = ref(false);
export const fetchVersionAPI = () => {
    return axios.get('/version');
};
export const fetchVersionSilentAPI = () => {
    return axios.get('/version', {
        timeout: 4000,
        silent: true,
        headers: { 'X-Zash-Silent': '1' },
    });
};
export const isSingBox = computed(() => version.value?.includes('sing-box'));
export const zashboardVersion = ref(__APP_VERSION__);
watch(activeBackend, async (val) => {
    if (val) {
        const { data } = await fetchVersionAPI();
        version.value = data?.version || '';
        if (isSingBox.value || !checkUpgradeCore.value || activeBackend.value?.disableUpgradeCore)
            return;
        isCoreUpdateAvailable.value = await fetchBackendUpdateAvailableAPI();
        if (isCoreUpdateAvailable.value && autoUpgradeCore.value) {
            upgradeCoreAPI('auto');
        }
    }
}, { immediate: true });
export const fetchProxiesAPI = () => {
    return axios.get('/proxies');
};
export const selectProxyAPI = (proxyGroup, name) => {
    return axios.put(`/proxies/${encodeURIComponent(proxyGroup)}`, { name });
};
export const deleteFixedProxyAPI = (proxyGroup) => {
    return axios.delete(`/proxies/${encodeURIComponent(proxyGroup)}`);
};
export const fetchProxyLatencyAPI = (proxyName, url, timeout) => {
    return axios.get(`/proxies/${encodeURIComponent(proxyName)}/delay`, {
        params: {
            url,
            timeout,
        },
    });
};
export const fetchProxyGroupLatencyAPI = (proxyName, url, timeout) => {
    return axios.get(`/group/${encodeURIComponent(proxyName)}/delay`, {
        params: {
            url,
            timeout,
        },
    });
};
export const fetchSmartGroupWeightsAPI = (proxyName) => {
    return axios.get(`/group/${encodeURIComponent(proxyName)}/weights`);
};
export const flushSmartGroupWeightsAPI = () => {
    return axios.post(`/cache/smart/flush`);
};
export const fetchProxyProviderAPI = () => {
    return axios.get('/providers/proxies');
};
export const updateProxyProviderAPI = (name) => {
    return axios.put(`/providers/proxies/${encodeURIComponent(name)}`);
};
export const proxyProviderHealthCheckAPI = (name) => {
    return axios.get(`/providers/proxies/${encodeURIComponent(name)}/healthcheck`, {
        timeout: 15000,
    });
};
export const fetchRulesAPI = () => {
    return axios.get('/rules');
};
export const fetchRuleProvidersAPI = () => {
    return axios.get('/providers/rules');
};
export const updateRuleProviderAPI = (name) => {
    return axios.put(`/providers/rules/${encodeURIComponent(name)}`);
};
export const updateRuleProviderSilentAPI = (name) => {
    return axios.put(`/providers/rules/${encodeURIComponent(name)}`, null, {
        timeout: 15000,
        silent: true,
        headers: { 'X-Zash-Silent': '1' },
    });
};
export const disconnectByIdAPI = (id) => {
    return axios.delete(`/connections/${id}`);
};
export const disconnectByIdSilentAPI = (id) => {
    return axios.delete(`/connections/${id}`, {
        silent: true,
        headers: { 'X-Zash-Silent': '1' },
    });
};
export const disconnectAllAPI = () => {
    return axios.delete('/connections');
};
export const getConfigsAPI = () => {
    return axios.get('/configs');
};
export const getConfigsSilentAPI = () => {
    return axios.get('/configs', {
        timeout: 6000,
        silent: true,
        headers: { 'X-Zash-Silent': '1' },
    });
};
export const getConfigsRawAPI = (cfg) => {
    return axios.get('/configs', {
        params: cfg?.path ? { path: cfg.path } : undefined,
        // на некоторых сборках это может вернуть YAML/text
        responseType: 'text',
        headers: {
            Accept: 'text/plain, application/x-yaml, application/yaml, */*',
        },
    });
};
export const patchConfigsAPI = (configs) => {
    return axios.patch('/configs', configs);
};
export const patchConfigsSilentAPI = (configs) => {
    return axios.patch('/configs', configs, {
        timeout: 8000,
        silent: true,
        headers: { 'X-Zash-Silent': '1' },
    });
};
export const flushFakeIPAPI = () => {
    return axios.post('/cache/fakeip/flush');
};
export const flushDNSCacheAPI = () => {
    return axios.post('/cache/dns/flush');
};
export const reloadConfigsAPI = (cfg) => {
    return axios.put('/configs?reload=true', {
        path: cfg?.path ?? '',
        payload: cfg?.payload ?? '',
    });
};
export const upgradeUIAPI = () => {
    return axios.post('/upgrade/ui');
};
export const updateGeoDataAPI = () => {
    return axios.post('/configs/geo');
};
export const upgradeCoreAPI = (type) => {
    const url = type === 'auto' ? '/upgrade' : `/upgrade?channel=${type}`;
    return axios.post(url);
};
export const restartCoreAPI = () => {
    return axios.post('/restart');
};
export const queryDNSAPI = (params) => {
    return axios.get('/dns/query', {
        params,
    });
};
const createWebSocket = (url, searchParams) => {
    const backend = activeBackend.value;
    const resurl = new URL(`${getUrlFromBackend(backend).replace('http', 'ws')}/${url}`);
    resurl.searchParams.append('token', backend?.password || '');
    if (searchParams) {
        Object.entries(searchParams).forEach(([key, value]) => {
            resurl.searchParams.append(key, value);
        });
    }
    const data = ref();
    const websocket = new ReconnectingWebSocket(resurl.toString());
    const close = () => {
        websocket.close();
    };
    const messageHandler = ({ data: message }) => {
        data.value = JSON.parse(message);
    };
    websocket.onmessage = url === 'logs' ? messageHandler : debounce(messageHandler, 100);
    return {
        data,
        close,
    };
};
export const fetchConnectionsAPI = () => {
    return createWebSocket('connections');
};
export const fetchLogsAPI = (params = {}) => {
    return createWebSocket('logs', params);
};
export const fetchMemoryAPI = () => {
    return createWebSocket('memory');
};
export const fetchTrafficAPI = () => {
    return createWebSocket('traffic');
};
export const isBackendAvailable = async (backend, timeout = 10000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
        const res = await fetch(`${getUrlFromBackend(backend)}/version`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${backend.password}`,
            },
            signal: controller.signal,
        });
        return res.ok;
    }
    catch {
        return false;
    }
    finally {
        clearTimeout(timeoutId);
    }
};
const CACHE_DURATION = 1000 * 60 * 60;
async function fetchWithLocalCache(url, version) {
    const cacheKey = 'cache/' + url;
    const cacheRaw = localStorage.getItem(cacheKey);
    if (cacheRaw) {
        try {
            const cache = JSON.parse(cacheRaw);
            const now = Date.now();
            if (now - cache.timestamp < CACHE_DURATION && cache.version === version) {
                return cache.data;
            }
            else {
                localStorage.removeItem(cacheKey);
            }
        }
        catch (e) {
            console.warn('Failed to parse cache for', url, e);
        }
    }
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    const newCache = {
        timestamp: Date.now(),
        version,
        data,
    };
    localStorage.setItem(cacheKey, JSON.stringify(newCache));
    return data;
}
export const fetchIsUIUpdateAvailable = async () => {
    const { tag_name } = await fetchWithLocalCache(APP_RELEASES_API_URL, zashboardVersion.value);
    return Boolean(tag_name && tag_name !== `v${zashboardVersion.value}`);
};
const check = async (url, versionNumber) => {
    const { assets } = await fetchWithLocalCache(url, versionNumber);
    const alreadyLatest = assets.some(({ name }) => name.includes(versionNumber));
    return !alreadyLatest;
};
export const fetchBackendUpdateAvailableAPI = async () => {
    const match = /(alpha-smart|alpha|beta|meta)-?(\w+)/.exec(version.value);
    if (!match) {
        const { tag_name } = await fetchWithLocalCache('https://api.github.com/repos/MetaCubeX/mihomo/releases/latest', version.value);
        return Boolean(tag_name && !tag_name.endsWith(version.value));
    }
    const channel = match[1], versionNumber = match[2];
    if (channel === 'meta')
        return await check('https://api.github.com/repos/MetaCubeX/mihomo/releases/latest', versionNumber);
    if (channel === 'alpha')
        return await check('https://api.github.com/repos/MetaCubeX/mihomo/releases/tags/Prerelease-Alpha', versionNumber);
    if (channel === 'alpha-smart')
        return await check('https://api.github.com/repos/vernesong/mihomo/releases/tags/Prerelease-Alpha', versionNumber);
    return false;
};
