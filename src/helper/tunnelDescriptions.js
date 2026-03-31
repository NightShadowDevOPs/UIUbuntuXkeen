export const COMMON_TUNNEL_INTERFACE_SUGGESTIONS = [
    'wg0',
    'ovpn-client1',
    'tun0',
    'tailscale0',
];
export const normalizeTunnelDescription = (value) => String(value || '').replace(/\s+/g, ' ').trim();
export const normalizeTunnelInterfaceName = (value) => String(value || '').trim();
export const inferTunnelKindFromName = (name) => {
    const raw = String(name || '').trim().toLowerCase();
    if (!raw)
        return '';
    if (/^(wg|wireguard)/.test(raw) || raw.includes('wireguard') || raw.includes('nordlynx'))
        return 'wireguard';
    if (/^(ovpn|openvpn)/.test(raw) || raw.includes('openvpn'))
        return 'openvpn';
    if (raw.includes('tailscale'))
        return 'tailscale';
    if (raw.includes('zerotier'))
        return 'zerotier';
    if (raw.includes('ipsec') || raw.includes('xfrm'))
        return 'ipsec';
    if (raw.includes('xkeen'))
        return 'xkeen';
    return 'vpn';
};
export const ifaceBaseDisplayName = (name, kind) => {
    const upperKind = (kind || '').toLowerCase();
    if (upperKind === 'xkeen')
        return `XKeen · ${name}`;
    if (upperKind === 'wireguard')
        return `WireGuard · ${name}`;
    if (upperKind === 'tailscale')
        return `Tailscale · ${name}`;
    if (upperKind === 'openvpn' || upperKind === 'ovpn')
        return `OpenVPN · ${name}`;
    if (upperKind === 'zerotier')
        return `ZeroTier · ${name}`;
    if (upperKind === 'ipsec')
        return `IPsec · ${name}`;
    return name;
};
