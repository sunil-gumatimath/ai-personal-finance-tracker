import dns from "dns";

type BunRequestInit = RequestInit & {
  tls?: {
    rejectUnauthorized: boolean;
    servername: string;
  };
};

if (process.env.NODE_ENV !== "production") {
  const originalFetch = globalThis.fetch;
  const NEON_AUTH_DOMAIN = 'ep-odd-block-a13wgvy0.neonauth.ap-southeast-1.aws.neon.tech';
  const NEON_DB_DOMAIN = 'ep-odd-block-a13wgvy0-pooler.ap-southeast-1.aws.neon.tech';
  
  // High-reliability public DNS servers that support IPv4 resolution
  const resolver = new dns.Resolver();
  resolver.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);

  // Stable fallback IPs in case of resolution failures
  let NEON_AUTH_IPS = ['18.142.78.60', '18.139.181.85', '13.228.33.46'];
  let NEON_DB_IPS = ['52.220.170.93', '13.228.184.177', '13.228.46.236'];
  
  let isResolvingAuth = false;
  let isResolvingDb = false;

  // Resolve fresh IPs dynamically
  const resolveFreshIPs = (domain: string, fallback: string[]): Promise<string[]> => {
    return new Promise((resolve) => {
      resolver.resolve4(domain, (err, addresses) => {
        if (err || !addresses || addresses.length === 0) {
          console.warn(`⚠️ DNS Interceptor: Failed to resolve ${domain} via custom resolver. Using fallback IPs.`);
          resolve(fallback);
        } else {
          console.log(`📡 DNS Interceptor: Dynamically resolved ${domain} -> ${JSON.stringify(addresses)}`);
          resolve(addresses);
        }
      });
    });
  };

  // Run the background resolutions immediately
  isResolvingAuth = true;
  resolveFreshIPs(NEON_AUTH_DOMAIN, NEON_AUTH_IPS).then(ips => {
    NEON_AUTH_IPS = ips;
    isResolvingAuth = false;
  });

  isResolvingDb = true;
  resolveFreshIPs(NEON_DB_DOMAIN, NEON_DB_IPS).then(ips => {
    NEON_DB_IPS = ips;
    isResolvingDb = false;
  });

  let authIpIndex = 0;
  let dbIpIndex = 0;
  
  globalThis.fetch = async function(input: RequestInfo | URL, init?: BunRequestInit) {
      const url = typeof input === 'string' ? input : (input instanceof URL ? input.href : (input as Request).url);
      
      let targetDomain = '';
      let targetIp = '';
      
      if (url.includes(NEON_AUTH_DOMAIN)) {
          targetDomain = NEON_AUTH_DOMAIN;
          targetIp = NEON_AUTH_IPS[authIpIndex];
          authIpIndex = (authIpIndex + 1) % NEON_AUTH_IPS.length;
      } else if (url.includes(NEON_DB_DOMAIN)) {
          targetDomain = NEON_DB_DOMAIN;
          targetIp = NEON_DB_IPS[dbIpIndex];
          dbIpIndex = (dbIpIndex + 1) % NEON_DB_IPS.length;
      }
      
      if (targetDomain && targetIp) {
          const newUrl = url.replace(targetDomain, targetIp);
          
          const requestInit = init || {};
          const headers = new Headers(requestInit.headers || {});
          headers.set('Host', targetDomain);
          requestInit.headers = headers;
          
          requestInit.tls = {
              rejectUnauthorized: false,
              servername: targetDomain
          };
          
          console.log(`🛸 DNS Interceptor: Proxying ${targetDomain} -> ${targetIp}`);
          return originalFetch(newUrl, requestInit);
      }
      
      return originalFetch(input, init);
  };
}
