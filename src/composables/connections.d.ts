import type { Connection } from '@/types';
export declare const useConnections: () => {
    infoConn: any;
    connectionDetailModalShow: any;
    handlerInfo: (conn: Connection) => Promise<void>;
};
