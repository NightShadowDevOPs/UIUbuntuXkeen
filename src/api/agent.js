import axios from 'axios';
import { agentToken, agentUrl } from '@/store/agent';
// Normalized agent base URL for plain fetch() calls.
// (Vite does not typecheck by default; keeping this local avoids runtime ReferenceError.)
const getAgentBaseUrl = () => {
    const u = String(agentUrl.value || '').trim();
    if (!u)
        return '';
    return u.replace(/\/+$/g, '');
};
/**
 * Some router setups return CGI-style headers inside the response body,
 * e.g. "Content-Type: application/json\n...\n\n{...}".
 * Axios will then keep it as a string and JSON parsing downstream breaks.
 */
const parseMaybeCgiJson = (data) => {
    if (typeof data !== 'string')
        return data;
    // Fast path: valid JSON.
    try {
        return JSON.parse(data);
    }
    catch {
        /* noop */
    }
    // Fallback: strip everything before the first '{'.
    const i = data.indexOf('{');
    if (i < 0)
        return data;
    const j = data.lastIndexOf('}');
    const jsonStr = j >= i ? data.slice(i, j + 1) : data.slice(i);
    try {
        return JSON.parse(jsonStr);
    }
    catch {
        /* noop */
    }
    // Some router CGI scripts accidentally return pseudo-JSON with escaped quotes,
    // e.g. {"ok":true}. Best-effort normalize it for the UI.
    try {
        const normalized = jsonStr.replace(/\"/g, '"');
        return JSON.parse(normalized);
    }
    catch {
        return data;
    }
};
const agentAxios = () => {
    const instance = axios.create({
        baseURL: agentUrl.value || '',
        timeout: 4000,
        transformResponse: [
            (data) => {
                // Keep default behaviour for already-parsed objects.
                return parseMaybeCgiJson(data);
            },
        ],
    });
    instance.interceptors.request.use((cfg) => {
        const token = (agentToken.value || '').trim();
        if (token) {
            cfg.headers = cfg.headers || {};
            cfg.headers.Authorization = `Bearer ${token}`;
        }
        return cfg;
    });
    return instance;
};
export const agentStatusAPI = async () => {
    try {
        const { data } = await agentAxios().get('/cgi-bin/api.sh', {
            params: { cmd: 'status' },
            // NOTE: this axios instance does not use the global interceptors.
            // Adding custom headers (like X-Zash-Silent) triggers CORS preflight
            // from browsers, so keep requests headerless unless a token is set.
        });
        return (data || {});
    }
    catch (e) {
        return { ok: false, error: e?.message || 'offline' };
    }
};
export const agentFirmwareCheckAPI = async (force = false) => {
    try {
        const { data } = await agentAxios().get('/cgi-bin/api.sh', {
            params: { cmd: 'firmware_check', force: force ? '1' : '0' },
            timeout: 8000,
        });
        return (data || { ok: false });
    }
    catch (e) {
        return { ok: false, error: e?.message || 'failed' };
    }
};
export const agentTrafficLiveAPI = async () => {
    try {
        const { data } = await agentAxios().get('/cgi-bin/api.sh', {
            params: { cmd: 'traffic_live' },
            timeout: 4000,
        });
        return (data || { ok: false });
    }
    catch (e) {
        return { ok: false, error: e?.message || 'failed' };
    }
};
export const agentSetShapeAPI = async (args) => {
    try {
        const { data } = await agentAxios().get('/cgi-bin/api.sh', {
            params: {
                cmd: 'shape',
                ip: args.ip,
                up: args.upMbps,
                down: args.downMbps,
            },
        });
        return (data || { ok: true });
    }
    catch (e) {
        return { ok: false, error: e?.message || 'failed' };
    }
};
export const agentRemoveShapeAPI = async (ip) => {
    try {
        const { data } = await agentAxios().get('/cgi-bin/api.sh', {
            params: { cmd: 'unshape', ip },
        });
        return (data || { ok: true });
    }
    catch (e) {
        return { ok: false, error: e?.message || 'failed' };
    }
};
export const agentNeighborsAPI = async () => {
    try {
        const { data } = await agentAxios().get('/cgi-bin/api.sh', {
            params: { cmd: 'neighbors' },
        });
        return (data || { ok: true });
    }
    catch (e) {
        return { ok: false, error: e?.message || 'failed' };
    }
};
export const agentLanHostsAPI = async () => {
    try {
        const { data } = await agentAxios().get('/cgi-bin/api.sh', {
            params: { cmd: 'lan_hosts' },
            timeout: 15000,
        });
        return (data || { ok: true });
    }
    catch (e) {
        return { ok: false, error: e?.message || 'failed' };
    }
};
export const agentHostTrafficLiveAPI = async () => {
    try {
        const { data } = await agentAxios().get('/cgi-bin/api.sh', {
            params: { cmd: 'host_traffic_live' },
            timeout: 8000,
        });
        return (data || { ok: false });
    }
    catch (e) {
        return { ok: false, error: e?.message || 'failed' };
    }
};
export const agentHostRemoteTargetsAPI = async (ip) => {
    try {
        const { data } = await agentAxios().get('/cgi-bin/api.sh', {
            params: { cmd: 'host_remote_targets', ip },
            timeout: 8000,
        });
        return (data || { ok: false });
    }
    catch (e) {
        return { ok: false, error: e?.message || 'failed' };
    }
};
export const agentIpToMacAPI = async (ip) => {
    try {
        const { data } = await agentAxios().get('/cgi-bin/api.sh', {
            params: { cmd: 'ip2mac', ip },
        });
        return (data || { ok: true });
    }
    catch (e) {
        return { ok: false, error: e?.message || 'failed' };
    }
};
export const agentQosStatusAPI = async () => {
    try {
        const { data } = await agentAxios().get('/cgi-bin/api.sh', {
            params: { cmd: 'qos_status' },
            timeout: 5000,
        });
        return (data || { ok: false });
    }
    catch (e) {
        return { ok: false, error: e?.message || 'failed' };
    }
};
export const agentSetHostQosAPI = async (args) => {
    try {
        const { data } = await agentAxios().get('/cgi-bin/api.sh', {
            params: { cmd: 'qos_set', ip: args.ip, profile: args.profile },
            timeout: 6000,
        });
        return (data || { ok: false });
    }
    catch (e) {
        return { ok: false, error: e?.message || 'failed' };
    }
};
export const agentRemoveHostQosAPI = async (ip) => {
    try {
        const { data } = await agentAxios().get('/cgi-bin/api.sh', {
            params: { cmd: 'qos_remove', ip },
            timeout: 6000,
        });
        return (data || { ok: false });
    }
    catch (e) {
        return { ok: false, error: e?.message || 'failed' };
    }
};
export const agentBlockMacAPI = async (args) => {
    try {
        const portsParam = args.ports === 'all' ? 'all' : args.ports.join(',');
        const { data } = await agentAxios().get('/cgi-bin/api.sh', {
            params: { cmd: 'blockmac', mac: args.mac, ports: portsParam },
        });
        return (data || { ok: true });
    }
    catch (e) {
        return { ok: false, error: e?.message || 'failed' };
    }
};
export const agentBlockIpAPI = async (ip) => {
    try {
        const { data } = await agentAxios().get('/cgi-bin/api.sh', {
            params: { cmd: 'blockip', ip },
        });
        return (data || { ok: true });
    }
    catch (e) {
        return { ok: false, error: e?.message || 'failed' };
    }
};
export const agentUnblockIpAPI = async (ip) => {
    try {
        const { data } = await agentAxios().get('/cgi-bin/api.sh', {
            params: { cmd: 'unblockip', ip },
        });
        return (data || { ok: true });
    }
    catch (e) {
        return { ok: false, error: e?.message || 'failed' };
    }
};
export const agentLogsAPI = async (args) => {
    try {
        const { data } = await agentAxios().get('/cgi-bin/api.sh', {
            params: { cmd: 'logs', type: args.type, lines: args.lines ?? 200 },
        });
        return (data || {});
    }
    catch (e) {
        return { ok: false, error: e?.message || 'failed' };
    }
};
export const agentLogsFollowAPI = async (args) => {
    try {
        const { data } = await agentAxios().get('/cgi-bin/api.sh', {
            params: { cmd: 'logs_follow', type: args.type, lines: args.lines ?? 200, offset: args.offset ?? 0 },
        });
        return (data || {});
    }
    catch (e) {
        return { ok: false, error: e?.message || 'failed' };
    }
};
export const agentGeoInfoAPI = async () => {
    try {
        const { data } = await agentAxios().get('/cgi-bin/api.sh', {
            params: { cmd: 'geo_info' },
        });
        return (data || {});
    }
    catch (e) {
        return { ok: false, error: e?.message || 'failed' };
    }
};
export const agentGeoUpdateAPI = async () => {
    try {
        const { data } = await agentAxios().get('/cgi-bin/api.sh', {
            params: { cmd: 'geo_update' },
            timeout: 30000,
        });
        return (data || {});
    }
    catch (e) {
        return { ok: false, error: e?.message || 'failed' };
    }
};
export const agentRulesInfoAPI = async () => {
    try {
        const { data } = await agentAxios().get('/cgi-bin/api.sh', {
            params: { cmd: 'rules_info' },
        });
        return (data || {});
    }
    catch (e) {
        return { ok: false, error: e?.message || 'failed' };
    }
};
export const agentUnblockMacAPI = async (mac) => {
    try {
        const { data } = await agentAxios().get('/cgi-bin/api.sh', {
            params: { cmd: 'unblockmac', mac },
        });
        return (data || { ok: true });
    }
    catch (e) {
        return { ok: false, error: e?.message || 'failed' };
    }
};
let _mihomoProvidersCache = null;
let _mihomoProvidersAt = 0;
export const agentMihomoConfigAPI = async () => {
    try {
        const { data } = await agentAxios().get('/cgi-bin/api.sh', {
            params: { cmd: 'mihomo_config' },
        });
        return (data || {});
    }
    catch (e) {
        return { ok: false, error: e?.message || 'offline' };
    }
};
export const agentMihomoConfigStateAPI = async () => {
    try {
        const { data } = await agentAxios().get('/cgi-bin/api.sh', {
            params: { cmd: 'mihomo_cfg_state' },
            timeout: 15000,
        });
        return (data || {});
    }
    catch (e) {
        return { ok: false, error: e?.message || 'offline' };
    }
};
export const agentMihomoConfigManagedGetAPI = async (kind) => {
    try {
        const { data } = await agentAxios().get('/cgi-bin/api.sh', {
            params: { cmd: 'mihomo_cfg_get', kind },
            timeout: 15000,
        });
        return (data || {});
    }
    catch (e) {
        return { ok: false, error: e?.message || 'offline' };
    }
};
export const agentMihomoConfigManagedPutDraftAPI = async (content) => {
    try {
        const { data } = await agentAxios().post('/cgi-bin/api.sh?cmd=mihomo_cfg_put&kind=draft', content ?? '', {
            headers: {
                'Content-Type': 'text/plain',
            },
            timeout: 20000,
        });
        return (data || {});
    }
    catch (e) {
        return { ok: false, error: e?.message || 'offline' };
    }
};
export const agentMihomoConfigManagedCopyAPI = async (from) => {
    try {
        const { data } = await agentAxios().post(`/cgi-bin/api.sh?cmd=mihomo_cfg_copy&from=${encodeURIComponent(from)}&to=draft`, null, {
            timeout: 15000,
        });
        return (data || {});
    }
    catch (e) {
        return { ok: false, error: e?.message || 'offline' };
    }
};
export const agentMihomoConfigManagedValidateAPI = async (kind) => {
    try {
        const { data } = await agentAxios().get('/cgi-bin/api.sh', {
            params: { cmd: 'mihomo_cfg_validate', kind },
            timeout: 25000,
        });
        return (data || {});
    }
    catch (e) {
        return { ok: false, error: e?.message || 'offline' };
    }
};
export const agentMihomoConfigManagedApplyAPI = async () => {
    try {
        const { data } = await agentAxios().post('/cgi-bin/api.sh?cmd=mihomo_cfg_apply', null, {
            timeout: 30000,
        });
        return (data || {});
    }
    catch (e) {
        return { ok: false, error: e?.message || 'offline' };
    }
};
export const agentMihomoConfigManagedSetBaselineFromActiveAPI = async () => {
    try {
        const { data } = await agentAxios().post('/cgi-bin/api.sh?cmd=mihomo_cfg_set_baseline_from_active', null, {
            timeout: 20000,
        });
        return (data || {});
    }
    catch (e) {
        return { ok: false, error: e?.message || 'offline' };
    }
};
export const agentMihomoConfigManagedRestoreBaselineAPI = async () => {
    try {
        const { data } = await agentAxios().post('/cgi-bin/api.sh?cmd=mihomo_cfg_restore_baseline', null, {
            timeout: 30000,
        });
        return (data || {});
    }
    catch (e) {
        return { ok: false, error: e?.message || 'offline' };
    }
};
export const agentMihomoConfigManagedHistoryAPI = async () => {
    try {
        const { data } = await agentAxios().get('/cgi-bin/api.sh', {
            params: { cmd: 'mihomo_cfg_history' },
            timeout: 15000,
        });
        return (data || {});
    }
    catch (e) {
        return { ok: false, error: e?.message || 'offline' };
    }
};
export const agentMihomoConfigManagedGetRevAPI = async (rev) => {
    try {
        const { data } = await agentAxios().get('/cgi-bin/api.sh', {
            params: { cmd: 'mihomo_cfg_get_rev', rev: String(rev ?? 0) },
            timeout: 15000,
        });
        return (data || {});
    }
    catch (e) {
        return { ok: false, error: e?.message || 'offline' };
    }
};
export const agentMihomoConfigManagedRestoreRevAPI = async (rev) => {
    try {
        const { data } = await agentAxios().post(`/cgi-bin/api.sh?cmd=mihomo_cfg_restore_rev&rev=${encodeURIComponent(String(rev ?? 0))}`, null, {
            timeout: 30000,
        });
        return (data || {});
    }
    catch (e) {
        return { ok: false, error: e?.message || 'offline' };
    }
};
export const agentMihomoProvidersAPI = async (force = false) => {
    const now = Date.now();
    if (!force && _mihomoProvidersCache && now - _mihomoProvidersAt < 60_000)
        return _mihomoProvidersCache;
    try {
        const { data } = await agentAxios().get('/cgi-bin/api.sh', {
            params: { cmd: 'mihomo_providers', force: force ? '1' : '0' },
            timeout: 15000,
        });
        _mihomoProvidersCache = (data || {});
        _mihomoProvidersAt = now;
        return _mihomoProvidersCache;
    }
    catch (e) {
        // Keep the last good provider list to avoid false "agent unavailable"
        // badges when one probe or router response is temporarily slow.
        if (_mihomoProvidersCache?.ok)
            return _mihomoProvidersCache;
        const res = { ok: false, error: e?.message || 'offline' };
        _mihomoProvidersAt = now;
        return res;
    }
};
export const agentProviderSslCacheRefreshAPI = async () => {
    try {
        const { data } = await agentAxios().get('/cgi-bin/api.sh', {
            params: { cmd: 'ssl_cache_refresh' },
            timeout: 10000,
        });
        return (data || { ok: false });
    }
    catch (e) {
        return { ok: false, error: e?.message || 'failed' };
    }
};
// Batch probe TLS certificate expiry (notAfter) for a list of HTTPS/WSS URLs.
// Input format (text/plain): each line "<name>\t<url>".
// Returns: { ok, checkedAtSec, items: [{ name, url, sslNotAfter, error }] }
export const agentSslProbeBatchAPI = async (lines, timeoutMs = 45000) => {
    const base = getAgentBaseUrl();
    if (!base)
        return { ok: false, error: 'agent-disabled' };
    const url = `${base}/cgi-bin/api.sh?cmd=ssl_probe_batch`;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? window.setTimeout(() => controller.abort(), Math.max(5000, timeoutMs || 45000)) : 0;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain',
            },
            body: lines || '',
            signal: controller?.signal,
        });
        return await res.json();
    }
    catch (e) {
        if (e?.name === 'AbortError')
            return { ok: false, error: 'timeout' };
        return { ok: false, error: e?.message || 'failed' };
    }
    finally {
        if (timer)
            window.clearTimeout(timer);
    }
};
// --- Shared users DB (Source IP mapping) ---
export const agentUsersDbGetAPI = async () => {
    try {
        const { data } = await agentAxios().get('/cgi-bin/api.sh', {
            params: { cmd: 'users_db_get' },
            // Router can be slow on flash IO; keep sync stable.
            timeout: 15000,
        });
        return (data || {});
    }
    catch (e) {
        return { ok: false, error: e?.message || 'offline' };
    }
};
export const agentUsersDbPutAPI = async (args) => {
    try {
        const { data } = await agentAxios().post(`/cgi-bin/api.sh?cmd=users_db_put&rev=${encodeURIComponent(String(args.rev ?? 0))}`, args.content, {
            headers: {
                'Content-Type': 'text/plain',
            },
            // Allow slower writes on embedded storage.
            timeout: 20000,
        });
        return (data || {});
    }
    catch (e) {
        return { ok: false, error: e?.message || 'offline' };
    }
};
// --- Shared provider traffic store (provider Today / Since reset counters) ---
export const agentProviderTrafficGetAPI = async () => {
    try {
        const { data } = await agentAxios().get('/cgi-bin/api.sh', {
            params: { cmd: 'provider_traffic_get' },
            timeout: 15000,
        });
        return (data || {});
    }
    catch (e) {
        return { ok: false, error: e?.message || 'offline' };
    }
};
export const agentProviderTrafficPutAPI = async (args) => {
    try {
        const { data } = await agentAxios().post(`/cgi-bin/api.sh?cmd=provider_traffic_put&rev=${encodeURIComponent(String(args.rev ?? 0))}`, args.content, {
            headers: {
                'Content-Type': 'text/plain',
            },
            timeout: 20000,
        });
        return (data || {});
    }
    catch (e) {
        return { ok: false, error: e?.message || 'offline' };
    }
};
export const agentUsersDbHistoryAPI = async () => {
    try {
        const { data } = await agentAxios().get('/cgi-bin/api.sh', {
            params: { cmd: 'users_db_history' },
            timeout: 15000,
        });
        return (data || {});
    }
    catch (e) {
        return { ok: false, error: e?.message || 'offline' };
    }
};
export const agentUsersDbGetRevAPI = async (rev) => {
    try {
        const { data } = await agentAxios().get('/cgi-bin/api.sh', {
            params: { cmd: 'users_db_get_rev', rev: String(rev ?? 0) },
            timeout: 15000,
        });
        return (data || {});
    }
    catch (e) {
        return { ok: false, error: e?.message || 'offline' };
    }
};
export const agentUsersDbRestoreAPI = async (rev) => {
    try {
        const { data } = await agentAxios().post(`/cgi-bin/api.sh?cmd=users_db_restore&rev=${encodeURIComponent(String(rev ?? 0))}`, '', {
            headers: { 'Content-Type': 'text/plain' },
            timeout: 20000,
        });
        return (data || {});
    }
    catch (e) {
        return { ok: false, error: e?.message || 'offline' };
    }
};
export const agentBackupStatusAPI = async () => {
    try {
        const { data } = await agentAxios().get('/cgi-bin/api.sh', {
            params: { cmd: 'backup_status' },
            timeout: 8000,
        });
        return (data || { ok: true });
    }
    catch (e) {
        return { ok: false, error: e?.message || 'offline' };
    }
};
export const agentBackupCloudStatusAPI = async () => {
    try {
        const { data } = await agentAxios().get('/cgi-bin/api.sh', {
            params: { cmd: 'backup_cloud_status' },
            timeout: 8000,
        });
        return (data || { ok: true });
    }
    catch (e) {
        return { ok: false, error: e?.message || 'offline' };
    }
};
export const agentBackupStartAPI = async (remotes) => {
    try {
        const selected = Array.isArray(remotes) ? remotes.map((it) => String(it || '').trim()).filter(Boolean).join(',') : String(remotes || '').trim();
        const params = { cmd: 'backup_start' };
        if (selected)
            params.remotes = selected;
        const { data } = await agentAxios().get('/cgi-bin/api.sh', {
            params,
            timeout: 8000,
        });
        return (data || { ok: true });
    }
    catch (e) {
        return { ok: false, error: e?.message || 'offline' };
    }
};
export const agentBackupLogAPI = async (lines = 200) => {
    try {
        const { data } = await agentAxios().get('/cgi-bin/api.sh', {
            params: { cmd: 'backup_log', lines: String(lines ?? 200) },
            timeout: 8000,
        });
        return (data || { ok: true });
    }
    catch (e) {
        return { ok: false, error: e?.message || 'offline' };
    }
};
export const agentBackupCloudListAPI = async () => {
    try {
        const { data } = await agentAxios().get('/cgi-bin/api.sh', {
            params: { cmd: 'backup_cloud_list' },
            timeout: 12000,
        });
        return (data || { ok: true, items: [] });
    }
    catch (e) {
        return { ok: false, error: e?.message || 'offline' };
    }
};
export const agentBackupListAPI = async () => {
    try {
        const { data } = await agentAxios().get('/cgi-bin/api.sh', {
            params: { cmd: 'backup_list' },
            timeout: 8000,
        });
        return (data || { ok: true, items: [] });
    }
    catch (e) {
        return { ok: false, error: e?.message || 'offline' };
    }
};
export const agentBackupDeleteAPI = async (file) => {
    try {
        const { data } = await agentAxios().get('/cgi-bin/api.sh', {
            params: { cmd: 'backup_delete', file },
            timeout: 15000,
        });
        return (data || { ok: true });
    }
    catch (e) {
        return { ok: false, error: e?.message || 'offline' };
    }
};
export const agentBackupCloudDeleteAPI = async (file, remote = '') => {
    try {
        const { data } = await agentAxios().get('/cgi-bin/api.sh', {
            params: { cmd: 'backup_cloud_delete', file, remote: remote || undefined },
            timeout: 12000,
        });
        return (data || { ok: true });
    }
    catch (e) {
        return { ok: false, error: e?.message || 'offline' };
    }
};
export const agentBackupCloudDownloadAPI = async (file, remote = '') => {
    try {
        const { data } = await agentAxios().get('/cgi-bin/api.sh', {
            params: { cmd: 'backup_cloud_download', file, remote: remote || undefined },
            timeout: 60000,
        });
        return (data || { ok: true });
    }
    catch (e) {
        return { ok: false, error: e?.message || 'offline' };
    }
};
export const agentRestoreStatusAPI = async () => {
    try {
        const { data } = await agentAxios().get('/cgi-bin/api.sh', {
            params: { cmd: 'restore_status' },
            timeout: 8000,
        });
        return (data || { ok: true, running: false });
    }
    catch (e) {
        return { ok: false, error: e?.message || 'offline' };
    }
};
export const agentRestoreStartAPI = async (file, scope, includeEnv, source = 'local', remote = '') => {
    try {
        const { data } = await agentAxios().get('/cgi-bin/api.sh', {
            params: {
                cmd: 'restore_start',
                file: file || 'latest',
                scope: scope || 'all',
                env: includeEnv ? '1' : '0',
                source: source || 'local',
                remote: source === 'cloud' && remote ? remote : undefined,
            },
            timeout: 12000,
        });
        return (data || { ok: true });
    }
    catch (e) {
        return { ok: false, error: e?.message || 'offline' };
    }
};
export const agentRestoreLogAPI = async (lines = 200) => {
    try {
        const { data } = await agentAxios().get('/cgi-bin/api.sh', {
            params: { cmd: 'restore_log', lines: String(lines ?? 200) },
            timeout: 8000,
        });
        return (data || { ok: true });
    }
    catch (e) {
        return { ok: false, error: e?.message || 'offline' };
    }
};
export const agentBackupCronGetAPI = async () => {
    try {
        const { data } = await agentAxios().get('/cgi-bin/api.sh', {
            params: { cmd: 'backup_cron_get' },
            timeout: 8000,
        });
        return (data || { ok: true, enabled: false });
    }
    catch (e) {
        return { ok: false, error: e?.message || 'offline' };
    }
};
export const agentBackupCronSetAPI = async (enabled, schedule) => {
    try {
        const { data } = await agentAxios().get('/cgi-bin/api.sh', {
            params: { cmd: 'backup_cron_set', enabled: enabled ? '1' : '0', schedule },
            timeout: 15000,
        });
        return (data || { ok: true });
    }
    catch (e) {
        return { ok: false, error: e?.message || 'offline' };
    }
};
