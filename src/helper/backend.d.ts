import type { Backend, BackendCapabilities, BackendKind } from '@/types';
export declare const normalizeSecondaryPath: (value: string | undefined | null) => string;
export declare const detectBackendKind: (backend?: Partial<Backend> | null) => BackendKind;
export declare const normalizeBackendInput: <T extends Omit<Backend, "uuid">>(backend: T) => T;
export declare const getRecommendedSecondaryPath: (kind: BackendKind | undefined | null) => string;
export declare const getBackendKindBadgeClass: (kind: BackendKind | undefined | null) => "badge badge-success badge-outline" | "badge badge-ghost badge-outline";
export declare const getBackendRuntimeTitleKey: (kind: BackendKind | undefined | null) => "hostRuntimeWorkspaceTitle" | "routerWorkspaceTitle";
export declare const getBackendRuntimeTipKey: (kind: BackendKind | undefined | null) => "hostRuntimeWorkspaceTip" | "routerWorkspaceTip";
export declare const getBackendInfoTitleKey: (kind: BackendKind | undefined | null) => "hostRuntimeInfo" | "routerInfo";
export declare const getBackendInfoTipKey: (kind: BackendKind | undefined | null) => "hostRuntimeInfoTip" | "routerInfoTip";
export declare const getBackendProbePaths: (kind: BackendKind | undefined | null) => string[];
export declare const isUbuntuServiceBackend: (backend?: Partial<Backend> | null) => boolean;
export declare const applyRecommendedSecondaryPath: <T extends {
    secondaryPath?: string;
    kind?: BackendKind;
}>(backend: T) => T;
export declare const mergeBackendCapabilities: (current?: BackendCapabilities, next?: BackendCapabilities) => BackendCapabilities | undefined;
