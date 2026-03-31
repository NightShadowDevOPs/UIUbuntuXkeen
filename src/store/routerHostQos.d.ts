import type { AgentQosProfile } from '@/api/agent';
export declare const routerHostQosDraftProfiles: any;
export declare const routerHostQosAppliedProfiles: any;
export declare const routerHostQosExpanded: any;
export declare const mergeRouterHostQosAppliedProfiles: (next: Record<string, AgentQosProfile>) => void;
export declare const setRouterHostQosAppliedProfile: (ip: string, profile?: AgentQosProfile) => void;
