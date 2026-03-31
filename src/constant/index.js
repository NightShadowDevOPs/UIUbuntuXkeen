import { ArrowsRightLeftIcon, Cog6ToothIcon, CubeTransparentIcon, DocumentTextIcon, GlobeAltIcon, ServerStackIcon, SwatchIcon, UserGroupIcon, WrenchScrewdriverIcon, ClipboardDocumentListIcon, LinkIcon, ChartBarSquareIcon, CommandLineIcon, } from '@heroicons/vue/24/outline';
export const IS_APPLE_DEVICE = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
export const GLOBAL = 'GLOBAL';
export const TEST_URL = 'https://www.gstatic.com/generate_204';
export const IPV6_TEST_URL = 'https://ipv6.google.com/generate_204';
export const NOT_CONNECTED = 0;
export var LANG;
(function (LANG) {
    LANG["EN_US"] = "en-US";
    LANG["ZH_CN"] = "zh-CN";
    LANG["RU_RU"] = "ru-RU";
})(LANG || (LANG = {}));
export var FONTS;
(function (FONTS) {
    FONTS["MI_SANS"] = "MiSans";
    FONTS["SARASA_UI"] = "SarasaUi";
    FONTS["PING_FANG"] = "PingFang";
    FONTS["FIRA_SANS"] = "FiraSans";
    FONTS["SYSTEM_UI"] = "SystemUI";
})(FONTS || (FONTS = {}));
export var EMOJIS;
(function (EMOJIS) {
    EMOJIS["TWEMOJI"] = "twemoji";
    EMOJIS["NOTO_COLOR_EMOJI"] = "noto-color-emoji";
})(EMOJIS || (EMOJIS = {}));
export var CONNECTIONS_TABLE_ACCESSOR_KEY;
(function (CONNECTIONS_TABLE_ACCESSOR_KEY) {
    CONNECTIONS_TABLE_ACCESSOR_KEY["Close"] = "close";
    CONNECTIONS_TABLE_ACCESSOR_KEY["Type"] = "type";
    CONNECTIONS_TABLE_ACCESSOR_KEY["Process"] = "process";
    CONNECTIONS_TABLE_ACCESSOR_KEY["Host"] = "host";
    CONNECTIONS_TABLE_ACCESSOR_KEY["Rule"] = "rule";
    CONNECTIONS_TABLE_ACCESSOR_KEY["Chains"] = "chains";
    CONNECTIONS_TABLE_ACCESSOR_KEY["Outbound"] = "outbound";
    CONNECTIONS_TABLE_ACCESSOR_KEY["DlSpeed"] = "dlSpeed";
    CONNECTIONS_TABLE_ACCESSOR_KEY["UlSpeed"] = "ulSpeed";
    CONNECTIONS_TABLE_ACCESSOR_KEY["Download"] = "dl";
    CONNECTIONS_TABLE_ACCESSOR_KEY["Upload"] = "ul";
    CONNECTIONS_TABLE_ACCESSOR_KEY["ConnectTime"] = "connectTime";
    CONNECTIONS_TABLE_ACCESSOR_KEY["SourceIP"] = "sourceIP";
    CONNECTIONS_TABLE_ACCESSOR_KEY["SourcePort"] = "sourcePort";
    CONNECTIONS_TABLE_ACCESSOR_KEY["SniffHost"] = "sniffHost";
    CONNECTIONS_TABLE_ACCESSOR_KEY["Destination"] = "destination";
    CONNECTIONS_TABLE_ACCESSOR_KEY["DestinationType"] = "destinationType";
    CONNECTIONS_TABLE_ACCESSOR_KEY["RemoteAddress"] = "remoteAddress";
    CONNECTIONS_TABLE_ACCESSOR_KEY["InboundUser"] = "inboundUser";
})(CONNECTIONS_TABLE_ACCESSOR_KEY || (CONNECTIONS_TABLE_ACCESSOR_KEY = {}));
export var TABLE_WIDTH_MODE;
(function (TABLE_WIDTH_MODE) {
    TABLE_WIDTH_MODE["AUTO"] = "auto";
    TABLE_WIDTH_MODE["MANUAL"] = "manual";
})(TABLE_WIDTH_MODE || (TABLE_WIDTH_MODE = {}));
export var PROXY_SORT_TYPE;
(function (PROXY_SORT_TYPE) {
    PROXY_SORT_TYPE["DEFAULT"] = "defaultsort";
    PROXY_SORT_TYPE["NAME_ASC"] = "nameasc";
    PROXY_SORT_TYPE["NAME_DESC"] = "namedesc";
    PROXY_SORT_TYPE["LATENCY_ASC"] = "latencyasc";
    PROXY_SORT_TYPE["LATENCY_DESC"] = "latencydesc";
})(PROXY_SORT_TYPE || (PROXY_SORT_TYPE = {}));
export var PROXY_PREVIEW_TYPE;
(function (PROXY_PREVIEW_TYPE) {
    PROXY_PREVIEW_TYPE["AUTO"] = "auto";
    PROXY_PREVIEW_TYPE["DOTS"] = "dots";
    PROXY_PREVIEW_TYPE["SQUARES"] = "squares";
    PROXY_PREVIEW_TYPE["BAR"] = "bar";
})(PROXY_PREVIEW_TYPE || (PROXY_PREVIEW_TYPE = {}));
export var RULE_TAB_TYPE;
(function (RULE_TAB_TYPE) {
    RULE_TAB_TYPE["RULES"] = "rules";
    RULE_TAB_TYPE["PROVIDER"] = "ruleProvider";
})(RULE_TAB_TYPE || (RULE_TAB_TYPE = {}));
export var PROXY_TAB_TYPE;
(function (PROXY_TAB_TYPE) {
    PROXY_TAB_TYPE["PROXIES"] = "proxies";
    PROXY_TAB_TYPE["PROVIDER"] = "proxyProvider";
})(PROXY_TAB_TYPE || (PROXY_TAB_TYPE = {}));
export var SORT_TYPE;
(function (SORT_TYPE) {
    SORT_TYPE["HOST"] = "host";
    SORT_TYPE["CHAINS"] = "chains";
    SORT_TYPE["RULE"] = "rule";
    SORT_TYPE["TYPE"] = "type";
    SORT_TYPE["CONNECT_TIME"] = "connectTime";
    SORT_TYPE["DOWNLOAD"] = "download";
    SORT_TYPE["DOWNLOAD_SPEED"] = "downloadSpeed";
    SORT_TYPE["UPLOAD"] = "upload";
    SORT_TYPE["UPLOAD_SPEED"] = "uploadSpeed";
    SORT_TYPE["SOURCE_IP"] = "sourceIP";
    SORT_TYPE["INBOUND_USER"] = "inboundUser";
})(SORT_TYPE || (SORT_TYPE = {}));
export var SORT_DIRECTION;
(function (SORT_DIRECTION) {
    SORT_DIRECTION["ASC"] = "asc";
    SORT_DIRECTION["DESC"] = "desc";
})(SORT_DIRECTION || (SORT_DIRECTION = {}));
export var CONNECTION_TAB_TYPE;
(function (CONNECTION_TAB_TYPE) {
    CONNECTION_TAB_TYPE["ACTIVE"] = "activeConnections";
    CONNECTION_TAB_TYPE["CLOSED"] = "closedConnections";
})(CONNECTION_TAB_TYPE || (CONNECTION_TAB_TYPE = {}));
export var LOG_LEVEL;
(function (LOG_LEVEL) {
    LOG_LEVEL["Trace"] = "trace";
    LOG_LEVEL["Debug"] = "debug";
    LOG_LEVEL["Info"] = "info";
    LOG_LEVEL["Warning"] = "warning";
    LOG_LEVEL["Error"] = "error";
    LOG_LEVEL["Fatal"] = "fatal";
    LOG_LEVEL["Panic"] = "panic";
    LOG_LEVEL["Silent"] = "silent";
})(LOG_LEVEL || (LOG_LEVEL = {}));
export var ROUTE_NAME;
(function (ROUTE_NAME) {
    ROUTE_NAME["overview"] = "overview";
    ROUTE_NAME["router"] = "router";
    ROUTE_NAME["tasks"] = "tasks";
    ROUTE_NAME["proxies"] = "proxies";
    ROUTE_NAME["proxyProviders"] = "proxyProviders";
    ROUTE_NAME["subscriptions"] = "subscriptions";
    ROUTE_NAME["traffic"] = "traffic";
    ROUTE_NAME["connections"] = "connections";
    ROUTE_NAME["logs"] = "logs";
    ROUTE_NAME["rules"] = "rules";
    ROUTE_NAME["users"] = "users";
    ROUTE_NAME["policies"] = "policies";
    ROUTE_NAME["mihomo"] = "mihomo";
    ROUTE_NAME["settings"] = "settings";
    ROUTE_NAME["setup"] = "setup";
})(ROUTE_NAME || (ROUTE_NAME = {}));
export const ROUTE_ICON_MAP = {
    [ROUTE_NAME.overview]: CubeTransparentIcon,
    [ROUTE_NAME.router]: ServerStackIcon,
    [ROUTE_NAME.tasks]: WrenchScrewdriverIcon,
    [ROUTE_NAME.proxies]: GlobeAltIcon,
    [ROUTE_NAME.proxyProviders]: GlobeAltIcon,
    [ROUTE_NAME.subscriptions]: LinkIcon,
    [ROUTE_NAME.traffic]: ChartBarSquareIcon,
    [ROUTE_NAME.connections]: ArrowsRightLeftIcon,
    [ROUTE_NAME.rules]: SwatchIcon,
    [ROUTE_NAME.logs]: DocumentTextIcon,
    [ROUTE_NAME.users]: UserGroupIcon,
    [ROUTE_NAME.policies]: ClipboardDocumentListIcon,
    [ROUTE_NAME.mihomo]: CommandLineIcon,
    [ROUTE_NAME.settings]: Cog6ToothIcon,
    [ROUTE_NAME.setup]: CubeTransparentIcon,
};
export var TABLE_SIZE;
(function (TABLE_SIZE) {
    TABLE_SIZE["SMALL"] = "small";
    TABLE_SIZE["LARGE"] = "large";
})(TABLE_SIZE || (TABLE_SIZE = {}));
export var PROXY_CARD_SIZE;
(function (PROXY_CARD_SIZE) {
    PROXY_CARD_SIZE["SMALL"] = "small";
    PROXY_CARD_SIZE["LARGE"] = "large";
})(PROXY_CARD_SIZE || (PROXY_CARD_SIZE = {}));
export var MIN_PROXY_CARD_WIDTH;
(function (MIN_PROXY_CARD_WIDTH) {
    MIN_PROXY_CARD_WIDTH[MIN_PROXY_CARD_WIDTH["SMALL"] = 130] = "SMALL";
    MIN_PROXY_CARD_WIDTH[MIN_PROXY_CARD_WIDTH["LARGE"] = 145] = "LARGE";
})(MIN_PROXY_CARD_WIDTH || (MIN_PROXY_CARD_WIDTH = {}));
export var PROXY_CHAIN_DIRECTION;
(function (PROXY_CHAIN_DIRECTION) {
    PROXY_CHAIN_DIRECTION["NORMAL"] = "normal";
    PROXY_CHAIN_DIRECTION["REVERSE"] = "reverse";
})(PROXY_CHAIN_DIRECTION || (PROXY_CHAIN_DIRECTION = {}));
export var PROXY_TYPE;
(function (PROXY_TYPE) {
    PROXY_TYPE["Direct"] = "direct";
    PROXY_TYPE["Reject"] = "reject";
    PROXY_TYPE["RejectDrop"] = "rejectdrop";
    PROXY_TYPE["Compatible"] = "compatible";
    PROXY_TYPE["Pass"] = "pass";
    PROXY_TYPE["Dns"] = "dns";
    PROXY_TYPE["Selector"] = "selector";
    PROXY_TYPE["Fallback"] = "fallback";
    PROXY_TYPE["URLTest"] = "urltest";
    PROXY_TYPE["Smart"] = "smart";
    PROXY_TYPE["LoadBalance"] = "loadbalance";
})(PROXY_TYPE || (PROXY_TYPE = {}));
export var PROXY_COUNT_MODE;
(function (PROXY_COUNT_MODE) {
    PROXY_COUNT_MODE["FILTERED_TOTAL"] = "filteredTotal";
    PROXY_COUNT_MODE["TOTAL"] = "total";
    PROXY_COUNT_MODE["ALIVE_TOTAL"] = "aliveTotal";
})(PROXY_COUNT_MODE || (PROXY_COUNT_MODE = {}));
export const SIMPLE_CARD_STYLE = [
    [CONNECTIONS_TABLE_ACCESSOR_KEY.Host, CONNECTIONS_TABLE_ACCESSOR_KEY.ConnectTime],
    [
        CONNECTIONS_TABLE_ACCESSOR_KEY.Chains,
        CONNECTIONS_TABLE_ACCESSOR_KEY.DlSpeed,
        CONNECTIONS_TABLE_ACCESSOR_KEY.Close,
    ],
];
export const DETAILED_CARD_STYLE = [
    [CONNECTIONS_TABLE_ACCESSOR_KEY.Host, CONNECTIONS_TABLE_ACCESSOR_KEY.ConnectTime],
    [
        CONNECTIONS_TABLE_ACCESSOR_KEY.Type,
        CONNECTIONS_TABLE_ACCESSOR_KEY.Download,
        CONNECTIONS_TABLE_ACCESSOR_KEY.Upload,
    ],
    [
        CONNECTIONS_TABLE_ACCESSOR_KEY.Chains,
        CONNECTIONS_TABLE_ACCESSOR_KEY.DlSpeed,
        CONNECTIONS_TABLE_ACCESSOR_KEY.Close,
    ],
];
export const ALL_THEME = [
    'light',
    'dark',
    'light-legacy',
    'dark-legacy',
    'cupcake',
    'bumblebee',
    'emerald',
    'corporate',
    'synthwave',
    'retro',
    'cyberpunk',
    'valentine',
    'halloween',
    'garden',
    'forest',
    'aqua',
    'lofi',
    'pastel',
    'fantasy',
    'wireframe',
    'black',
    'luxury',
    'dracula',
    'cmyk',
    'autumn',
    'business',
    'acid',
    'lemonade',
    'night',
    'coffee',
    'winter',
    'dim',
    'nord',
    'sunset',
    'caramellatte',
    'abyss',
    'silk',
];
export const DEFAULT_THEME = {
    name: 'custom',
    id: '',
    '--border': '1px',
    '--color-base-100': '#ffffff',
    '--color-base-200': '#fcfcfc',
    '--color-base-300': '#f2f2f2',
    '--color-base-content': '#2d2d33',
    '--color-primary': '#5a3cd2',
    '--color-primary-content': '#f3efff',
    '--color-secondary': '#ea4c5a',
    '--color-secondary-content': '#fff1f2',
    '--color-accent': '#49c6c1',
    '--color-accent-content': '#285e66',
    '--color-neutral': '#1e1e1f',
    '--color-neutral-content': '#ececec',
    '--color-info': '#5b90ff',
    '--color-info-content': '#273c66',
    '--color-success': '#44c07a',
    '--color-success-content': '#1d472f',
    '--color-warning': '#e5a300',
    '--color-warning-content': '#705322',
    '--color-error': '#d13a30',
    '--color-error-content': '#551d1d',
    '--depth': '0',
    '--noise': '0',
    '--radius-box': '1rem',
    '--radius-field': '0.5rem',
    '--radius-selector': '1rem',
    '--size-field': '0.25rem',
    '--size-selector': '0.25rem',
    'color-scheme': 'dark',
    default: false,
    prefersdark: false,
};
export var IP_INFO_API;
(function (IP_INFO_API) {
    IP_INFO_API["IPSB"] = "ip.sb";
    IP_INFO_API["IPWHOIS"] = "ipwho.is";
    IP_INFO_API["IPAPI"] = "ipapi.is";
})(IP_INFO_API || (IP_INFO_API = {}));
