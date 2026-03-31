import { customBackgroundURL } from '@/store/settings';
import dayjs from 'dayjs';
import { computed, ref, watch } from 'vue';
const useIndexedDB = (dbKey) => {
    const cacheMap = new Map();
    const openDatabase = () => new Promise((resolve, reject) => {
        const request = indexedDB.open(dbKey, 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(dbKey)) {
                db.createObjectStore(dbKey, { keyPath: 'key' });
            }
        };
        request.onsuccess = () => {
            const db = request.result;
            const store = db.transaction(dbKey, 'readonly').objectStore(dbKey);
            const cursorRequest = store.openCursor();
            cursorRequest.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    cacheMap.set(cursor.key, cursor.value.value);
                    cursor.continue();
                }
                else {
                    resolve(request.result);
                }
            };
            cursorRequest.onerror = () => reject(cursorRequest.error);
        };
        request.onerror = () => reject(request.error);
    });
    const dbPromise = openDatabase();
    const executeTransaction = async (mode, operation) => {
        const db = await dbPromise;
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(dbKey, mode);
            const store = transaction.objectStore(dbKey);
            const request = operation(store);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    };
    const put = async (key, value) => {
        cacheMap.set(key, value);
        return executeTransaction('readwrite', (store) => store.put({
            key,
            value,
        }));
    };
    const get = async (key) => {
        await dbPromise;
        return cacheMap.get(key);
    };
    const clear = async () => {
        cacheMap.clear();
        return executeTransaction('readwrite', (store) => store.clear());
    };
    const isExists = async (key) => {
        await dbPromise;
        return cacheMap.has(key);
    };
    const del = async (key) => {
        cacheMap.delete(key);
        return executeTransaction('readwrite', (store) => store.delete(key));
    };
    const getAllKeys = async () => {
        await dbPromise;
        return Array.from(cacheMap.keys());
    };
    return {
        put,
        get,
        del,
        getAllKeys,
        isExists,
        clear,
    };
};
const backgroundDB = useIndexedDB('base64');
const backgroundImageKey = 'background-image';
export const saveBase64ToIndexedDB = (val) => backgroundDB.put(backgroundImageKey, val);
export const getBase64FromIndexedDB = () => backgroundDB.get(backgroundImageKey);
export const deleteBase64FromIndexedDB = () => backgroundDB.clear();
export const LOCAL_IMAGE = 'local-image';
const date = dayjs().format('YYYY-MM-DD');
const backgroundInDB = ref('');
const getBackgroundInDB = async () => {
    backgroundInDB.value = (await getBase64FromIndexedDB()) || '';
};
watch(() => customBackgroundURL.value, () => {
    if (customBackgroundURL.value.includes(LOCAL_IMAGE)) {
        getBackgroundInDB();
    }
}, {
    immediate: true,
});
export const backgroundImage = computed(() => {
    if (!customBackgroundURL.value) {
        return '';
    }
    if (customBackgroundURL.value.includes(LOCAL_IMAGE)) {
        return `background-image: url('${backgroundInDB.value}');`;
    }
    return `background-image: url('${customBackgroundURL.value}?v=${date}');`;
});
