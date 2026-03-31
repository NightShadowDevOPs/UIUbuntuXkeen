export type JobItem = {
    id: string;
    title: string;
    startedAt: number;
    endedAt?: number;
    ok?: boolean;
    error?: string;
    meta?: Record<string, any>;
};
export declare const jobHistory: any;
export declare const startJob: (title: string, meta?: Record<string, any>) => string;
export declare const finishJob: (id: string, patch: {
    ok: boolean;
    error?: string;
    meta?: Record<string, any>;
}) => void;
export declare const clearJobs: () => void;
