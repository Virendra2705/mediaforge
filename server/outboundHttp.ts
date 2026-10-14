import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import type { IncomingHttpHeaders, IncomingMessage } from 'node:http';
import type { RequestOptions } from 'node:https';
import { Transform } from 'node:stream';

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const DEFAULT_PORTS: Record<string, number> = { 'http:': 80, 'https:': 443 };
const DEFAULT_LIMITS = {
  dnsMs: 5_000,
  connectMs: 5_000,
  headersMs: 10_000,
  overallMs: 30_000,
  maxRedirects: 5,
  maxResponseBytes: 512 * 1024 * 1024,
};

export class OutboundHttpError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'INVALID_URL'
      | 'BLOCKED_DESTINATION'
      | 'DNS_FAILED'
      | 'TIMEOUT'
      | 'TOO_MANY_REDIRECTS'
      | 'REDIRECT_LOOP'
      | 'RESPONSE_TOO_LARGE'
      | 'REQUEST_FAILED'
  ) {
    super(message);
    this.name = 'OutboundHttpError';
  }
}

export interface SafeHttpResponse {
  statusCode: number;
  statusMessage?: string;
  headers: IncomingHttpHeaders;
  finalUrl: string;
  body: Transform;
  abort: () => void;
}

export interface SafeHttpRequestOptions {
  method?: 'GET' | 'POST';
  body?: string | Buffer;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  connectTimeoutMs?: number;
  headersTimeoutMs?: number;
  overallTimeoutMs?: number;
  dnsTimeoutMs?: number;
  maxRedirects?: number;
  maxResponseBytes?: number;
}

export interface SafeHttpTransportDependencies {
  lookup?: (hostname: string) => Promise<dns.LookupAddress[]>;
  allowedPorts?: (protocol: string) => number[];
  /** Override only for isolated transport tests. Production uses isGlobalAddress. */
  isAddressAllowed?: (address: string) => boolean;
}

function ipv4ToNumber(address: string): number | null {
  if (net.isIP(address) !== 4) return null;
  const octets = address.split('.').map(Number);
  return (((octets[0] * 256 + octets[1]) * 256 + octets[2]) * 256 + octets[3]) >>> 0;
}

function inV4Range(address: number, network: string, prefix: number): boolean {
  const base = ipv4ToNumber(network);
  if (base === null) return false;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (address & mask) === (base & mask);
}

function parseIpv6(address: string): bigint[] | null {
  let text = address.toLowerCase();
  if (text.includes('%')) return null;
  const dotted = text.match(/(?:^|:)(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const n = ipv4ToNumber(dotted[1]);
    if (n === null) return null;
    text = text.slice(0, -dotted[1].length).replace(/:$/, '') + `:${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
  }
  const halves = text.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return null;
  const groups = [...left, ...Array(missing).fill('0'), ...right];
  if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups.map((group) => BigInt(`0x${group}`));
}

function ipv6ToBigInt(groups: bigint[]): bigint {
  return groups.reduce((value, group) => (value << 16n) | group, 0n);
}

function inV6Range(value: bigint, network: string, prefix: number): boolean {
  const groups = parseIpv6(network);
  if (!groups) return false;
  const shift = 128n - BigInt(prefix);
  return (value >> shift) === (ipv6ToBigInt(groups) >> shift);
}

/** Returns true only for unicast addresses suitable for public Internet egress. */
export function isGlobalAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 4) {
    const value = ipv4ToNumber(address)!;
    const prohibited = [
      ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
      ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
      ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
      ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
    ] as const;
    return !prohibited.some(([network, prefix]) => inV4Range(value, network, prefix));
  }
  if (family !== 6) return false;

  const groups = parseIpv6(address);
  if (!groups) return false;

  // IPv4-mapped IPv6 must inherit the embedded IPv4 policy.
  const isMapped = groups.slice(0, 5).every((group) => group === 0n) && groups[5] === 0xffffn;
  if (isMapped) {
    const embedded = Number((groups[6] << 16n) | groups[7]);
    return isGlobalAddress(`${embedded >>> 24}.${(embedded >>> 16) & 255}.${(embedded >>> 8) & 255}.${embedded & 255}`);
  }

  const value = ipv6ToBigInt(groups);
  // Only global unicast 2000::/3 is eligible. Exclude special-use/transition
  // ranges within it, including documentation, benchmarking, and 6to4.
  return inV6Range(value, '2000::', 3) &&
    !inV6Range(value, '2001::', 23) &&
    !inV6Range(value, '2001:db8::', 32) &&
    !inV6Range(value, '2002::', 16);
}

function validateOutboundUrl(rawUrl: string, allowedPorts: (protocol: string) => number[]): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new OutboundHttpError('Invalid outbound URL.', 'INVALID_URL');
  }
  if (!Object.hasOwn(DEFAULT_PORTS, url.protocol) || url.username || url.password || /^https?:\/\/[^/?#]*@/i.test(rawUrl)) {
    throw new OutboundHttpError('Outbound URL is not permitted.', 'INVALID_URL');
  }
  const targetPort = url.port ? Number(url.port) : DEFAULT_PORTS[url.protocol];
  if (!allowedPorts(url.protocol).includes(targetPort)) {
    throw new OutboundHttpError('Outbound port is not permitted.', 'INVALID_URL');
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new OutboundHttpError('Outbound destination is not public.', 'BLOCKED_DESTINATION');
  }
  if (net.isIP(hostname) && !isGlobalAddress(hostname)) {
    throw new OutboundHttpError('Outbound destination is not public.', 'BLOCKED_DESTINATION');
  }
  return url;
}

function defaultLookup(hostname: string): Promise<dns.LookupAddress[]> {
  return dns.promises.lookup(hostname, { all: true, verbatim: true });
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new OutboundHttpError('Outbound request timed out.', 'TIMEOUT')), timeoutMs);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

function resolvePinnedAddress(
  url: URL,
  lookup: (hostname: string) => Promise<dns.LookupAddress[]>,
  timeoutMs: number,
  isAddressAllowed: (address: string) => boolean,
): Promise<dns.LookupAddress> {
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const literalFamily = net.isIP(hostname);
  const resolve = literalFamily
    ? Promise.resolve([{ address: hostname, family: literalFamily }])
    : withTimeout(lookup(hostname), timeoutMs);
  return resolve.then((records) => {
    if (!records.length || records.some((record) => !isAddressAllowed(record.address))) {
      throw new OutboundHttpError('Outbound destination is not public.', 'BLOCKED_DESTINATION');
    }
    return records[0];
  }).catch((error) => {
    if (error instanceof OutboundHttpError) throw error;
    throw new OutboundHttpError('Could not resolve outbound destination.', 'DNS_FAILED');
  });
}

function requestOnce(
  url: URL,
  address: dns.LookupAddress,
  options: SafeHttpRequestOptions,
  signal: AbortSignal,
): Promise<{ response: IncomingMessage; request: http.ClientRequest }> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http;
    let settled = false;
    let connectTimer: NodeJS.Timeout | undefined;
    let headerTimer: NodeJS.Timeout | undefined;
    const requestOptions: RequestOptions = {
      protocol: url.protocol,
      hostname: url.hostname.replace(/^\[|\]$/g, ''),
      port: url.port ? Number(url.port) : DEFAULT_PORTS[url.protocol],
      method: options.method ?? 'GET',
      path: `${url.pathname}${url.search}`,
      headers: {
        ...Object.fromEntries(Object.entries(options.headers ?? {}).filter(([name]) => name.toLowerCase() !== 'host')),
        Host: url.host,
      },
      agent: false,
      rejectUnauthorized: true,
      servername: net.isIP(url.hostname.replace(/^\[|\]$/g, '')) ? undefined : url.hostname,
      lookup: ((_hostname: string, opts: { all?: boolean } | ((error: NodeJS.ErrnoException | null, address?: string, family?: number) => void), callback?: (error: NodeJS.ErrnoException | null, address?: string, family?: number) => void) => {
        const done = typeof opts === 'function' ? opts : callback!;
        if (typeof opts !== 'function' && opts.all) {
          (done as unknown as (error: NodeJS.ErrnoException | null, addresses?: dns.LookupAddress[]) => void)(null, [address]);
        } else {
          done(null, address.address, address.family);
        }
      }) as any,
    };
    const request = client.request(requestOptions, (response) => {
      settled = true;
      clearTimeout(headerTimer);
      clearTimeout(connectTimer);
      resolve({ response, request });
    });
    headerTimer = setTimeout(() => {
      request.destroy(new OutboundHttpError('Upstream response headers timed out.', 'TIMEOUT'));
    }, options.headersTimeoutMs ?? DEFAULT_LIMITS.headersMs);
    request.once('socket', (socket) => {
      if (socket.connecting) {
        connectTimer = setTimeout(() => {
          request.destroy(new OutboundHttpError('Outbound connection timed out.', 'TIMEOUT'));
        }, options.connectTimeoutMs ?? DEFAULT_LIMITS.connectMs);
        socket.once(url.protocol === 'https:' ? 'secureConnect' : 'connect', () => clearTimeout(connectTimer));
        socket.once('close', () => clearTimeout(connectTimer));
      }
    });
    const onAbort = () => request.destroy(new OutboundHttpError('Outbound request was cancelled.', 'REQUEST_FAILED'));
    signal.addEventListener('abort', onAbort, { once: true });
    request.once('close', () => {
      clearTimeout(headerTimer);
      clearTimeout(connectTimer);
      signal.removeEventListener('abort', onAbort);
    });
    request.once('error', (error) => {
      clearTimeout(headerTimer);
      if (!settled) reject(error);
    });
    if (signal.aborted) onAbort();
    request.end(options.body);
  });
}

export function createSafeHttpTransport(dependencies: SafeHttpTransportDependencies = {}) {
  const lookup = dependencies.lookup ?? defaultLookup;
  const isAddressAllowed = dependencies.isAddressAllowed ?? isGlobalAddress;
  const allowedPorts = dependencies.allowedPorts ?? ((protocol: string) => [DEFAULT_PORTS[protocol]]);

  return async function requestSafeHttp(rawUrl: string, options: SafeHttpRequestOptions = {}): Promise<SafeHttpResponse> {
    const controller = new AbortController();
    const maxResponseBytes = options.maxResponseBytes ?? DEFAULT_LIMITS.maxResponseBytes;
    if (!Number.isSafeInteger(maxResponseBytes) || maxResponseBytes <= 0) {
      throw new OutboundHttpError('Invalid outbound response limit.', 'INVALID_URL');
    }
    let activeRequest: http.ClientRequest | undefined;
    let activeResponse: IncomingMessage | undefined;
    let activeBody: Transform | undefined;
    let complete = false;
    const abort = () => {
      if (!controller.signal.aborted) controller.abort();
      activeRequest?.destroy();
      activeResponse?.destroy();
      activeBody?.destroy();
    };
    const onCallerAbort = () => abort();
    options.signal?.addEventListener('abort', onCallerAbort, { once: true });
    if (options.signal?.aborted) onCallerAbort();

    const overallTimer = setTimeout(() => {
      abort();
    }, options.overallTimeoutMs ?? DEFAULT_LIMITS.overallMs);
    const cleanup = () => {
      if (complete) return;
      complete = true;
      clearTimeout(overallTimer);
      options.signal?.removeEventListener('abort', onCallerAbort);
    };

    try {
      let currentUrl = rawUrl;
      const visited = new Set<string>();
      let redirects = 0;
      while (true) {
        if (controller.signal.aborted) throw new OutboundHttpError('Outbound request was cancelled or timed out.', 'TIMEOUT');
        const url = validateOutboundUrl(currentUrl, allowedPorts);
        const normalized = url.toString();
        if (visited.has(normalized)) throw new OutboundHttpError('Outbound redirect loop detected.', 'REDIRECT_LOOP');
        visited.add(normalized);

        const address = await resolvePinnedAddress(url, lookup, options.dnsTimeoutMs ?? DEFAULT_LIMITS.dnsMs, isAddressAllowed);
        const { response, request } = await requestOnce(url, address, options, controller.signal);
        activeRequest = request;
        activeResponse = response;
        const location = response.headers.location;
        if (REDIRECT_STATUSES.has(response.statusCode ?? 0) && location) {
          response.destroy();
          request.destroy();
          activeResponse = undefined;
          activeRequest = undefined;
          if (redirects >= (options.maxRedirects ?? DEFAULT_LIMITS.maxRedirects)) {
            throw new OutboundHttpError('Outbound redirect limit exceeded.', 'TOO_MANY_REDIRECTS');
          }
          let nextUrl: string;
          try { nextUrl = new URL(location, url).toString(); }
          catch { throw new OutboundHttpError('Invalid redirect destination.', 'INVALID_URL'); }
          currentUrl = nextUrl;
          redirects++;
          continue;
        }

        const declaredLength = Number(response.headers['content-length']);
        if (Number.isFinite(declaredLength) && declaredLength > maxResponseBytes) {
          response.destroy();
          throw new OutboundHttpError('Upstream response exceeds the configured size limit.', 'RESPONSE_TOO_LARGE');
        }

        let received = 0;
        const body = new Transform({
          transform(chunk: Buffer, _encoding, callback) {
            received += chunk.length;
            if (received > maxResponseBytes) callback(new OutboundHttpError('Upstream response exceeds the configured size limit.', 'RESPONSE_TOO_LARGE'));
            else callback(null, chunk);
          },
        });
        activeBody = body;
        response.on('error', (error) => body.destroy(error));
        body.once('error', () => response.destroy());
        body.once('end', cleanup);
        body.once('close', cleanup);
        response.pipe(body);
        return { statusCode: response.statusCode ?? 502, statusMessage: response.statusMessage, headers: response.headers, finalUrl: currentUrl, body, abort };
      }
    } catch (error) {
      abort();
      cleanup();
      if (error instanceof OutboundHttpError) throw error;
      const wrapped = new OutboundHttpError('Outbound request failed.', 'REQUEST_FAILED');
      (wrapped as Error & { cause?: unknown }).cause = error;
      throw wrapped;
    }
  };
}

export const requestSafeHttp = createSafeHttpTransport();

export async function readSafeHttpResponseText(response: SafeHttpResponse): Promise<string> {
  const chunks: Buffer[] = [];
  try {
    for await (const chunk of response.body) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks).toString('utf8');
  } catch (error) {
    response.abort();
    throw error;
  }
}

export function getPositiveIntegerConfig(value: string | undefined, fallback: number): number {
  if (!value || !/^\d+$/.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}
