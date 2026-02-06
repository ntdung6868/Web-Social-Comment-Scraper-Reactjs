// ===========================================
// Proxy Manager
// ===========================================
// Handles proxy rotation and health checking

interface ProxyHealth {
  url: string;
  isHealthy: boolean;
  lastChecked: Date | null;
  failCount: number;
  successCount: number;
  avgLatency: number;
}

class ProxyManager {
  private proxies: Map<string, ProxyHealth> = new Map();
  private currentIndex = 0;
  private rotation: "RANDOM" | "SEQUENTIAL" = "RANDOM";

  /**
   * Set proxy list from string (newline separated)
   */
  setProxies(proxyList: string, rotation: "RANDOM" | "SEQUENTIAL" = "RANDOM"): void {
    this.rotation = rotation;
    this.proxies.clear();
    this.currentIndex = 0;

    const lines = proxyList.split("\n").filter((line) => line.trim());

    for (const line of lines) {
      const url = line.trim();
      if (url) {
        this.proxies.set(url, {
          url,
          isHealthy: true,
          lastChecked: null,
          failCount: 0,
          successCount: 0,
          avgLatency: 0,
        });
      }
    }

    console.log(`[ProxyManager] Loaded ${this.proxies.size} proxies with ${rotation} rotation`);
  }

  /**
   * Get next available proxy
   */
  getNext(): string | null {
    if (this.proxies.size === 0) return null;

    const healthyProxies = Array.from(this.proxies.values()).filter((p) => p.isHealthy);

    if (healthyProxies.length === 0) {
      // Reset all proxies if all are unhealthy
      console.log("[ProxyManager] All proxies unhealthy, resetting...");
      for (const proxy of this.proxies.values()) {
        proxy.isHealthy = true;
        proxy.failCount = 0;
      }
      return this.getNext();
    }

    let selected: ProxyHealth;

    if (this.rotation === "RANDOM") {
      const index = Math.floor(Math.random() * healthyProxies.length);
      selected = healthyProxies[index]!;
    } else {
      // Sequential
      this.currentIndex = this.currentIndex % healthyProxies.length;
      selected = healthyProxies[this.currentIndex]!;
      this.currentIndex++;
    }

    console.log(`[ProxyManager] Selected proxy: ${this.maskProxy(selected.url)}`);
    return selected.url;
  }

  /**
   * Report proxy success
   */
  reportSuccess(url: string, latency: number): void {
    const proxy = this.proxies.get(url);
    if (proxy) {
      proxy.successCount++;
      proxy.failCount = Math.max(0, proxy.failCount - 1);
      proxy.isHealthy = true;
      proxy.lastChecked = new Date();

      // Update average latency
      const total = proxy.successCount;
      proxy.avgLatency = (proxy.avgLatency * (total - 1) + latency) / total;
    }
  }

  /**
   * Report proxy failure
   */
  reportFailure(url: string): void {
    const proxy = this.proxies.get(url);
    if (proxy) {
      proxy.failCount++;
      proxy.lastChecked = new Date();

      // Mark as unhealthy after 3 consecutive failures
      if (proxy.failCount >= 3) {
        proxy.isHealthy = false;
        console.log(`[ProxyManager] Proxy marked unhealthy: ${this.maskProxy(url)}`);
      }
    }
  }

  /**
   * Get proxy statistics
   */
  getStats(): {
    total: number;
    healthy: number;
    unhealthy: number;
    proxies: Array<{
      url: string;
      isHealthy: boolean;
      failCount: number;
      successCount: number;
      avgLatency: number;
    }>;
  } {
    const healthy = Array.from(this.proxies.values()).filter((p) => p.isHealthy).length;

    return {
      total: this.proxies.size,
      healthy,
      unhealthy: this.proxies.size - healthy,
      proxies: Array.from(this.proxies.values()).map((p) => ({
        url: this.maskProxy(p.url),
        isHealthy: p.isHealthy,
        failCount: p.failCount,
        successCount: p.successCount,
        avgLatency: Math.round(p.avgLatency),
      })),
    };
  }

  /**
   * Mask proxy URL for logging (hide credentials)
   */
  private maskProxy(url: string): string {
    try {
      const parsed = new URL(url.startsWith("http") ? url : `http://${url}`);
      if (parsed.username) {
        return `${parsed.protocol}//${parsed.username}:****@${parsed.host}`;
      }
      return parsed.host;
    } catch {
      return url.substring(0, 20) + "...";
    }
  }
}

// Export singleton instance
export const proxyManager = new ProxyManager();
