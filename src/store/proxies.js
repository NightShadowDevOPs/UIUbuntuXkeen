import { deleteFixedProxyAPI, disconnectByIdAPI, fetchProxiesAPI, fetchProxyGroupLatencyAPI, fetchProxyLatencyAPI, fetchProxyProviderAPI, isSingBox, selectProxyAPI, } from '@/api';
import { GLOBAL, IPV6_TEST_URL, NOT_CONNECTED, PROXY_TAB_TYPE, PROXY_TYPE, TEST_URL, } from '@/constant';
import { isProxyGroup } from '@/helper';
import { showNotification } from '@/helper/notification';
import { useStorage } from '@vueuse/core';
import { last } from 'lodash';
import { computed, ref } from 'vue';
import { activeConnections } from './connections';
import { automaticDisconnection, iconReflectList, independentLatencyTest, IPv6test, speedtestTimeout, speedtestUrl, } from './settings';
import { fetchSmartGroupWeights } from './smart';
export const proxiesFilter = ref('');
export const proxiesTabShow = ref(PROXY_TAB_TYPE.PROXIES);
export const proxyGroupList = ref([]);
export const proxyMap = ref({});
export const IPv6Map = useStorage('config/ipv6-map', {});
export const hiddenGroupMap = useStorage('config/hidden-group-map', {});
export const proxyProviederList = ref([]);
const speedtestUrlWithDefault = computed(() => {
    return speedtestUrl.value || TEST_URL;
});
export const getTestUrl = (groupName) => {
    if (!groupName || !independentLatencyTest.value) {
        return speedtestUrlWithDefault.value;
    }
    const proxyNode = proxyMap.value[groupName] || proxyProviederList.value.find((p) => p.name === groupName);
    return proxyNode?.testUrl || speedtestUrlWithDefault.value;
};
export const getLatencyByName = (proxyName, groupName) => {
    const history = getHistoryByName(proxyName, groupName);
    return getLatencyFromHistory(history);
};
export const getHistoryByName = (proxyName, groupName) => {
    if (independentLatencyTest.value && !isSingBox.value) {
        const proxyNode = proxyMap.value[proxyName];
        return proxyNode?.extra?.[getTestUrl(groupName)]?.history;
    }
    const nowNode = proxyMap.value[getNowProxyNodeName(proxyName)];
    return nowNode?.history;
};
export const getIPv6ByName = (proxyName) => {
    return IPv6Map.value[getNowProxyNodeName(proxyName)];
};
let fetchTime = 0;
const isLikelyProxyProvider = (provider) => {
    if (!provider || typeof provider !== 'object')
        return false;
    if (String(provider?.name || '').trim() === 'default')
        return false;
    // Proxy-providers expose a proxies array. Rule-providers do not.
    // Some broken/partial payloads may still include an empty proxies list, and that is fine.
    return Array.isArray(provider.proxies);
};
export const fetchProxies = async () => {
    const nowTime = Date.now();
    fetchTime = nowTime;
    const [proxyRes, providerRes] = await Promise.all([fetchProxiesAPI(), fetchProxyProviderAPI()]);
    const proxyData = proxyRes.data;
    const providerData = providerRes.data;
    if (fetchTime !== nowTime) {
        return;
    }
    const sortIndex = proxyData.proxies[GLOBAL].all ?? [];
    const allProviderProxies = {};
    const providers = Object.values(providerData.providers || {}).filter(isLikelyProxyProvider);
    for (const provider of providers) {
        for (const proxy of provider.proxies) {
            allProviderProxies[proxy.name] = proxy;
        }
    }
    // Update reactive stores in-place to avoid full-list re-creation that looks like a page reload.
    const nextProxyMap = {
        ...allProviderProxies,
        ...proxyData.proxies,
    };
    // proxyMap: mutate in-place to keep object identity stable for components.
    const curMap = (proxyMap.value || {});
    for (const k of Object.keys(curMap)) {
        if (!(k in nextProxyMap))
            delete curMap[k];
    }
    for (const [k, v] of Object.entries(nextProxyMap)) {
        if (curMap[k] && typeof curMap[k] === 'object') {
            Object.assign(curMap[k], v);
        }
        else {
            curMap[k] = v;
        }
    }
    // Avoid re-assigning the ref when we mutated the existing object in-place.
    if (proxyMap.value !== curMap) {
        proxyMap.value = curMap;
    }
    const nextProxyGroupList = Object.values(proxyData.proxies)
        .filter((proxy) => proxy.all?.length && proxy.name !== GLOBAL)
        .sort((prev, next) => {
        const prevIndex = sortIndex.indexOf(prev.name);
        const nextIndex = sortIndex.indexOf(next.name);
        if (prevIndex === -1 && nextIndex === -1) {
            return 0;
        }
        if (prevIndex === -1) {
            return 1;
        }
        if (nextIndex === -1) {
            return -1;
        }
        // 都在 sortIndex 中，按索引排序
        return prevIndex - nextIndex;
    })
        .map((proxy) => proxy.name);
    proxyGroupList.value.splice(0, proxyGroupList.value.length, ...nextProxyGroupList);
    // proxyProviederList: keep array identity stable; reuse existing provider objects when possible.
    const curProviders = proxyProviederList.value || [];
    const byName = new Map();
    for (const p of curProviders)
        byName.set(String(p?.name || ''), p);
    const nextProviders = providers.map((p) => {
        const old = byName.get(String(p?.name || ''));
        if (old && typeof old === 'object') {
            Object.assign(old, p);
            return old;
        }
        return p;
    });
    proxyProviederList.value.splice(0, proxyProviederList.value.length, ...nextProviders);
    Object.entries(proxyMap.value).forEach(([name, proxy]) => {
        const iconReflect = iconReflectList.value.find((icon) => icon.name === name);
        if (iconReflect) {
            proxyMap.value[name].icon = iconReflect.icon;
        }
        if (IPv6test.value && getIPv6FromExtra(proxy)) {
            IPv6Map.value[name] = true;
        }
        if (proxy.type.toLowerCase() === PROXY_TYPE.Smart) {
            fetchSmartGroupWeights(name);
        }
    });
};
let providerFetchTime = 0;
let providerEmptyStreak = 0;
/**
 * Fetch ONLY proxy providers (no full proxies/groups refresh).
 * Used after provider health-check/update to avoid re-rendering the whole Providers page.
 */
export const fetchProxyProvidersOnly = async () => {
    const nowTime = Date.now();
    providerFetchTime = nowTime;
    const providerRes = await fetchProxyProviderAPI();
    const providerData = providerRes.data;
    if (providerFetchTime !== nowTime) {
        return;
    }
    const providers = Object.values(providerData.providers || {}).filter(isLikelyProxyProvider);
    // Mihomo/uhttpd can occasionally return an empty providers payload during short reload windows.
    // Do NOT clear the whole Providers page on a single empty response — keep the last known-good state.
    if (providers.length === 0) {
        providerEmptyStreak++;
        if ((proxyProviederList.value?.length || 0) > 0 && providerEmptyStreak < 2) {
            return;
        }
    }
    else {
        providerEmptyStreak = 0;
    }
    // Track old provider proxy names to remove stale ones.
    const oldProviderProxyNames = new Set();
    for (const p of (proxyProviederList.value || [])) {
        for (const n of (p?.proxies || [])) {
            const nm = String(n?.name || '').trim();
            if (nm)
                oldProviderProxyNames.add(nm);
        }
    }
    // proxyProviederList: keep array identity stable; reuse existing provider objects when possible.
    const curProviders = proxyProviederList.value || [];
    const byName = new Map();
    for (const p of curProviders)
        byName.set(String(p?.name || ''), p);
    const nextProviders = providers.map((p) => {
        const old = byName.get(String(p?.name || ''));
        if (old && typeof old === 'object') {
            Object.assign(old, p);
            return old;
        }
        return p;
    });
    proxyProviederList.value.splice(0, proxyProviederList.value.length, ...nextProviders);
    // proxyMap: update only provider nodes, in-place.
    const curMap = (proxyMap.value || {});
    const newProviderProxyNames = new Set();
    for (const pr of providers) {
        for (const node of (pr?.proxies || [])) {
            const name = String(node?.name || '').trim();
            if (!name)
                continue;
            newProviderProxyNames.add(name);
            if (curMap[name] && typeof curMap[name] === 'object') {
                Object.assign(curMap[name], node);
            }
            else {
                curMap[name] = node;
            }
        }
    }
    // Remove stale provider proxy nodes that disappeared.
    for (const nm of oldProviderProxyNames) {
        if (!newProviderProxyNames.has(nm)) {
            delete curMap[nm];
        }
    }
    // Avoid re-assigning the ref when we mutated the existing object in-place.
    // Re-assigning (even the same object) can trigger a large re-render that looks like a full page reload.
    if (proxyMap.value !== curMap) {
        proxyMap.value = curMap;
    }
};
/**
 * Fetch providers list but patch ONLY a single provider (and its nodes) into the store.
 * This minimizes reactive churn so updating one provider does not "reload" the whole Providers page.
 */
export const fetchProxyProviderByNameOnly = async (providerName) => {
    const providerRes = await fetchProxyProviderAPI();
    const providerData = providerRes.data;
    const all = Object.values(providerData.providers || {}).filter(isLikelyProxyProvider);
    const found = all.find((p) => String(p?.name || '') === providerName);
    if (!found)
        return;
    // Ensure ref objects exist.
    if (!proxyProviederList.value)
        proxyProviederList.value = [];
    if (!proxyMap.value)
        proxyMap.value = {};
    // Patch provider object in-place if it exists.
    const list = proxyProviederList.value;
    const idx = list.findIndex((p) => String(p?.name || '') === providerName);
    const oldProvider = idx >= 0 ? list[idx] : null;
    const oldNodes = new Set();
    if (oldProvider?.proxies?.length) {
        for (const n of oldProvider.proxies) {
            const nm = String(n?.name || '').trim();
            if (nm)
                oldNodes.add(nm);
        }
    }
    if (oldProvider && typeof oldProvider === 'object') {
        Object.assign(oldProvider, found);
    }
    else {
        list.push(found);
    }
    // Patch provider nodes into proxyMap in-place.
    const curMap = proxyMap.value;
    const newNodes = new Set();
    for (const node of (found.proxies || [])) {
        const nm = String(node?.name || '').trim();
        if (!nm)
            continue;
        newNodes.add(nm);
        if (curMap[nm] && typeof curMap[nm] === 'object')
            Object.assign(curMap[nm], node);
        else
            curMap[nm] = node;
    }
    // Remove disappeared nodes for this provider only.
    for (const nm of oldNodes) {
        if (!newNodes.has(nm))
            delete curMap[nm];
    }
};
export const handlerProxySelect = async (proxyGroupName, proxyName) => {
    const proxyGroup = proxyMap.value[proxyGroupName];
    if (proxyGroup.type.toLowerCase() === PROXY_TYPE.LoadBalance)
        return;
    if (proxyGroup.now === proxyName) {
        await fetchProxies();
        if (proxyGroup.now === proxyName)
            return;
    }
    await selectProxyAPI(proxyGroupName, proxyName);
    proxyMap.value[proxyGroupName].now = proxyName;
    if (automaticDisconnection.value) {
        activeConnections.value
            .filter((c) => c.chains.includes(proxyGroupName))
            .forEach((c) => disconnectByIdAPI(c.id));
    }
    fetchProxies();
};
const latencyTestForSingle = async (proxyName, url, timeout) => {
    const now = getNowProxyNodeName(proxyName);
    if (IPv6test.value) {
        try {
            const { data: ipv6LatencyResult } = await fetchProxyLatencyAPI(now, IPV6_TEST_URL, 2000);
            IPv6Map.value[now] = ipv6LatencyResult.delay > NOT_CONNECTED;
        }
        catch {
            IPv6Map.value[now] = false;
        }
    }
    return await fetchProxyLatencyAPI(independentLatencyTest.value ? proxyName : now, url, timeout);
};
export const proxyLatencyTest = async (proxyName, url = speedtestUrlWithDefault.value, timeout = speedtestTimeout.value) => {
    const res = await latencyTestForSingle(proxyName, url, timeout);
    await fetchProxies();
    if (res.status !== 200) {
        showNotification({
            content: 'testFailedTip',
            type: 'alert-error',
            timeout: 2000,
        });
    }
};
const latencyTip = (finished, total, failed) => {
    const isFinished = finished === total;
    if (isFinished) {
        showNotification({
            content: 'testFinishedResultTip',
            key: 'latencyTestResult',
            params: {
                success: `${total - failed}`,
                failed: `${failed}`,
            },
            type: failed ? 'alert-warning' : 'alert-success',
            timeout: 2000,
        });
    }
    else {
        showNotification({
            content: 'testFinishedTip',
            key: 'latencyTestResult',
            params: {
                number: `${finished}/${total}`,
            },
            type: 'alert-info',
            timeout: 0,
        });
    }
};
const setHistory = (proxyName, delay) => {
    const history = getHistoryByName(proxyName);
    const now = new Date();
    history.push({
        time: now.toISOString(),
        delay,
    });
};
const testLatencyOneByOneWithTip = async (nodes, url = speedtestUrlWithDefault.value) => {
    let testDone = 0;
    let testFailed = 0;
    await Promise.allSettled(nodes.map(async (name) => {
        try {
            const res = await latencyTestForSingle(name, url, Math.min(3000, speedtestTimeout.value));
            testDone++;
            if (res.status !== 200) {
                testFailed++;
                setHistory(name, NOT_CONNECTED);
            }
            else {
                setHistory(name, res.data.delay);
            }
            latencyTip(testDone, nodes.length, testFailed);
            return res;
        }
        catch (error) {
            testDone++;
            testFailed++;
            latencyTip(testDone, nodes.length, testFailed);
            throw error;
        }
    }));
    await fetchProxies();
};
export const proxyGroupLatencyTest = async (proxyGroupName) => {
    const proxyNode = proxyMap.value[proxyGroupName];
    const all = proxyNode.all ?? [];
    const url = getTestUrl(proxyGroupName);
    if ([PROXY_TYPE.Selector, PROXY_TYPE.LoadBalance, PROXY_TYPE.Smart].includes(proxyNode.type.toLowerCase())) {
        if (proxyNode.fixed) {
            deleteFixedProxyAPI(proxyGroupName);
        }
        return testLatencyOneByOneWithTip(all, url);
    }
    const timeout = Math.max(5000, speedtestTimeout.value);
    if (IPv6test.value) {
        try {
            const { data: ipv6LatencyResult } = await fetchProxyGroupLatencyAPI(proxyGroupName, IPV6_TEST_URL, timeout);
            all?.forEach((name) => {
                IPv6Map.value[getNowProxyNodeName(name)] = ipv6LatencyResult[name] > NOT_CONNECTED;
            });
        }
        catch {
            all?.forEach((name) => {
                IPv6Map.value[getNowProxyNodeName(name)] = false;
            });
        }
    }
    await fetchProxyGroupLatencyAPI(proxyGroupName, url, timeout);
    await fetchProxies();
};
export const allProxiesLatencyTest = async () => {
    const proxyNode = Object.keys(proxyMap.value).filter((proxy) => !isProxyGroup(proxy));
    return testLatencyOneByOneWithTip(proxyNode);
};
const getLatencyFromHistory = (history) => {
    return last(history)?.delay ?? NOT_CONNECTED;
};
const getIPv6FromExtra = (proxy) => {
    const ipv6History = proxy.extra?.[IPV6_TEST_URL]?.history;
    return (last(ipv6History)?.delay ?? NOT_CONNECTED) > NOT_CONNECTED;
};
export const getNowProxyNodeName = (name) => {
    let node = proxyMap.value[name];
    if (!name || !node) {
        return name;
    }
    while (node.now && node.now !== node.name) {
        const nextNode = proxyMap.value[node.now];
        if (!nextNode) {
            return node.name;
        }
        node = nextNode;
    }
    return node.name;
};
export const hasSmartGroup = computed(() => {
    return Object.values(proxyMap.value).some((proxy) => proxy.type.toLowerCase() === PROXY_TYPE.Smart);
});
