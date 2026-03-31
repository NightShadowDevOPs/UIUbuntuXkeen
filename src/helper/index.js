import { NOT_CONNECTED, PROXY_CHAIN_DIRECTION, PROXY_TYPE, ROUTE_NAME } from '@/constant';
import { showNotification } from '@/helper/notification';
import { timeSaved } from '@/store/overview';
import { hiddenGroupMap, proxyMap } from '@/store/proxies';
import { customThemes, lowLatency, mediumLatency, proxyChainDirection } from '@/store/settings';
import dayjs from 'dayjs';
import * as ipaddr from 'ipaddr.js';
import { head } from 'lodash';
import { computed } from 'vue';
import { prettyBytesHelper } from './utils';
export const isProxyGroup = (name) => {
    const proxyNode = proxyMap.value[name];
    if (!proxyNode) {
        return false;
    }
    if (proxyNode.all?.length) {
        return true;
    }
    return [
        PROXY_TYPE.Dns,
        PROXY_TYPE.Compatible,
        PROXY_TYPE.Direct,
        PROXY_TYPE.Reject,
        PROXY_TYPE.RejectDrop,
        PROXY_TYPE.Pass,
        PROXY_TYPE.Fallback,
        PROXY_TYPE.URLTest,
        PROXY_TYPE.LoadBalance,
        PROXY_TYPE.Selector,
        PROXY_TYPE.Smart,
    ].includes(proxyNode.type.toLowerCase());
};
export const getHostFromConnection = (connection) => {
    return `${connection.metadata.host || connection.metadata.sniffHost || connection.metadata.destinationIP}:${connection.metadata.destinationPort}`;
};
export const getProcessFromConnection = (connection) => {
    return (connection.metadata.process ||
        connection.metadata.processPath.replace(/^.*[/\\](.*)$/, '$1') ||
        '-');
};
export const getDestinationFromConnection = (connection) => {
    const finalProxyType = proxyMap.value[head(connection.chains) || '']?.type.toLowerCase();
    if (finalProxyType === PROXY_TYPE.Direct && connection.metadata.remoteDestination) {
        return connection.metadata.remoteDestination;
    }
    return connection.metadata.destinationIP || connection.metadata.host;
};
export const getDestinationTypeFromConnection = (connection) => {
    const destination = getDestinationFromConnection(connection);
    if (ipaddr.IPv4.isIPv4(destination)) {
        return 'IPv4';
    }
    else if (ipaddr.IPv6.isIPv6(destination)) {
        return 'IPv6';
    }
    else {
        return 'FQDN';
    }
};
export const getChainsStringFromConnection = (connection) => {
    const chains = [...connection.chains];
    if (proxyChainDirection.value === PROXY_CHAIN_DIRECTION.NORMAL) {
        chains.reverse();
    }
    return chains.join('');
};
export const getNetworkTypeFromConnection = (connection) => {
    return `${connection.metadata.type} | ${connection.metadata.network}`;
};
export const getInboundUserFromConnection = (connection) => {
    return (connection.metadata.inboundUser ||
        connection.metadata.inboundName ||
        connection.metadata.inboundPort ||
        '-');
};
export const getToolTipForParams = (params, config) => {
    const { suffix = '', binary = false } = config;
    // fake data
    if (params.data.name < timeSaved + 1) {
        return ``;
    }
    return `
    <div class="flex items-center my-2 gap-1">
      <div class="w-4 h-4 rounded-full" style="background-color: ${params.color}"></div>
      ${params.seriesName}
      (${dayjs(params.data.name).format('HH:mm:ss')}): ${prettyBytesHelper(params.data.value, {
        binary: binary,
    })}${suffix}
    </div>`;
};
export const getColorForLatency = (latency) => {
    if (latency === NOT_CONNECTED) {
        return '';
    }
    else if (latency < lowLatency.value) {
        return 'text-green-500';
    }
    else if (latency < mediumLatency.value) {
        return 'text-yellow-500';
    }
    else {
        return 'text-red-500';
    }
};
export const renderRoutes = computed(() => {
    return [
        ROUTE_NAME.overview,
        ROUTE_NAME.router,
        ROUTE_NAME.traffic,
        ROUTE_NAME.connections,
        ROUTE_NAME.logs,
        ROUTE_NAME.proxies,
        ROUTE_NAME.proxyProviders,
        ROUTE_NAME.subscriptions,
        ROUTE_NAME.rules,
        ROUTE_NAME.mihomo,
        ROUTE_NAME.settings,
    ];
});
export const navSections = computed(() => {
    return [
        {
            key: 'navSectionMonitor',
            routes: [
                ROUTE_NAME.overview,
                ROUTE_NAME.router,
                ROUTE_NAME.traffic,
                ROUTE_NAME.connections,
                ROUTE_NAME.logs,
            ],
        },
        {
            key: 'navSectionNetwork',
            routes: [
                ROUTE_NAME.proxies,
                ROUTE_NAME.proxyProviders,
                ROUTE_NAME.subscriptions,
                ROUTE_NAME.rules,
                ROUTE_NAME.mihomo,
            ],
        },
        {
            key: 'navSectionManagement',
            routes: [
                ROUTE_NAME.settings,
            ],
        },
    ];
});
export const applyCustomThemes = () => {
    document.querySelectorAll('.custom-theme').forEach((style) => {
        style.remove();
    });
    customThemes.value.forEach((theme) => {
        const style = document.createElement('style');
        const styleString = Object.entries(theme)
            .filter(([key]) => !['prefersdark', 'default', 'name', 'type', 'id'].includes(key))
            .map(([key, value]) => `${key}:${value}`)
            .join(';');
        style.innerHTML = `[data-theme="${theme.name}"] {
      ${styleString} 
    }`;
        style.className = `custom-theme ${theme.name}`;
        document.head.appendChild(style);
    });
};
export const isHiddenGroup = (group) => {
    if (Reflect.has(hiddenGroupMap.value, group)) {
        return hiddenGroupMap.value[group];
    }
    return proxyMap.value[group]?.hidden;
};
export const handlerUpgradeSuccess = () => {
    showNotification({
        content: 'upgradeSuccess',
        type: 'alert-success',
    });
};
