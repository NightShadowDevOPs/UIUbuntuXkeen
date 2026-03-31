export const APP_DISPLAY_NAME = 'UIUbuntuXkeen';
export const APP_RUNTIME_FLAVOR = 'Ubuntu/Mihomo';
export const APP_REPO_OWNER = 'NightShadowDevOPs';
export const APP_REPO_NAME = 'UIUbuntuXkeen';
export const APP_REPO_URL = `https://github.com/${APP_REPO_OWNER}/${APP_REPO_NAME}`;
export const APP_RELEASES_API_URL = `https://api.github.com/repos/${APP_REPO_OWNER}/${APP_REPO_NAME}/releases/latest`;
export const APP_ROLLING_RELEASE_TAG = 'rolling';
export const APP_ROLLING_DIST_NAME = 'dist.zip';
export const buildRollingReleaseUrl = (version) => {
    const base = `${APP_REPO_URL}/releases/download/${APP_ROLLING_RELEASE_TAG}/${APP_ROLLING_DIST_NAME}`;
    if (version === undefined || version === null || version === '')
        return base;
    return `${base}?v=${encodeURIComponent(String(version))}`;
};
export const UBUNTU_PATHS = {
    activeConfig: '/etc/mihomo/config.yaml',
    stateRoot: '/var/lib/ultra-ui-ubuntu/',
    configRoot: '/var/lib/ultra-ui-ubuntu/config/',
    logsRoot: '/var/log/ultra-ui-ubuntu/',
    mihomoLog: '/var/log/mihomo/mihomo.log',
    agentEnv: '/etc/ultra-ui-ubuntu/agent.env',
};
