import { buildRuleRaw, parseRuleRaw } from '@/helper/mihomoConfigRules';
const SIMPLE_YAML_KEY_RE = /^[A-Za-z0-9_.@-]+$/;
const normalizeText = (value) => String(value || '').replace(/\r\n/g, '\n');
const escapeRegExp = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const unquoteYamlValue = (value) => {
    const trimmed = String(value || '').trim();
    if (!trimmed)
        return '';
    const withoutComment = trimmed.replace(/\s+#.*$/, '').trim();
    if ((withoutComment.startsWith("'") && withoutComment.endsWith("'")) || (withoutComment.startsWith('"') && withoutComment.endsWith('"'))) {
        return withoutComment.slice(1, -1);
    }
    return withoutComment;
};
const quoteYamlScalar = (value, mode = 'string') => {
    const trimmed = String(value || '').trim();
    if (!trimmed)
        return '';
    if (mode === 'number' && /^-?\d+$/.test(trimmed))
        return trimmed;
    if (mode === 'boolean') {
        if (/^(true|false)$/i.test(trimmed))
            return trimmed.toLowerCase();
        return JSON.stringify(trimmed);
    }
    if (mode === 'auto') {
        if (/^(true|false)$/i.test(trimmed))
            return trimmed.toLowerCase();
        if (/^-?\d+(?:\.\d+)?$/.test(trimmed))
            return trimmed;
    }
    return JSON.stringify(trimmed);
};
const dedentBlock = (value) => {
    const normalized = normalizeText(value);
    const lines = normalized.split('\n');
    while (lines.length && !String(lines[0] || '').trim().length)
        lines.shift();
    while (lines.length && !String(lines[lines.length - 1] || '').trim().length)
        lines.pop();
    if (!lines.length)
        return '';
    const indents = lines
        .filter((line) => String(line || '').trim().length > 0)
        .map((line) => {
        const match = String(line || '').match(/^\s*/);
        return match ? match[0].length : 0;
    });
    const minIndent = indents.length ? Math.min(...indents) : 0;
    return lines.map((line) => (line.length >= minIndent ? line.slice(minIndent) : line.trimStart())).join('\n');
};
const indentBlock = (value, indent) => {
    const normalized = dedentBlock(value);
    if (!normalized.length)
        return [];
    const prefix = ' '.repeat(indent);
    return normalized.split('\n').map((line) => (line.length ? `${prefix}${line}` : ''));
};
const parseListText = (value) => String(value || '')
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
const formatListText = (items) => items.join('\n');
const findTopLevelSectionRange = (lines, section) => {
    const start = lines.findIndex((line) => new RegExp(`^${escapeRegExp(section)}:\\s*(?:#.*)?$`).test(line || ''));
    if (start < 0)
        return null;
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i += 1) {
        const line = String(lines[i] || '');
        if (!line.trim().length || /^\s*#/.test(line))
            continue;
        if (!/^\s/.test(line)) {
            end = i;
            break;
        }
    }
    return { start, end };
};
const collectProxyBlocks = (lines) => {
    const range = findTopLevelSectionRange(lines, 'proxies');
    const blocks = [];
    if (!range)
        return { range, blocks };
    let currentStart = -1;
    for (let i = range.start + 1; i < range.end; i += 1) {
        const line = String(lines[i] || '');
        if (/^\s{2}-\s+/.test(line)) {
            if (currentStart >= 0)
                blocks.push({ start: currentStart, end: i, lines: lines.slice(currentStart, i) });
            currentStart = i;
        }
    }
    if (currentStart >= 0)
        blocks.push({ start: currentStart, end: range.end, lines: lines.slice(currentStart, range.end) });
    return { range, blocks };
};
const parseInlineList = (raw) => {
    const trimmed = String(raw || '').trim();
    if (!trimmed.length)
        return [];
    return trimmed
        .split(',')
        .map((item) => unquoteYamlValue(item))
        .map((item) => item.trim())
        .filter(Boolean);
};
const collectTopLevelList = (blockLines, key) => {
    const inlineRe = new RegExp(`^\\s{4}${escapeRegExp(key)}:\\s*\\[(.*)\\]\\s*(?:#.*)?$`);
    const headerRe = new RegExp(`^\\s{4}${escapeRegExp(key)}:\\s*(?:#.*)?$`);
    for (let i = 0; i < blockLines.length; i += 1) {
        const line = String(blockLines[i] || '');
        const inlineMatch = line.match(inlineRe);
        if (inlineMatch)
            return parseInlineList(inlineMatch[1]);
        if (headerRe.test(line)) {
            const out = [];
            for (let j = i + 1; j < blockLines.length; j += 1) {
                const nestedLine = String(blockLines[j] || '');
                if (!nestedLine.trim().length || /^\s{6}#/.test(nestedLine))
                    continue;
                if (!/^\s{6}-\s*/.test(nestedLine))
                    break;
                out.push(unquoteYamlValue(nestedLine.replace(/^\s{6}-\s*/, '')));
            }
            return out;
        }
    }
    return [];
};
const getNestedBlockLines = (blockLines, key) => {
    const headerRe = new RegExp(`^\\s{4}${escapeRegExp(key)}:\\s*(?:#.*)?$`);
    for (let i = 0; i < blockLines.length; i += 1) {
        const line = String(blockLines[i] || '');
        if (!headerRe.test(line))
            continue;
        let end = i + 1;
        for (; end < blockLines.length; end += 1) {
            const nestedLine = String(blockLines[end] || '');
            if (!nestedLine.trim().length || /^\s*#/.test(nestedLine))
                continue;
            if (/^\s{4}\S/.test(nestedLine) || /^\s{2}-\s+/.test(nestedLine))
                break;
        }
        return blockLines.slice(i + 1, end);
    }
    return [];
};
const nestedBlockToBody = (blockLines, key) => dedentBlock(getNestedBlockLines(blockLines, key).join('\n'));
const extractScalarFromBlock = (blockLines, key) => {
    const re = new RegExp(`^\\s{4}${escapeRegExp(key)}:\\s*(.*?)\\s*$`);
    for (const line of blockLines) {
        const match = String(line || '').match(re);
        if (match)
            return unquoteYamlValue(match[1]);
    }
    return '';
};
const extractNestedScalar = (value, key) => {
    const lines = normalizeText(value).split('\n');
    const re = new RegExp(`^${escapeRegExp(key)}:\\s*(.*?)\\s*$`);
    for (const line of lines) {
        const match = String(line || '').match(re);
        if (match)
            return unquoteYamlValue(match[1]);
    }
    return '';
};
const removeNestedScalar = (value, key) => {
    const normalized = normalizeText(value);
    if (!normalized.trim().length)
        return '';
    const lines = normalized.split('\n');
    const re = new RegExp(`^${escapeRegExp(key)}:\\s*(.*?)\\s*$`);
    const next = lines.filter((line) => !re.test(String(line || ''))).join('\n');
    return dedentBlock(next);
};
const extractNestedMapBody = (value, key) => {
    const lines = normalizeText(value).split('\n');
    const headerRe = new RegExp(`^${escapeRegExp(key)}:\\s*(?:#.*)?$`);
    for (let i = 0; i < lines.length; i += 1) {
        if (!headerRe.test(String(lines[i] || '')))
            continue;
        let end = i + 1;
        for (; end < lines.length; end += 1) {
            const line = String(lines[end] || '');
            if (!line.trim().length || /^\s*#/.test(line))
                continue;
            if (!/^\s{2}/.test(line))
                break;
        }
        return dedentBlock(lines.slice(i + 1, end).join('\n'));
    }
    return '';
};
const removeNestedMapBody = (value, key) => {
    const normalized = normalizeText(value);
    if (!normalized.trim().length)
        return '';
    const lines = normalized.split('\n');
    const headerRe = new RegExp(`^${escapeRegExp(key)}:\\s*(?:#.*)?$`);
    for (let i = 0; i < lines.length; i += 1) {
        if (!headerRe.test(String(lines[i] || '')))
            continue;
        let end = i + 1;
        for (; end < lines.length; end += 1) {
            const line = String(lines[end] || '');
            if (!line.trim().length || /^\s*#/.test(line))
                continue;
            if (!/^\s{2}/.test(line))
                break;
        }
        lines.splice(i, Math.max(1, end - i));
        break;
    }
    return dedentBlock(lines.join('\n'));
};
const parseProxyEntry = (blockLines) => {
    const form = emptyProxyForm();
    const first = String(blockLines[0] || '');
    const firstMatch = first.match(/^\s{2}-\s+name:\s*(.*?)\s*$/);
    if (firstMatch)
        form.name = unquoteYamlValue(firstMatch[1]);
    form.type = extractScalarFromBlock(blockLines, 'type');
    form.server = extractScalarFromBlock(blockLines, 'server');
    form.port = extractScalarFromBlock(blockLines, 'port');
    form.udp = extractScalarFromBlock(blockLines, 'udp');
    form.tfo = extractScalarFromBlock(blockLines, 'tfo');
    form.tls = extractScalarFromBlock(blockLines, 'tls');
    form.skipCertVerify = extractScalarFromBlock(blockLines, 'skip-cert-verify');
    form.sni = extractScalarFromBlock(blockLines, 'sni');
    form.servername = extractScalarFromBlock(blockLines, 'servername');
    form.clientFingerprint = extractScalarFromBlock(blockLines, 'client-fingerprint');
    form.network = extractScalarFromBlock(blockLines, 'network');
    form.dialerProxy = extractScalarFromBlock(blockLines, 'dialer-proxy');
    form.interfaceName = extractScalarFromBlock(blockLines, 'interface-name');
    form.packetEncoding = extractScalarFromBlock(blockLines, 'packet-encoding');
    form.uuid = extractScalarFromBlock(blockLines, 'uuid');
    form.password = extractScalarFromBlock(blockLines, 'password');
    form.cipher = extractScalarFromBlock(blockLines, 'cipher');
    form.flow = extractScalarFromBlock(blockLines, 'flow');
    form.alpnText = formatListText(collectTopLevelList(blockLines, 'alpn'));
    const wsBody = nestedBlockToBody(blockLines, 'ws-opts');
    form.wsPath = extractNestedScalar(wsBody, 'path');
    form.wsHeadersBody = extractNestedMapBody(wsBody, 'headers');
    const grpcBody = nestedBlockToBody(blockLines, 'grpc-opts');
    form.grpcServiceName = extractNestedScalar(grpcBody, 'grpc-service-name');
    form.grpcMultiMode = extractNestedScalar(grpcBody, 'multi-mode');
    const httpBody = nestedBlockToBody(blockLines, 'http-opts');
    form.httpMethod = extractNestedScalar(httpBody, 'method');
    form.httpPathText = formatListText(parseListText(extractNestedMapBody(httpBody, 'path')));
    form.httpHeadersBody = extractNestedMapBody(httpBody, 'headers');
    const smuxBody = nestedBlockToBody(blockLines, 'smux');
    form.smuxEnabled = extractNestedScalar(smuxBody, 'enabled');
    form.smuxProtocol = extractNestedScalar(smuxBody, 'protocol');
    form.smuxMaxConnections = extractNestedScalar(smuxBody, 'max-connections');
    form.smuxMinStreams = extractNestedScalar(smuxBody, 'min-streams');
    form.smuxMaxStreams = extractNestedScalar(smuxBody, 'max-streams');
    form.smuxPadding = extractNestedScalar(smuxBody, 'padding');
    form.smuxStatistic = extractNestedScalar(smuxBody, 'statistic');
    form.wireguardIpText = formatListText(collectTopLevelList(blockLines, 'ip'));
    form.wireguardIpv6Text = formatListText(collectTopLevelList(blockLines, 'ipv6'));
    form.wireguardPrivateKey = extractScalarFromBlock(blockLines, 'private-key');
    form.wireguardPublicKey = extractScalarFromBlock(blockLines, 'public-key');
    form.wireguardPresharedKey = extractScalarFromBlock(blockLines, 'pre-shared-key');
    form.wireguardMtu = extractScalarFromBlock(blockLines, 'mtu');
    form.wireguardReservedText = formatListText(collectTopLevelList(blockLines, 'reserved'));
    form.wireguardWorkers = extractScalarFromBlock(blockLines, 'workers');
    form.hysteriaUp = extractScalarFromBlock(blockLines, 'up');
    form.hysteriaDown = extractScalarFromBlock(blockLines, 'down');
    form.hysteriaObfs = extractScalarFromBlock(blockLines, 'obfs');
    form.hysteriaObfsPassword = extractScalarFromBlock(blockLines, 'obfs-password');
    form.tuicCongestionController = extractScalarFromBlock(blockLines, 'congestion-controller');
    form.tuicUdpRelayMode = extractScalarFromBlock(blockLines, 'udp-relay-mode');
    form.tuicHeartbeatInterval = extractScalarFromBlock(blockLines, 'heartbeat-interval');
    form.tuicRequestTimeout = extractScalarFromBlock(blockLines, 'request-timeout');
    form.tuicFastOpen = extractScalarFromBlock(blockLines, 'fast-open');
    form.tuicReduceRtt = extractScalarFromBlock(blockLines, 'reduce-rtt');
    form.tuicDisableSni = extractScalarFromBlock(blockLines, 'disable-sni');
    form.plugin = extractScalarFromBlock(blockLines, 'plugin');
    form.pluginOptsBody = nestedBlockToBody(blockLines, 'plugin-opts');
    const realityBody = nestedBlockToBody(blockLines, 'reality-opts');
    form.realityPublicKey = extractNestedScalar(realityBody, 'public-key');
    form.realityShortId = extractNestedScalar(realityBody, 'short-id');
    const retained = [];
    let i = 1;
    while (i < blockLines.length) {
        const line = String(blockLines[i] || '');
        if (!line.trim().length || /^\s*#/.test(line)) {
            retained.push(line);
            i += 1;
            continue;
        }
        const topMatch = line.match(/^\s{4}([^:#]+):\s*(.*)$/);
        if (!topMatch) {
            retained.push(line);
            i += 1;
            continue;
        }
        const key = String(topMatch[1] || '').trim();
        let end = i + 1;
        for (; end < blockLines.length; end += 1) {
            const nextLine = String(blockLines[end] || '');
            if (!nextLine.trim().length || /^\s*#/.test(nextLine))
                continue;
            if (/^\s{4}\S/.test(nextLine))
                break;
        }
        const slice = blockLines.slice(i, end);
        if ([
            'name', 'type', 'server', 'port', 'udp', 'tfo', 'tls', 'skip-cert-verify', 'sni', 'servername', 'client-fingerprint', 'network',
            'dialer-proxy', 'interface-name', 'packet-encoding', 'uuid', 'password', 'cipher', 'flow', 'alpn', 'ws-opts', 'grpc-opts',
            'http-opts', 'smux', 'ip', 'ipv6', 'private-key', 'public-key', 'pre-shared-key', 'mtu', 'reserved', 'workers',
            'up', 'down', 'obfs', 'obfs-password', 'congestion-controller', 'udp-relay-mode', 'heartbeat-interval', 'request-timeout',
            'fast-open', 'reduce-rtt', 'disable-sni', 'plugin', 'plugin-opts', 'reality-opts',
        ].includes(key)) {
            i = end;
            continue;
        }
        retained.push(...slice);
        i = end;
    }
    const references = [];
    return {
        name: form.name,
        type: form.type,
        server: form.server,
        port: form.port,
        udp: form.udp,
        tfo: form.tfo,
        tls: form.tls,
        skipCertVerify: form.skipCertVerify,
        sni: form.sni,
        servername: form.servername,
        clientFingerprint: form.clientFingerprint,
        network: form.network,
        dialerProxy: form.dialerProxy,
        interfaceName: form.interfaceName,
        packetEncoding: form.packetEncoding,
        uuid: form.uuid,
        password: form.password,
        cipher: form.cipher,
        flow: form.flow,
        alpn: parseListText(form.alpnText),
        wsPath: form.wsPath,
        wsHeadersBody: dedentBlock(form.wsHeadersBody),
        grpcServiceName: form.grpcServiceName,
        grpcMultiMode: form.grpcMultiMode,
        httpMethod: form.httpMethod,
        httpPath: parseListText(form.httpPathText),
        httpHeadersBody: dedentBlock(form.httpHeadersBody),
        smuxEnabled: form.smuxEnabled,
        smuxProtocol: form.smuxProtocol,
        smuxMaxConnections: form.smuxMaxConnections,
        smuxMinStreams: form.smuxMinStreams,
        smuxMaxStreams: form.smuxMaxStreams,
        smuxPadding: form.smuxPadding,
        smuxStatistic: form.smuxStatistic,
        wireguardIp: parseListText(form.wireguardIpText),
        wireguardIpv6: parseListText(form.wireguardIpv6Text),
        wireguardPrivateKey: form.wireguardPrivateKey,
        wireguardPublicKey: form.wireguardPublicKey,
        wireguardPresharedKey: form.wireguardPresharedKey,
        wireguardMtu: form.wireguardMtu,
        wireguardReserved: parseListText(form.wireguardReservedText),
        wireguardWorkers: form.wireguardWorkers,
        hysteriaUp: form.hysteriaUp,
        hysteriaDown: form.hysteriaDown,
        hysteriaObfs: form.hysteriaObfs,
        hysteriaObfsPassword: form.hysteriaObfsPassword,
        tuicCongestionController: form.tuicCongestionController,
        tuicUdpRelayMode: form.tuicUdpRelayMode,
        tuicHeartbeatInterval: form.tuicHeartbeatInterval,
        tuicRequestTimeout: form.tuicRequestTimeout,
        tuicFastOpen: form.tuicFastOpen,
        tuicReduceRtt: form.tuicReduceRtt,
        tuicDisableSni: form.tuicDisableSni,
        plugin: form.plugin,
        pluginOptsBody: dedentBlock(form.pluginOptsBody),
        realityPublicKey: form.realityPublicKey,
        realityShortId: form.realityShortId,
        extraBody: dedentBlock(retained.join('\n')),
        rawBlock: blockLines.join('\n'),
        references,
    };
};
const quoteYamlKey = (value) => (SIMPLE_YAML_KEY_RE.test(String(value || '').trim()) ? String(value || '').trim() : JSON.stringify(String(value || '').trim()));
const buildProxyBlock = (form) => {
    const name = String(form.name || '').trim();
    if (!name)
        return [];
    const lines = [`  - name: ${quoteYamlScalar(name)}`];
    const appendScalar = (key, rawValue, mode = 'string') => {
        const cleaned = String(rawValue || '').trim();
        if (!cleaned.length)
            return;
        lines.push(`    ${key}: ${quoteYamlScalar(cleaned, mode)}`);
    };
    const appendList = (key, rawValue) => {
        const items = parseListText(rawValue);
        if (!items.length)
            return;
        lines.push(`    ${key}:`);
        lines.push(...items.map((item) => `      - ${quoteYamlScalar(item)}`));
    };
    const appendNestedMap = (key, body, indent = 6) => {
        const normalized = dedentBlock(body);
        if (!normalized.length)
            return;
        lines.push(`    ${key}:`);
        lines.push(...indentBlock(normalized, indent));
    };
    appendScalar('type', form.type);
    appendScalar('server', form.server);
    appendScalar('port', form.port, 'auto');
    appendScalar('udp', form.udp, 'boolean');
    appendScalar('tfo', form.tfo, 'boolean');
    appendScalar('tls', form.tls, 'boolean');
    appendScalar('skip-cert-verify', form.skipCertVerify, 'boolean');
    appendScalar('sni', form.sni);
    appendScalar('servername', form.servername);
    appendScalar('client-fingerprint', form.clientFingerprint);
    appendScalar('network', form.network);
    appendScalar('dialer-proxy', form.dialerProxy);
    appendScalar('interface-name', form.interfaceName);
    appendScalar('packet-encoding', form.packetEncoding);
    appendScalar('uuid', form.uuid);
    appendScalar('password', form.password);
    appendScalar('cipher', form.cipher);
    appendScalar('flow', form.flow);
    const alpnItems = parseListText(form.alpnText);
    if (alpnItems.length) {
        lines.push('    alpn:');
        lines.push(...alpnItems.map((item) => `      - ${quoteYamlScalar(item)}`));
    }
    const wsBody = [];
    const wsPath = String(form.wsPath || '').trim();
    if (wsPath.length)
        wsBody.push(`      path: ${quoteYamlScalar(wsPath)}`);
    const wsHeaders = dedentBlock(form.wsHeadersBody);
    if (wsHeaders.length) {
        wsBody.push('      headers:');
        wsBody.push(...indentBlock(wsHeaders, 8));
    }
    if (wsBody.length)
        lines.push('    ws-opts:', ...wsBody);
    const grpcBody = [];
    const grpcServiceName = String(form.grpcServiceName || '').trim();
    const grpcMultiMode = String(form.grpcMultiMode || '').trim();
    if (grpcServiceName.length)
        grpcBody.push(`      grpc-service-name: ${quoteYamlScalar(grpcServiceName)}`);
    if (grpcMultiMode.length)
        grpcBody.push(`      multi-mode: ${quoteYamlScalar(grpcMultiMode, 'boolean')}`);
    if (grpcBody.length)
        lines.push('    grpc-opts:', ...grpcBody);
    const httpBody = [];
    const httpMethod = String(form.httpMethod || '').trim();
    const httpPaths = parseListText(form.httpPathText);
    if (httpMethod.length)
        httpBody.push(`      method: ${quoteYamlScalar(httpMethod)}`);
    if (httpPaths.length) {
        httpBody.push('      path:');
        httpBody.push(...httpPaths.map((item) => `        - ${quoteYamlScalar(item)}`));
    }
    const httpHeaders = dedentBlock(form.httpHeadersBody);
    if (httpHeaders.length) {
        httpBody.push('      headers:');
        httpBody.push(...indentBlock(httpHeaders, 8));
    }
    if (httpBody.length)
        lines.push('    http-opts:', ...httpBody);
    const smuxBody = [];
    const appendSmuxScalar = (key, rawValue, mode = 'string') => {
        const cleaned = String(rawValue || '').trim();
        if (!cleaned.length)
            return;
        smuxBody.push(`      ${key}: ${quoteYamlScalar(cleaned, mode)}`);
    };
    appendSmuxScalar('enabled', form.smuxEnabled, 'boolean');
    appendSmuxScalar('protocol', form.smuxProtocol);
    appendSmuxScalar('max-connections', form.smuxMaxConnections, 'auto');
    appendSmuxScalar('min-streams', form.smuxMinStreams, 'auto');
    appendSmuxScalar('max-streams', form.smuxMaxStreams, 'auto');
    appendSmuxScalar('padding', form.smuxPadding, 'boolean');
    appendSmuxScalar('statistic', form.smuxStatistic, 'boolean');
    if (smuxBody.length)
        lines.push('    smux:', ...smuxBody);
    appendList('ip', form.wireguardIpText);
    appendList('ipv6', form.wireguardIpv6Text);
    appendScalar('private-key', form.wireguardPrivateKey);
    appendScalar('public-key', form.wireguardPublicKey);
    appendScalar('pre-shared-key', form.wireguardPresharedKey);
    appendScalar('mtu', form.wireguardMtu, 'auto');
    appendList('reserved', form.wireguardReservedText);
    appendScalar('workers', form.wireguardWorkers, 'auto');
    appendScalar('up', form.hysteriaUp);
    appendScalar('down', form.hysteriaDown);
    appendScalar('obfs', form.hysteriaObfs);
    appendScalar('obfs-password', form.hysteriaObfsPassword);
    appendScalar('congestion-controller', form.tuicCongestionController);
    appendScalar('udp-relay-mode', form.tuicUdpRelayMode);
    appendScalar('heartbeat-interval', form.tuicHeartbeatInterval);
    appendScalar('request-timeout', form.tuicRequestTimeout);
    appendScalar('fast-open', form.tuicFastOpen, 'boolean');
    appendScalar('reduce-rtt', form.tuicReduceRtt, 'boolean');
    appendScalar('disable-sni', form.tuicDisableSni, 'boolean');
    appendScalar('plugin', form.plugin);
    appendNestedMap('plugin-opts', form.pluginOptsBody);
    const realityBody = [];
    const realityPublicKey = String(form.realityPublicKey || '').trim();
    const realityShortId = String(form.realityShortId || '').trim();
    if (realityPublicKey.length)
        realityBody.push(`      public-key: ${quoteYamlScalar(realityPublicKey)}`);
    if (realityShortId.length)
        realityBody.push(`      short-id: ${quoteYamlScalar(realityShortId)}`);
    if (realityBody.length)
        lines.push('    reality-opts:', ...realityBody);
    const extraBody = dedentBlock(form.extraBody);
    if (extraBody.length)
        lines.push(...indentBlock(extraBody, 4));
    return lines;
};
const groupHasProxyRefs = (blockLines) => collectTopLevelList(blockLines, 'proxies').length > 0;
const ensureGroupFallbackDirect = (blockLines) => {
    const lines = [...blockLines];
    const inlineRe = /^\s{4}proxies:\s*\[(.*)\]\s*(?:#.*)?$/;
    const headerRe = /^\s{4}proxies:\s*(?:#.*)?$/;
    for (let i = 0; i < lines.length; i += 1) {
        const line = String(lines[i] || '');
        const inlineMatch = line.match(inlineRe);
        if (inlineMatch) {
            const items = parseInlineList(inlineMatch[1]);
            if (!items.length)
                lines[i] = '    proxies: ["DIRECT"]';
            return lines;
        }
        if (headerRe.test(line)) {
            let end = i + 1;
            const items = [];
            for (; end < lines.length; end += 1) {
                const nestedLine = String(lines[end] || '');
                if (!nestedLine.trim().length || /^\s{6}#/.test(nestedLine))
                    continue;
                if (!/^\s{6}-\s*/.test(nestedLine))
                    break;
                items.push(unquoteYamlValue(nestedLine.replace(/^\s{6}-\s*/, '')));
            }
            if (!items.length)
                lines.splice(i, Math.max(1, end - i), '    proxies:', '      - "DIRECT"');
            return lines;
        }
    }
    lines.push('    proxies:', '      - "DIRECT"');
    return lines;
};
const rewriteNamedArrayInGroupBlock = (blockLines, key, target, replacement = '') => {
    const lines = [...blockLines];
    const normalizedTarget = String(target || '').trim();
    const normalizedReplacement = String(replacement || '').trim();
    const inlineRe = new RegExp(`^(\\s{4}${escapeRegExp(key)}:\\s*)\\[(.*)\\](\\s*(?:#.*)?)$`);
    const headerRe = new RegExp(`^\\s{4}${escapeRegExp(key)}:\\s*(?:#.*)?$`);
    for (let i = 0; i < lines.length; i += 1) {
        const line = String(lines[i] || '');
        const inlineMatch = line.match(inlineRe);
        if (inlineMatch) {
            const before = parseInlineList(inlineMatch[2]);
            const after = before
                .map((item) => (item === normalizedTarget && normalizedReplacement.length ? normalizedReplacement : item))
                .filter((item) => item !== normalizedTarget || normalizedReplacement.length > 0);
            const changed = before.length !== after.length || before.some((item, index) => after[index] !== item);
            if (!changed)
                return { lines, changed: false, empty: after.length === 0 };
            const nextInline = after.length ? `[${after.map((item) => quoteYamlScalar(item)).join(', ')}]` : '[]';
            lines[i] = `${inlineMatch[1]}${nextInline}${inlineMatch[3] || ''}`;
            return { lines, changed: true, empty: after.length === 0 };
        }
        if (headerRe.test(line)) {
            let end = i + 1;
            const before = [];
            for (; end < lines.length; end += 1) {
                const nestedLine = String(lines[end] || '');
                if (!nestedLine.trim().length || /^\s{6}#/.test(nestedLine))
                    continue;
                if (!/^\s{6}-\s*/.test(nestedLine))
                    break;
                before.push(unquoteYamlValue(nestedLine.replace(/^\s{6}-\s*/, '')));
            }
            const after = before
                .map((item) => (item === normalizedTarget && normalizedReplacement.length ? normalizedReplacement : item))
                .filter((item) => item !== normalizedTarget || normalizedReplacement.length > 0);
            const changed = before.length !== after.length || before.some((item, index) => after[index] !== item);
            if (!changed)
                return { lines, changed: false, empty: after.length === 0 };
            const replacementLines = after.length ? [`    ${key}:`, ...after.map((item) => `      - ${quoteYamlScalar(item)}`)] : [`    ${key}: []`];
            lines.splice(i, Math.max(1, end - i), ...replacementLines);
            return { lines, changed: true, empty: after.length === 0 };
        }
    }
    return { lines, changed: false, empty: true };
};
const rewriteProxyRefsInGroups = (value, proxyName, replacement = '') => {
    const normalized = normalizeText(value);
    const lines = normalized.length ? normalized.split('\n') : [];
    const range = findTopLevelSectionRange(lines, 'proxy-groups');
    if (!range)
        return { lines, touchedGroups: [] };
    const groupBlocks = [];
    let currentStart = -1;
    for (let i = range.start + 1; i < range.end; i += 1) {
        const line = String(lines[i] || '');
        if (/^\s{2}-\s+/.test(line)) {
            if (currentStart >= 0)
                groupBlocks.push({ start: currentStart, end: i, lines: lines.slice(currentStart, i) });
            currentStart = i;
        }
    }
    if (currentStart >= 0)
        groupBlocks.push({ start: currentStart, end: range.end, lines: lines.slice(currentStart, range.end) });
    const touchedGroups = [];
    for (let idx = groupBlocks.length - 1; idx >= 0; idx -= 1) {
        const block = groupBlocks[idx];
        const groupName = (() => {
            const matchInline = String(block.lines[0] || '').match(/^\s{2}-\s+name:\s*(.*?)\s*$/);
            if (matchInline)
                return unquoteYamlValue(matchInline[1]);
            return '—';
        })();
        const result = rewriteNamedArrayInGroupBlock(block.lines, 'proxies', proxyName, replacement);
        if (!result.changed)
            continue;
        let nextBlock = result.lines;
        let fallbackInjected = false;
        if (!replacement && !groupHasProxyRefs(nextBlock)) {
            const hasUse = collectTopLevelList(nextBlock, 'use').length > 0;
            const hasProviders = collectTopLevelList(nextBlock, 'providers').length > 0;
            if (!hasUse && !hasProviders) {
                nextBlock = ensureGroupFallbackDirect(nextBlock);
                fallbackInjected = true;
            }
        }
        touchedGroups.push({ group: groupName, fallbackInjected });
        lines.splice(block.start, block.end - block.start, ...nextBlock);
    }
    return { lines, touchedGroups: touchedGroups.reverse() };
};
const rewriteProxyTargetsInRules = (value, proxyName, replacement = '') => {
    const normalized = normalizeText(value);
    const lines = normalized.length ? normalized.split('\n') : [];
    const range = findTopLevelSectionRange(lines, 'rules');
    if (!range)
        return { lines, touchedCount: 0, samples: [] };
    let touchedCount = 0;
    const samples = [];
    const nextTarget = String(replacement || '').trim() || 'DIRECT';
    for (let i = range.start + 1; i < range.end; i += 1) {
        const line = String(lines[i] || '');
        if (!/^\s{2}-\s*/.test(line))
            continue;
        const parsed = parseRuleRaw(line);
        if (String(parsed.target || '').trim() !== proxyName)
            continue;
        const rebuilt = buildRuleRaw({ type: parsed.type, payload: parsed.payload, target: nextTarget, paramsText: parsed.params.join('\n') });
        if (!rebuilt.length)
            continue;
        lines[i] = `  - ${rebuilt}`;
        touchedCount += 1;
        if (samples.length < 6)
            samples.push({ kind: 'rule', text: rebuilt, lineNo: i + 1 });
    }
    return { lines, touchedCount, samples };
};
const joinYaml = (lines) => {
    const joined = lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
    return joined ? `${joined}\n` : '';
};
const insertProxiesSectionIfMissing = (lines, blockLines) => {
    const preferredAnchors = ['proxy-groups', 'proxy-providers', 'rule-providers', 'rules'];
    let insertAt = lines.findIndex((line) => preferredAnchors.some((key) => new RegExp(`^${escapeRegExp(key)}:\\s*(?:#.*)?$`).test(String(line || ''))));
    if (insertAt < 0)
        insertAt = lines.length;
    const sectionLines = ['proxies:', ...blockLines];
    if (insertAt > 0 && String(lines[insertAt - 1] || '').trim().length)
        sectionLines.unshift('');
    lines.splice(insertAt, 0, ...sectionLines);
};
const collectProxyReferences = (value, proxyName) => {
    const refs = [];
    if (!proxyName)
        return refs;
    const normalized = normalizeText(value);
    const lines = normalized.length ? normalized.split('\n') : [];
    const groupRange = findTopLevelSectionRange(lines, 'proxy-groups');
    if (groupRange) {
        let currentGroup = '';
        for (let i = groupRange.start + 1; i < groupRange.end; i += 1) {
            const line = String(lines[i] || '');
            const groupMatch = line.match(/^\s{2}-\s+name:\s*(.*?)\s*$/);
            if (groupMatch) {
                currentGroup = unquoteYamlValue(groupMatch[1]);
                continue;
            }
            if (!currentGroup)
                continue;
            if (/^\s{4}proxies:\s*\[(.*)\]\s*(?:#.*)?$/.test(line)) {
                const match = line.match(/^\s{4}proxies:\s*\[(.*)\]\s*(?:#.*)?$/);
                const items = match ? parseInlineList(match[1]) : [];
                if (items.includes(proxyName))
                    refs.push({ kind: 'group', text: currentGroup, key: 'proxies' });
            }
            if (/^\s{6}-\s*/.test(line) && unquoteYamlValue(line.replace(/^\s{6}-\s*/, '')) === proxyName) {
                refs.push({ kind: 'group', text: currentGroup, key: 'proxies' });
            }
        }
    }
    const ruleRange = findTopLevelSectionRange(lines, 'rules');
    if (ruleRange) {
        for (let i = ruleRange.start + 1; i < ruleRange.end; i += 1) {
            const line = String(lines[i] || '');
            if (!/^\s{2}-\s*/.test(line))
                continue;
            const parsed = parseRuleRaw(line);
            if (String(parsed.target || '').trim() === proxyName)
                refs.push({ kind: 'rule', text: parsed.raw, lineNo: i + 1 });
        }
    }
    return refs;
};
export const emptyProxyForm = () => ({
    originalName: '',
    name: '',
    type: '',
    server: '',
    port: '',
    udp: '',
    tfo: '',
    tls: '',
    skipCertVerify: '',
    sni: '',
    servername: '',
    clientFingerprint: '',
    network: '',
    dialerProxy: '',
    interfaceName: '',
    packetEncoding: '',
    uuid: '',
    password: '',
    cipher: '',
    flow: '',
    alpnText: '',
    wsPath: '',
    wsHeadersBody: '',
    grpcServiceName: '',
    grpcMultiMode: '',
    httpMethod: '',
    httpPathText: '',
    httpHeadersBody: '',
    smuxEnabled: '',
    smuxProtocol: '',
    smuxMaxConnections: '',
    smuxMinStreams: '',
    smuxMaxStreams: '',
    smuxPadding: '',
    smuxStatistic: '',
    wireguardIpText: '',
    wireguardIpv6Text: '',
    wireguardPrivateKey: '',
    wireguardPublicKey: '',
    wireguardPresharedKey: '',
    wireguardMtu: '',
    wireguardReservedText: '',
    wireguardWorkers: '',
    hysteriaUp: '',
    hysteriaDown: '',
    hysteriaObfs: '',
    hysteriaObfsPassword: '',
    tuicCongestionController: '',
    tuicUdpRelayMode: '',
    tuicHeartbeatInterval: '',
    tuicRequestTimeout: '',
    tuicFastOpen: '',
    tuicReduceRtt: '',
    tuicDisableSni: '',
    plugin: '',
    pluginOptsBody: '',
    realityPublicKey: '',
    realityShortId: '',
    extraBody: '',
});
export const proxyFormFromEntry = (entry) => ({
    originalName: entry.name,
    name: entry.name,
    type: entry.type,
    server: entry.server,
    port: entry.port,
    udp: entry.udp,
    tfo: entry.tfo,
    tls: entry.tls,
    skipCertVerify: entry.skipCertVerify,
    sni: entry.sni,
    servername: entry.servername,
    clientFingerprint: entry.clientFingerprint,
    network: entry.network,
    dialerProxy: entry.dialerProxy,
    interfaceName: entry.interfaceName,
    packetEncoding: entry.packetEncoding,
    uuid: entry.uuid,
    password: entry.password,
    cipher: entry.cipher,
    flow: entry.flow,
    alpnText: formatListText(entry.alpn),
    wsPath: entry.wsPath,
    wsHeadersBody: entry.wsHeadersBody,
    grpcServiceName: entry.grpcServiceName,
    grpcMultiMode: entry.grpcMultiMode,
    httpMethod: entry.httpMethod,
    httpPathText: formatListText(entry.httpPath),
    httpHeadersBody: entry.httpHeadersBody,
    smuxEnabled: entry.smuxEnabled,
    smuxProtocol: entry.smuxProtocol,
    smuxMaxConnections: entry.smuxMaxConnections,
    smuxMinStreams: entry.smuxMinStreams,
    smuxMaxStreams: entry.smuxMaxStreams,
    smuxPadding: entry.smuxPadding,
    smuxStatistic: entry.smuxStatistic,
    wireguardIpText: formatListText(entry.wireguardIp),
    wireguardIpv6Text: formatListText(entry.wireguardIpv6),
    wireguardPrivateKey: entry.wireguardPrivateKey,
    wireguardPublicKey: entry.wireguardPublicKey,
    wireguardPresharedKey: entry.wireguardPresharedKey,
    wireguardMtu: entry.wireguardMtu,
    wireguardReservedText: formatListText(entry.wireguardReserved),
    wireguardWorkers: entry.wireguardWorkers,
    hysteriaUp: entry.hysteriaUp,
    hysteriaDown: entry.hysteriaDown,
    hysteriaObfs: entry.hysteriaObfs,
    hysteriaObfsPassword: entry.hysteriaObfsPassword,
    tuicCongestionController: entry.tuicCongestionController,
    tuicUdpRelayMode: entry.tuicUdpRelayMode,
    tuicHeartbeatInterval: entry.tuicHeartbeatInterval,
    tuicRequestTimeout: entry.tuicRequestTimeout,
    tuicFastOpen: entry.tuicFastOpen,
    tuicReduceRtt: entry.tuicReduceRtt,
    tuicDisableSni: entry.tuicDisableSni,
    plugin: entry.plugin,
    pluginOptsBody: entry.pluginOptsBody,
    realityPublicKey: entry.realityPublicKey,
    realityShortId: entry.realityShortId,
    extraBody: entry.extraBody,
});
export const parseProxiesFromConfig = (value) => {
    const normalized = normalizeText(value);
    const lines = normalized.length ? normalized.split('\n') : [];
    const parsed = collectProxyBlocks(lines);
    return parsed.blocks.map((block) => {
        const entry = parseProxyEntry(block.lines);
        return {
            ...entry,
            references: collectProxyReferences(normalized, entry.name),
        };
    });
};
export const upsertProxyInConfig = (value, form) => {
    const normalized = normalizeText(value);
    const lines = normalized.length ? normalized.split('\n') : [];
    const nextName = String(form.name || '').trim();
    if (!nextName.length)
        return normalized;
    const builtBlock = buildProxyBlock(form);
    if (!builtBlock.length)
        return normalized;
    const parsed = collectProxyBlocks(lines);
    const originalName = String(form.originalName || '').trim();
    const targetIndex = parsed.blocks.findIndex((block) => {
        const matchInline = String(block.lines[0] || '').match(/^\s{2}-\s+name:\s*(.*?)\s*$/);
        return unquoteYamlValue(matchInline?.[1] || '') === (originalName || nextName);
    });
    if (!parsed.range)
        insertProxiesSectionIfMissing(lines, builtBlock);
    else if (targetIndex >= 0) {
        const block = parsed.blocks[targetIndex];
        lines.splice(block.start, block.end - block.start, ...builtBlock);
    }
    else {
        lines.splice(parsed.range.end, 0, ...builtBlock);
    }
    let nextYaml = joinYaml(lines);
    if (originalName && originalName !== nextName) {
        const groups = rewriteProxyRefsInGroups(nextYaml, originalName, nextName);
        nextYaml = joinYaml(groups.lines);
        const rules = rewriteProxyTargetsInRules(nextYaml, originalName, nextName);
        nextYaml = joinYaml(rules.lines);
    }
    return nextYaml;
};
export const simulateProxyDisableImpact = (value, proxyName) => {
    const groups = rewriteProxyRefsInGroups(value, proxyName, '');
    const rules = rewriteProxyTargetsInRules(joinYaml(groups.lines), proxyName, '');
    return {
        impacts: groups.touchedGroups,
        rulesTouched: rules.touchedCount,
        ruleSamples: rules.samples,
    };
};
export const removeProxyFromConfig = (value, proxyName) => {
    const normalized = normalizeText(value);
    const lines = normalized.length ? normalized.split('\n') : [];
    const parsed = collectProxyBlocks(lines);
    const block = parsed.blocks.find((item) => {
        const matchInline = String(item.lines[0] || '').match(/^\s{2}-\s+name:\s*(.*?)\s*$/);
        return unquoteYamlValue(matchInline?.[1] || '') === proxyName;
    });
    if (!block)
        return { yaml: normalized, impacts: [], rulesTouched: 0, ruleSamples: [] };
    lines.splice(block.start, block.end - block.start);
    let nextYaml = joinYaml(lines);
    const groups = rewriteProxyRefsInGroups(nextYaml, proxyName, '');
    nextYaml = joinYaml(groups.lines);
    const rules = rewriteProxyTargetsInRules(nextYaml, proxyName, '');
    nextYaml = joinYaml(rules.lines);
    return {
        yaml: nextYaml,
        impacts: groups.touchedGroups,
        rulesTouched: rules.touchedCount,
        ruleSamples: rules.samples,
    };
};
