import { useStorage } from '@vueuse/core';
export const DEFAULT_LIMIT_PROFILES = [
    {
        id: 'unlimited',
        name: 'Unlimited',
        enabled: true,
        trafficLimitBytes: 0,
        trafficLimitUnit: 'GB',
        trafficPeriod: '30d',
        bandwidthLimitBps: 0,
    },
    {
        id: 'guest',
        name: 'Guest',
        enabled: true,
        trafficLimitBytes: 500 * 1024 * 1024,
        trafficLimitUnit: 'MB',
        trafficPeriod: '1d',
        bandwidthLimitBps: Math.round((10 * 1024 * 1024) / 8), // 10 Mbps
    },
    {
        id: 'kids',
        name: 'Kids',
        enabled: true,
        trafficLimitBytes: 2 * 1024 * 1024 * 1024,
        trafficLimitUnit: 'GB',
        trafficPeriod: '30d',
        bandwidthLimitBps: Math.round((5 * 1024 * 1024) / 8), // 5 Mbps
    },
    {
        id: 'work',
        name: 'Work',
        enabled: true,
        trafficLimitBytes: 50 * 1024 * 1024 * 1024,
        trafficLimitUnit: 'GB',
        trafficPeriod: '30d',
        bandwidthLimitBps: Math.round((30 * 1024 * 1024) / 8), // 30 Mbps
    },
];
export const userLimitProfiles = useStorage('config/user-limit-profiles-v1', DEFAULT_LIMIT_PROFILES);
