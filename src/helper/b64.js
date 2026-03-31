export const decodeB64Utf8 = (b64) => {
    if (!b64)
        return '';
    try {
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++)
            bytes[i] = bin.charCodeAt(i);
        // TextDecoder is widely supported in modern browsers.
        return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    }
    catch {
        try {
            return atob(b64);
        }
        catch {
            return '';
        }
    }
};
