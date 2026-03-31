export declare const IS_APPLE_DEVICE: boolean;
export declare const GLOBAL = "GLOBAL";
export declare const TEST_URL = "https://www.gstatic.com/generate_204";
export declare const IPV6_TEST_URL = "https://ipv6.google.com/generate_204";
export declare const NOT_CONNECTED = 0;
export declare enum LANG {
    EN_US = "en-US",
    ZH_CN = "zh-CN",
    RU_RU = "ru-RU"
}
export declare enum FONTS {
    MI_SANS = "MiSans",
    SARASA_UI = "SarasaUi",
    PING_FANG = "PingFang",
    FIRA_SANS = "FiraSans",
    SYSTEM_UI = "SystemUI"
}
export declare enum EMOJIS {
    TWEMOJI = "twemoji",
    NOTO_COLOR_EMOJI = "noto-color-emoji"
}
export declare enum CONNECTIONS_TABLE_ACCESSOR_KEY {
    Close = "close",
    Type = "type",
    Process = "process",
    Host = "host",
    Rule = "rule",
    Chains = "chains",
    Outbound = "outbound",
    DlSpeed = "dlSpeed",
    UlSpeed = "ulSpeed",
    Download = "dl",
    Upload = "ul",
    ConnectTime = "connectTime",
    SourceIP = "sourceIP",
    SourcePort = "sourcePort",
    SniffHost = "sniffHost",
    Destination = "destination",
    DestinationType = "destinationType",
    RemoteAddress = "remoteAddress",
    InboundUser = "inboundUser"
}
export declare enum TABLE_WIDTH_MODE {
    AUTO = "auto",
    MANUAL = "manual"
}
export declare enum PROXY_SORT_TYPE {
    DEFAULT = "defaultsort",
    NAME_ASC = "nameasc",
    NAME_DESC = "namedesc",
    LATENCY_ASC = "latencyasc",
    LATENCY_DESC = "latencydesc"
}
export declare enum PROXY_PREVIEW_TYPE {
    AUTO = "auto",
    DOTS = "dots",
    SQUARES = "squares",
    BAR = "bar"
}
export declare enum RULE_TAB_TYPE {
    RULES = "rules",
    PROVIDER = "ruleProvider"
}
export declare enum PROXY_TAB_TYPE {
    PROXIES = "proxies",
    PROVIDER = "proxyProvider"
}
export declare enum SORT_TYPE {
    HOST = "host",
    CHAINS = "chains",
    RULE = "rule",
    TYPE = "type",
    CONNECT_TIME = "connectTime",
    DOWNLOAD = "download",
    DOWNLOAD_SPEED = "downloadSpeed",
    UPLOAD = "upload",
    UPLOAD_SPEED = "uploadSpeed",
    SOURCE_IP = "sourceIP",
    INBOUND_USER = "inboundUser"
}
export declare enum SORT_DIRECTION {
    ASC = "asc",
    DESC = "desc"
}
export declare enum CONNECTION_TAB_TYPE {
    ACTIVE = "activeConnections",
    CLOSED = "closedConnections"
}
export declare enum LOG_LEVEL {
    Trace = "trace",
    Debug = "debug",
    Info = "info",
    Warning = "warning",
    Error = "error",
    Fatal = "fatal",
    Panic = "panic",
    Silent = "silent"
}
export declare enum ROUTE_NAME {
    overview = "overview",
    router = "router",
    tasks = "tasks",
    proxies = "proxies",
    proxyProviders = "proxyProviders",
    subscriptions = "subscriptions",
    traffic = "traffic",
    connections = "connections",
    logs = "logs",
    rules = "rules",
    users = "users",
    policies = "policies",
    mihomo = "mihomo",
    settings = "settings",
    setup = "setup"
}
export declare const ROUTE_ICON_MAP: {
    overview: any;
    router: any;
    tasks: any;
    proxies: any;
    proxyProviders: any;
    subscriptions: any;
    traffic: any;
    connections: any;
    rules: any;
    logs: any;
    users: any;
    policies: any;
    mihomo: any;
    settings: any;
    setup: any;
};
export declare enum TABLE_SIZE {
    SMALL = "small",
    LARGE = "large"
}
export declare enum PROXY_CARD_SIZE {
    SMALL = "small",
    LARGE = "large"
}
export declare enum MIN_PROXY_CARD_WIDTH {
    SMALL = 130,
    LARGE = 145
}
export declare enum PROXY_CHAIN_DIRECTION {
    NORMAL = "normal",
    REVERSE = "reverse"
}
export declare enum PROXY_TYPE {
    Direct = "direct",
    Reject = "reject",
    RejectDrop = "rejectdrop",
    Compatible = "compatible",
    Pass = "pass",
    Dns = "dns",
    Selector = "selector",
    Fallback = "fallback",
    URLTest = "urltest",
    Smart = "smart",
    LoadBalance = "loadbalance"
}
export declare enum PROXY_COUNT_MODE {
    FILTERED_TOTAL = "filteredTotal",
    TOTAL = "total",
    ALIVE_TOTAL = "aliveTotal"
}
export declare const SIMPLE_CARD_STYLE: CONNECTIONS_TABLE_ACCESSOR_KEY[][];
export declare const DETAILED_CARD_STYLE: CONNECTIONS_TABLE_ACCESSOR_KEY[][];
export declare const ALL_THEME: string[];
export declare const DEFAULT_THEME: {
    name: string;
    id: string;
    '--border': string;
    '--color-base-100': string;
    '--color-base-200': string;
    '--color-base-300': string;
    '--color-base-content': string;
    '--color-primary': string;
    '--color-primary-content': string;
    '--color-secondary': string;
    '--color-secondary-content': string;
    '--color-accent': string;
    '--color-accent-content': string;
    '--color-neutral': string;
    '--color-neutral-content': string;
    '--color-info': string;
    '--color-info-content': string;
    '--color-success': string;
    '--color-success-content': string;
    '--color-warning': string;
    '--color-warning-content': string;
    '--color-error': string;
    '--color-error-content': string;
    '--depth': string;
    '--noise': string;
    '--radius-box': string;
    '--radius-field': string;
    '--radius-selector': string;
    '--size-field': string;
    '--size-selector': string;
    'color-scheme': string;
    default: boolean;
    prefersdark: boolean;
};
export type THEME = Record<string, string>;
export declare enum IP_INFO_API {
    IPSB = "ip.sb",
    IPWHOIS = "ipwho.is",
    IPAPI = "ipapi.is"
}
