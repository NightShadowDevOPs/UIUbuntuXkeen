export declare const APP_DISPLAY_NAME = "UIUbuntuXkeen";
export declare const APP_RUNTIME_FLAVOR = "Ubuntu/Mihomo";
export declare const APP_REPO_OWNER = "NightShadowDevOPs";
export declare const APP_REPO_NAME = "UIUbuntuXkeen";
export declare const APP_REPO_URL = "https://github.com/NightShadowDevOPs/UIUbuntuXkeen";
export declare const APP_RELEASES_API_URL = "https://api.github.com/repos/NightShadowDevOPs/UIUbuntuXkeen/releases/latest";
export declare const APP_ROLLING_RELEASE_TAG = "rolling";
export declare const APP_ROLLING_DIST_NAME = "dist.zip";
export declare const buildRollingReleaseUrl: (version?: string | number) => string;
export declare const UBUNTU_PATHS: {
    readonly activeConfig: "/etc/mihomo/config.yaml";
    readonly stateRoot: "/var/lib/ultra-ui-ubuntu/";
    readonly configRoot: "/var/lib/ultra-ui-ubuntu/config/";
    readonly logsRoot: "/var/log/ultra-ui-ubuntu/";
    readonly mihomoLog: "/var/log/mihomo/mihomo.log";
    readonly agentEnv: "/etc/ultra-ui-ubuntu/agent.env";
};
