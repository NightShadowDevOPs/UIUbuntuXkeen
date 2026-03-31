import type { Router } from 'vue-router';
export declare const TOPOLOGY_NAV_FILTER_KEY = "runtime/topology-pending-filter-v1";
export type TopologyNavStage = 'C' | 'R' | 'G' | 'S' | 'P';
export type TopologyNavMode = 'none' | 'only' | 'exclude';
export type TopologyNavFocus = {
    stage: TopologyNavStage;
    kind: 'value';
    value: string;
};
export type PendingTopologyNavFilter = {
    ts: number;
    mode: TopologyNavMode;
    focus: TopologyNavFocus;
    fallbackProxyName?: string;
};
export declare const setPendingTopologyNavFilter: (payload: PendingTopologyNavFilter) => boolean;
export declare const clearPendingTopologyNavFilter: () => void;
export declare const navigateToTopology: (router: Router, focus: {
    stage: TopologyNavStage;
    value: string;
}, mode?: TopologyNavMode, opts?: {
    fallbackProxyName?: string;
}) => Promise<void>;
