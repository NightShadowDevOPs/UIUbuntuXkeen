import type { Connection } from '@/types';
export declare const isProxyGroup: (name: string) => boolean;
export declare const getHostFromConnection: (connection: Connection) => string;
export declare const getProcessFromConnection: (connection: Connection) => string;
export declare const getDestinationFromConnection: (connection: Connection) => string;
export declare const getDestinationTypeFromConnection: (connection: Connection) => "IPv6" | "IPv4" | "FQDN";
export declare const getChainsStringFromConnection: (connection: Connection) => string;
export declare const getNetworkTypeFromConnection: (connection: Connection) => string;
export declare const getInboundUserFromConnection: (connection: Connection) => string;
export declare const getToolTipForParams: (params: ToolTipParams, config: {
    suffix: string;
    binary: boolean;
}) => string;
export declare const getColorForLatency: (latency: number) => "" | "text-green-500" | "text-yellow-500" | "text-red-500";
export declare const renderRoutes: any;
export declare const navSections: any;
export declare const applyCustomThemes: () => void;
export declare const isHiddenGroup: (group: string) => any;
export declare const handlerUpgradeSuccess: () => void;
