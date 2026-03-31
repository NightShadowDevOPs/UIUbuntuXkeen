import { nextTick, ref } from 'vue';
const infoConn = ref(null);
const connectionDetailModalShow = ref(false);
export const useConnections = () => {
    const handlerInfo = async (conn) => {
        infoConn.value = null;
        await nextTick();
        infoConn.value = conn;
        connectionDetailModalShow.value = true;
    };
    return {
        infoConn,
        connectionDetailModalShow,
        handlerInfo,
    };
};
