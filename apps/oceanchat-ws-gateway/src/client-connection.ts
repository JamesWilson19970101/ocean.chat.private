import { TokenBucket } from '@ocean.chat/cores';
import { MonkeyCmd, MonkeyService, MsgNotify } from '@ocean.chat/monkey';
import { ConnectionAuthStatus } from '@ocean.chat/types';
import { WebSocket } from 'ws';

/**
 * Represents a single client connection in the gateway.
 * Strictly stateless regarding business logic, only maintains connection-level metadata.
 */
export class ClientConnection {
  // TODO: Add `connectionId` (e.g., UUID) to represent the physical network connection.
  // Why it is needed:
  // 1. Prevent Socket Race Conditions: Differentiate new connections from "ghost" connections during rapid reconnects.
  // 2. Pre-Auth Tracking: Identify and trace sockets before they successfully authenticate and acquire a userId/deviceId.
  // 3. Strict Targeted Responses: Allow backend routing to target or abort specific physical channels rather than the whole device.
  // 4. End-to-End Observability: Provide a unique trace ID for logs from TCP handshake to disconnection.
  public userId?: string;
  public deviceId?: string;
  public deviceType?: string;
  public jti?: string;
  public exp?: number;
  public authStatus: ConnectionAuthStatus = ConnectionAuthStatus.PENDING;
  public readonly connectedAt: number = Date.now();
  public lastActiveTime: number = Date.now();
  public pingSent: boolean = false;

  // Rate limiter: 20 tokens capacity, 20 tokens refill per second (default)
  public readonly rateLimiter: TokenBucket = new TokenBucket(20, 20);

  // Micro-batching for MSG_NOTIFY: Map<GroupId, MaxSyncSeqId>
  private readonly notifyCollapseMap = new Map<string, string>();

  private static readonly dirtyConnections = new Set<ClientConnection>();
  private static globalCollapseTimer?: NodeJS.Timeout; // Use a single global timeout. Creating a timer per user consumes underlying C++ resources and can lead to memory exhaustion under high concurrency.

  constructor(
    public readonly ws: WebSocket,
    private readonly monkeyService: MonkeyService,
  ) {}

  /**
   * Refreshes the last active time (`lastActiveTime`) of the current connection.
   *
   * This method implements the **"Any Message is Pong"** strategy defined in the Monkey Protocol.
   * Whenever the gateway receives any valid upstream data packet from the client
   * (whether it is a simple `PING` or an actual business payload like `MSG_UP`),
   * this method is called to update the activity timestamp. This prevents the connection
   * from being mistakenly identified as a zombie connection and forcefully terminated
   * by the gateway's periodic cleanup task (`sweepZombies`).
   */
  public refreshActivity(): void {
    this.lastActiveTime = Date.now();
    this.pingSent = false;
  }

  /**
   * Cleans up all pending timers to prevent memory leaks.
   */
  public cleanup(): void {
    ClientConnection.dirtyConnections.delete(this);
    this.notifyCollapseMap.clear();
  }

  /**
   * Marks the connection as authenticated.
   */
  public authenticate(
    userId: string,
    deviceId: string,
    jti: string,
    exp: number,
    deviceType?: string,
  ): void {
    this.userId = userId;
    this.deviceId = deviceId;
    this.jti = jti;
    this.exp = exp;
    this.deviceType = deviceType;
    this.authStatus = ConnectionAuthStatus.AUTHENTICATED;
  }

  /**
   * Enqueues a notification for micro-batching.
   * Collapses multiple notifications for the same group within a 200ms window.
   */
  public enqueueNotify(groupId: string, syncSeqId: string): void {
    const currentMax = this.notifyCollapseMap.get(groupId);

    // Only keep the largest SeqId (Notification Collapse)
    if (!currentMax || BigInt(syncSeqId) > BigInt(currentMax)) {
      this.notifyCollapseMap.set(groupId, syncSeqId);
    }

    // Add this connection to the global batching train
    ClientConnection.dirtyConnections.add(this);

    // If the train hasn't started the countdown, start it
    if (!ClientConnection.globalCollapseTimer) {
      ClientConnection.globalCollapseTimer = setTimeout(() => {
        ClientConnection.flushAllDirtyConnections();
      }, 200);
    }
  }

  /**
   * Flushes all connections that have pending notifications in a single tick.
   */
  private static flushAllDirtyConnections(): void {
    ClientConnection.globalCollapseTimer = undefined;
    for (const conn of ClientConnection.dirtyConnections) {
      conn.flushNotifies();
    }
    ClientConnection.dirtyConnections.clear();
  }

  /**
   * Flushes all collapsed notifications to the client.
   */
  private flushNotifies(): void {
    for (const [groupId, syncSeqId] of this.notifyCollapseMap.entries()) {
      const payload = Buffer.from(
        MsgNotify.encode({ groupId, syncSeqId }).finish(),
      );
      // ReqId 0 is used for server-initiated pushes (non-RPC)
      const buffer = this.monkeyService.frame(
        { cmd: MonkeyCmd.MSG_NOTIFY, reqId: 0, flags: 0 },
        payload,
      );

      this.sendRaw(buffer);
    }

    this.notifyCollapseMap.clear();
  }

  /**
   * Directly sends a pre-framed buffer to the client.
   */
  public sendRaw(buffer: Buffer): void {
    if (this.ws.readyState === this.ws.OPEN) {
      this.ws.send(buffer, { binary: true });
    }
  }
}
