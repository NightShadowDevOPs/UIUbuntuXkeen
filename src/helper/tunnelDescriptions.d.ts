export declare const COMMON_TUNNEL_INTERFACE_SUGGESTIONS: readonly ["wg0", "ovpn-client1", "tun0", "tailscale0"];
export declare const normalizeTunnelDescription: (value: string) => string;
export declare const normalizeTunnelInterfaceName: (value: string) => string;
export declare const inferTunnelKindFromName: (name: string) => "" | "vpn" | "wireguard" | "openvpn" | "tailscale" | "zerotier" | "ipsec" | "xkeen";
export declare const ifaceBaseDisplayName: (name: string, kind?: string) => string;
