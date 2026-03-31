import { fetchSmartGroupWeightsAPI } from '@/api';
import { ref } from 'vue';
export const smartWeightsMap = ref({});
export const fetchSmartGroupWeights = async (proxyName) => {
    const { data } = await fetchSmartGroupWeightsAPI(proxyName);
    smartWeightsMap.value[proxyName] = data.weights;
};
