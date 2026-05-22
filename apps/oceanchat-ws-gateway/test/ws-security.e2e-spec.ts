import * as WebSocket from 'ws';

/**
 * Black-Box E2E Tests for WS Gateway Security.
 * This suite verifies Edge Protection and Handshake timeouts against a LIVE system.
 */
describe('WS Gateway Security (Black-Box E2E)', () => {
  const WS_URL = process.env.WS_GATEWAY_URL || 'ws://localhost:1995/monkey';

  /**
   * Test case for IP-based connection limiting (Edge Protection).
   * Verified via RateLimitedWsAdapter.
   */
  it('should reject connections exceeding the MAX_CONNECTIONS_PER_IP limit (Flood Protection)', async () => {
    const connections: WebSocket[] = [];
    const MAX = 20; // Matches RateLimitedWsAdapter limit

    try {
      // Establish 20 legitimate connections from the same simulated IP
      for (let i = 0; i < MAX; i++) {
        const ws = new WebSocket(WS_URL, {
          headers: { 'x-real-ip': '1.2.3.4' }
        });
        await new Promise((resolve, reject) => {
          ws.on('open', resolve);
          ws.on('error', reject);
        });
        connections.push(ws);
      }

      // Attempt the 21st connection
      const failingWs = new WebSocket(WS_URL, {
        headers: { 'x-real-ip': '1.2.3.4' }
      });

      const isClosed = await new Promise((resolve) => {
        failingWs.on('close', () => resolve(true));
        // Timeout if server fails to close the connection
        setTimeout(() => resolve(false), 3000);
      });

      expect(isClosed).toBe(true);
    } finally {
      // Cleanup all open connections
      connections.forEach(c => c.terminate());
    }
  }, 30000);

  /**
   * Test case for Handshake Window Timeout.
   * If a client doesn't authenticate within 5 seconds, the server must close it.
   */
  it('should terminate unauthenticated connections after 5 seconds (Handshake Timeout)', async () => {
    const ws = new WebSocket(WS_URL);
    
    const startTime = Date.now();
    
    const closeCode = await new Promise<number>((resolve) => {
      ws.on('close', (code) => resolve(code));
    });

    const duration = Date.now() - startTime;
    
    // 4008 is ErrorCodes.WS_CLOSE_HANDSHAKE_TIMEOUT
    expect(closeCode).toBe(4008);
    expect(duration).toBeGreaterThanOrEqual(5000);
  }, 10000);
});
