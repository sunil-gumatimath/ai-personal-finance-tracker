import dns from "dns";

/**
 * Optional DNS override for LOCAL development only.
 *
 * SECURITY: this module NEVER disables TLS certificate validation
 * (the previous implementation set `rejectUnauthorized: false`, which allowed
 * machine-in-the-middle attacks on every fetch). Only hostname → IP rewriting
 * remains, and it is OFF by default.
 *
 * Opt in with NEON_DNS_OVERRIDE=1 (never enable it in production — the
 * override is additionally hard-gated to non-production environments).
 *
 * Why this exists: some local networks fail to resolve Neon endpoints via the
 * system resolver. When enabled, requests to the configured hosts are rewritten
 * to IPs resolved via public DNS (8.8.8.8 / 1.1.1.1), while keeping SNI and
 * certificate verification intact (`servername` is set so TLS still validates
 * against the real hostname).
 */

type BunRequestInit = RequestInit & {
  tls?: {
    servername: string;
  };
};

const OVERRIDES: Array<{ domain: string; ips: string[] }> = [
  {
    domain: "ep-odd-block-a13wgvy0.neonauth.ap-southeast-1.aws.neon.tech",
    ips: [],
  },
  {
    domain: "ep-odd-block-a13wgvy0-pooler.ap-southeast-1.aws.neon.tech",
    ips: [],
  },
  {
    domain: "ep-odd-block-a13wgvy0.ap-southeast-1.aws.neon.tech",
    ips: [],
  },
  {
    domain: "api.ap-southeast-1.aws.neon.tech",
    ips: [],
  },
];

const FALLBACK_IPS: Record<string, string[]> = {
  "ep-odd-block-a13wgvy0.neonauth.ap-southeast-1.aws.neon.tech": [
    "18.142.78.60",
    "18.139.181.85",
    "13.228.33.46",
  ],
  "ep-odd-block-a13wgvy0-pooler.ap-southeast-1.aws.neon.tech": [
    "52.220.170.93",
    "13.228.184.177",
    "13.228.46.236",
  ],
  "ep-odd-block-a13wgvy0.ap-southeast-1.aws.neon.tech": [
    "52.220.170.93",
    "13.228.184.177",
    "13.228.46.236",
  ],
  "api.ap-southeast-1.aws.neon.tech": [
    "52.220.170.93",
    "13.228.184.177",
    "13.228.46.236",
  ],
};

function isEnabled(): boolean {
  return (
    process.env.NEON_DNS_OVERRIDE === "1" &&
    process.env.NODE_ENV !== "production"
  );
}

async function resolveIps(domain: string): Promise<string[]> {
  const resolver = new dns.Resolver();
  // Public resolvers that support IPv4 lookups of the Neon endpoints.
  resolver.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
  return new Promise((resolve) => {
    resolver.resolve4(domain, (err, addresses) => {
      if (!err && addresses && addresses.length > 0) resolve(addresses);
      else resolve(FALLBACK_IPS[domain] ?? []);
    });
  });
}

let initialized = false;

export async function initDnsOverride(): Promise<void> {
  if (initialized || !isEnabled()) return;
  initialized = true;

  const originalFetch = globalThis.fetch;
  const roundRobinIndex = new Map<string, number>();

  await Promise.all(
    OVERRIDES.map(async (entry) => {
      entry.ips = await resolveIps(entry.domain);
    }),
  );

  globalThis.fetch = (async function (
    input: RequestInfo | URL,
    init?: BunRequestInit,
  ) {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;

    for (const entry of OVERRIDES) {
      if (entry.ips.length === 0 || !url.includes(entry.domain)) continue;

      const index = roundRobinIndex.get(entry.domain) ?? 0;
      const targetIp = entry.ips[index % entry.ips.length];
      roundRobinIndex.set(entry.domain, index + 1);

      const requestInit = { ...(init || {}) } as BunRequestInit;
      requestInit.headers = new Headers(requestInit.headers || {});
      (requestInit.headers as Headers).set("Host", entry.domain);
      // Keep certificate validation ON: pin SNI to the real hostname so the
      // cert presented over the IP connection still validates normally.
      requestInit.tls = { servername: entry.domain };

      console.log(`🛸 DNS override: ${entry.domain} -> ${targetIp}`);
      return originalFetch(url.replace(entry.domain, targetIp), requestInit);
    }

    return originalFetch(input, init);
  }) as typeof fetch;
}

// Fire-and-forget initialization; harmless no-op when disabled.
void initDnsOverride();
