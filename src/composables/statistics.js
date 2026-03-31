import { prettyBytesHelper } from '@/helper/utils';
import { activeConnections, downloadTotal, uploadTotal } from '@/store/connections';
import { proxyProviederList } from '@/store/proxies';
import { rules } from '@/store/rules';
import { downloadSpeed, memory, uploadSpeed } from '@/store/overview';
import { computed } from 'vue';
export var STATISTICS_TYPE;
(function (STATISTICS_TYPE) {
    STATISTICS_TYPE["TOTAL_PROXIES"] = "totalProxies";
    STATISTICS_TYPE["TOTAL_PROVIDERS"] = "totalProviders";
    STATISTICS_TYPE["TOTAL_RULES"] = "totalRules";
    STATISTICS_TYPE["CONNECTIONS"] = "connections";
    STATISTICS_TYPE["DOWNLOAD"] = "download";
    STATISTICS_TYPE["DL_SPEED"] = "dlSpeed";
    STATISTICS_TYPE["MEMORY_USAGE"] = "memoryUsage";
    STATISTICS_TYPE["UPLOAD"] = "upload";
    STATISTICS_TYPE["UL_SPEED"] = "ulSpeed";
})(STATISTICS_TYPE || (STATISTICS_TYPE = {}));
export const statisticsMap = computed(() => {
    return {
        [STATISTICS_TYPE.TOTAL_PROXIES]: proxyProviederList.value.reduce((a, p) => a + (p.proxies?.length || 0), 0),
        [STATISTICS_TYPE.TOTAL_PROVIDERS]: proxyProviederList.value.length,
        [STATISTICS_TYPE.TOTAL_RULES]: rules.value.length,
        [STATISTICS_TYPE.CONNECTIONS]: activeConnections.value.length,
        [STATISTICS_TYPE.MEMORY_USAGE]: prettyBytesHelper(memory.value, { binary: true }),
        [STATISTICS_TYPE.DOWNLOAD]: prettyBytesHelper(downloadTotal.value),
        [STATISTICS_TYPE.UPLOAD]: prettyBytesHelper(uploadTotal.value),
        [STATISTICS_TYPE.DL_SPEED]: prettyBytesHelper(downloadSpeed.value) + '/s',
        [STATISTICS_TYPE.UL_SPEED]: prettyBytesHelper(uploadSpeed.value) + '/s',
    };
});
