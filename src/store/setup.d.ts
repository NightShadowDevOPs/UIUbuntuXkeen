import type { Backend } from '@/types';
export declare const backendList: any;
export declare const activeUuid: any;
export declare const activeBackend: any;
export declare const addBackend: (backend: Omit<Backend, "uuid">) => void;
export declare const updateBackend: (uuid: string, backend: Omit<Backend, "uuid">) => void;
export declare const removeBackend: (uuid: string) => void;
