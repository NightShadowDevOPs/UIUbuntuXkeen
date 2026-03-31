import { IP_INFO_API } from '@/constant';
import { IPInfoAPI } from '@/store/settings';
// 2ip.me (public; may have daily limits)
export const getIPFrom2ipMeGeoAPI = async (ip = '') => {
    const response = await fetch('https://api.2ip.me/geo.json?ip=' + encodeURIComponent(ip) + '&t=' + Date.now());
    return (await response.json());
};
export const getIPFrom2ipMeProviderAPI = async (ip = '') => {
    const response = await fetch('https://api.2ip.me/provider.json?ip=' + encodeURIComponent(ip) + '&t=' + Date.now());
    return (await response.json());
};
// 2ip.io (token required)
export const getIPFrom2ipIoAPI = async (token) => {
    const response = await fetch('https://api.2ip.io?token=' + encodeURIComponent(token) + '&t=' + Date.now());
    return (await response.json());
};
// china
export const getIPFromIpipnetAPI = async () => {
    const response = await fetch('https://myip.ipip.net/json?t=' + Date.now());
    return (await response.json());
};
// global
const getIPFromIpsbAPI = async (ip = '') => {
    const response = await fetch('https://api.ip.sb/geoip' + (ip ? `/${ip}` : '') + '?t=' + Date.now());
    return (await response.json());
};
const getIPFromIPWhoisAPI = async (ip = '') => {
    const response = await fetch('https://ipwho.is' + (ip ? `/${ip}` : '') + '?t=' + Date.now());
    return (await response.json());
};
const getIPFromIPapiisAPI = async (ip = '') => {
    const response = await fetch('https://api.ipapi.is' + (ip ? `/?q=${ip}` : '') + (ip ? '&' : '?') + 't=' + Date.now());
    return (await response.json());
};
export const getIPInfoFromIPSB = async (ip = '') => {
    const ipsb = await getIPFromIpsbAPI(ip);
    return {
        ip: ipsb.ip,
        country: ipsb.country,
        region: ipsb.region,
        city: ipsb.city,
        asn: ipsb.asn.toString(),
        organization: ipsb.organization,
    };
};
export const getIPInfoFromIPWHOIS = async (ip = '') => {
    const ipwhois = await getIPFromIPWhoisAPI(ip);
    return {
        ip: ipwhois.ip,
        region: ipwhois.region,
        country: ipwhois.country,
        city: ipwhois.city,
        asn: ipwhois.connection.asn.toString(),
        organization: ipwhois.connection.org,
    };
};
export const getIPInfoFromIPAPI = async (ip = '') => {
    const ipapi = await getIPFromIPapiisAPI(ip);
    return {
        ip: ipapi.ip,
        country: ipapi.location.country,
        region: ipapi.location.state,
        city: ipapi.location.city,
        asn: ipapi.asn.asn.toString(),
        organization: ipapi.asn.org,
    };
};
export const getIPInfoFromWHATISMYIP = async (ip = '') => {
    const url = 'https://www.whatismyip.net/geoip/' +
        (ip ? '?ip=' + encodeURIComponent(ip) + '&t=' + Date.now() : '?t=' + Date.now());
    const response = await fetch(url);
    const data = await response.json();
    return {
        ip: String(data?.ip || ip || ''),
        country: String(data?.country || data?.country_name || ''),
        region: String(data?.region || data?.state || data?.region_name || ''),
        city: String(data?.city || ''),
        asn: String(data?.asn || data?.as || data?.as_number || ''),
        organization: String(data?.org || data?.isp || data?.organization || ''),
    };
};
export const getIPInfo = async (ip = '') => {
    switch (IPInfoAPI.value) {
        case IP_INFO_API.IPAPI: {
            return await getIPInfoFromIPAPI(ip);
        }
        case IP_INFO_API.IPWHOIS: {
            return await getIPInfoFromIPWHOIS(ip);
        }
        case IP_INFO_API.IPSB:
        default: {
            return await getIPInfoFromIPSB(ip);
        }
    }
};
