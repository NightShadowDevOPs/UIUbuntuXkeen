export declare const useUiBuild: () => {
    uiBuildId: any;
    currentBundleTag: any;
    onlineBundleTag: any;
    isUiBuildChecking: any;
    isFreshUiBuildAvailable: any;
    uiBuildStatusKey: any;
    uiBuildCheckError: any;
    lastUiBuildCheckedAt: any;
    checkFreshUiBuild: () => Promise<any>;
    hardRefreshUiCache: () => Promise<void>;
};
