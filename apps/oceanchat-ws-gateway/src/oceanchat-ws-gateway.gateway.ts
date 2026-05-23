import { Inject, OnModuleDestroy, UseFilters } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import {
  AppStatus,
  ErrorCodes,
  MonkeyWsExceptionFilter,
} from '@ocean.chat/common-exceptions';
import { I18nService } from '@ocean.chat/i18n';
import {
  ExceptionAck,
  MonkeyCmd,
  MonkeyHeartbeat,
  MonkeyService,
  ReadReceipt,
} from '@ocean.chat/monkey';
import { ConnectionAuthStatus } from '@ocean.chat/types';
import { SERVICE_INSTANCE_ID, SERVICE_NAME } from '@ocean.chat/types';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Server, WebSocket } from 'ws';

import { ClientConnection } from './client-connection';
import { OceanchatWsGatewayProcessor } from './oceanchat-ws-gateway.processor';
import { OceanchatWsGatewayService } from './oceanchat-ws-gateway.service';
/**
 * The WebSocket Gateway for Ocean Chat.
 * Handles the physical connections and protocol framing/unframing.
 * Strictly stateless.
 */
@WebSocketGateway({ path: '/monkey' })
@UseFilters(MonkeyWsExceptionFilter)
export class OceanchatWsGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  private sweepTimer?: NodeJS.Timeout;
  private heartbeatTimer?: NodeJS.Timeout;

  @WebSocketServer()
  server: Server;

  // Memory safe mapping: when socket is closed and GCed, connection is freed.
  private readonly socketMap = new WeakMap<WebSocket, ClientConnection>();

  // Explicit tracking for management tasks (sweep, graceful shutdown)
  private readonly activeSockets = new Set<WebSocket>();

  /**
   * Reverse lookup tree for directed message delivery: Map<UserId, Map<DeviceId, ClientConnection>>.
   *
   * This double-layered structure is designed for:
   * 1. Multi-device Support: Allows a single user to be connected from multiple devices (e.g., PC, Mobile) simultaneously.
   * 2. Precise Routing: Provides O(1) time complexity for broadcasting to all devices of a user or unicasting to a specific device.
   * 3. Offline State Management: Easily determines when a user's *last* device disconnects to report a global offline status.
   */
  private readonly userRoutingTree = new Map<
    string,
    Map<string, ClientConnection>
  >();

  constructor(
    private readonly gatewayService: OceanchatWsGatewayService,
    private readonly processor: OceanchatWsGatewayProcessor,
    private readonly monkeyService: MonkeyService,
    @Inject(SERVICE_NAME) private readonly serviceName: string,
    @Inject(SERVICE_INSTANCE_ID) private readonly gatewayId: string,
    private readonly i18nService: I18nService,
    @InjectPinoLogger(OceanchatWsGateway.name)
    private readonly logger: PinoLogger,
  ) {
    this.logger.info(
      { gatewayId: this.gatewayId },
      this.i18nService.translate('WS_GATEWAY_INITIALIZED_LOG', {
        gatewayId: this.gatewayId,
      }),
    );
    // Asymmetric Heartbeat: Sweep every 5s to proactively send PINGs and clear zombies
    this.sweepTimer = setInterval(
      () => this.sweepZombies(),
      MonkeyHeartbeat.SWEEP_INTERVAL,
    );
    // Setting the heartbeat interval to 3 minutes (180 seconds) and the Redis expiration time (TTL) to 5 minutes (300 seconds) is a classic and proven "golden ratio" in distributed system state management.
    this.heartbeatTimer = setInterval(
      () => this.sendPresenceHeartbeats(),
      180000,
    );
  }

  /**
   * Lifecycle hook triggered during the graceful shutdown of the module.
   *
   * When the service is shutting down (e.g., during deployments, process restarts, or scaling down), this method ensures:
   * 1. The zombie connection sweep timer is cleared to stop background tasks.
   * 2. A `503 Service Unavailable` (`EXCEPTION_ACK`) protocol message is proactively broadcast to all active clients.
   *    (Using `reqId: 0` as this is a server-initiated push notification, not an RPC response).
   * 3. All underlying WebSocket physical connections are cleanly closed with the standard `1012 Service Restart` status code,
   *    instructing clients to initiate their automatic reconnection logic to other healthy gateway nodes.
   * 4. The local memory registries of active sockets are cleared to prevent memory leaks during teardown.
   */
  onModuleDestroy() {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.logger.info(
      this.i18nService.translate('WS_GATEWAY_SHUTTING_DOWN_LOG'),
    );

    const exceptionPayload = Buffer.from(
      ExceptionAck.encode({
        errorCode: AppStatus.SERVICE_UNAVAILABLE,
        message: this.i18nService.translate('SERVICE_SHUTDOWN_RECONNECT'),
        timestamp: new Date().toISOString(),
        serverSupportedVersions: [],
      }).finish(),
    );

    const exceptionBuffer = this.monkeyService.frame(
      { cmd: MonkeyCmd.EXCEPTION_ACK, reqId: 0, flags: 0 },
      exceptionPayload,
    );

    for (const client of this.activeSockets) {
      if (client.readyState === client.OPEN) {
        client.send(exceptionBuffer, { binary: true });
        client.close(ErrorCodes.WS_CLOSE_SERVICE_RESTART, 'Service Restart');
      }
    }

    this.activeSockets.clear();
  }

  /**
   * Called automatically by the framework when a new physical WebSocket connection is established.
   *
   * This method initializes the connection state by wrapping the raw socket into a `ClientConnection`
   * and adding it to the local memory registries. It also enforces a strict 5-second "Handshake Window Timeout".
   * If the client does not successfully authenticate (e.g., by sending an `AUTH_REQ`) within 5 seconds,
   * the connection is automatically closed with a `4008 Handshake Timeout` status code to prevent resource exhaustion attacks.
   *
   * @param client - The raw, underlying WebSocket instance provided by the `ws` library.
   */
  handleConnection(client: WebSocket) {
    const connection = new ClientConnection(client, this.monkeyService);
    this.socketMap.set(client, connection);
    this.activeSockets.add(client);

    this.logger.debug(
      this.i18nService.translate('NEW_CONNECTION_WAITING_AUTH_REQ_LOG'),
    );
  }

  /**
   * Global message handler for all incoming upstream WebSocket messages (binary frames).
   *
   * As the gateway uses the custom Monkey Protocol, the underlying `ws` library emits a
   * generic 'message' event for all received data. This method acts as the single unified funnel.
   * It retrieves the associated connection state and delegates the payload to the `OceanchatWsGatewayProcessor`
   * for protocol unframing, rate-limiting, and routing (e.g., handling `AUTH_REQ` or `MSG_UP`).
   *
   * Any exceptions thrown during processing will be automatically caught by the framework and intercepted
   * by the `MonkeyWsExceptionFilter`, which safely converts them into `[0x0C] EXCEPTION_ACK` binary frames.
   *
   * @param client - The raw, underlying WebSocket instance triggering the message event.
   * @param data - The raw binary data frame sent by the client, containing a 12-byte Header and a Protobuf Payload.
   */
  @SubscribeMessage('message')
  async handleMessage(client: WebSocket, data: Buffer): Promise<void> {
    // Physical layer interception: 16KB Payload + 12 Byte Header = 16396 Bytes
    // Prevents maliciously constructed oversized frames from causing Node.js OOM
    if (data.length > 16396) {
      this.logger.warn(
        this.i18nService.translate('OVERSIZED_PAYLOAD_TERMINATED_LOG'),
      );
      client.terminate();
      return;
    }

    const connection = this.socketMap.get(client);
    if (!connection) return;

    await this.processor.handleIncomingBuffer(
      connection,
      data,
      (conn, userId, deviceId, jti) =>
        this.registerConnection(conn, userId, deviceId, jti),
    );
  }

  /**
   * Lifecycle hook called automatically by the framework when a physical WebSocket connection is closed.
   *
   * This method is responsible for gracefully tearing down the connection state to prevent memory leaks
   * and ensuring global presence accuracy. Specifically, it performs the following:
   * 1. Removes the raw socket from tracking sets (`activeSockets` and `socketMap`).
   * 2. Triggers the connection's internal `cleanup()` to clear any pending micro-batching timers.
   * 3. Removes the device from the `userRoutingTree`. If this was the user's last active device on this gateway,
   *    the user's root node is deleted from the tree.
   * 4. Reports the device offline event to the global presence service to synchronize online status.
   *
   * @param client - The raw, underlying WebSocket instance that has just disconnected.
   */
  handleDisconnect(client: WebSocket) {
    const connection = this.socketMap.get(client);
    this.activeSockets.delete(client);

    if (!connection) return;

    connection.cleanup();

    if (connection.userId && connection.deviceId) {
      const deviceMap = this.userRoutingTree.get(connection.userId);
      if (deviceMap) {
        deviceMap.delete(connection.deviceId);
        if (deviceMap.size === 0) {
          this.userRoutingTree.delete(connection.userId);
        }
      }

      this.gatewayService.reportOffline(
        connection.userId,
        connection.deviceId,
        this.gatewayId,
      );

      this.logger.info(
        { userId: connection.userId },
        this.i18nService.translate('USER_DISCONNECTED_LOG', {
          userId: connection.userId,
        }),
      );
    }

    this.socketMap.delete(client);
  }

  /**
   * Kicks a user and terminates their WebSocket connection based on their JWT ID (jti).
   *
   * This method is primarily used when a user's authentication token is revoked
   * (e.g., via the token blacklist) while they still maintain an active connection to the gateway.
   * It sends an `EXCEPTION_ACK` message to the client indicating the token revocation before forcefully terminating the connection.
   *
   * @param jti - The unique JWT ID (JSON Web Token ID) associated with the user's connection.
   * @param reason - The reason for token revocation (e.g. 'LOGOUT', 'REPLAY_ATTACK').
   */
  public kickUserByJti(jti: string, reason?: string): void {
    let exceptionBuffer: Buffer | undefined;
    const isNormalLogout = reason === 'LOGOUT';

    if (!isNormalLogout) {
      const exceptionPayload = Buffer.from(
        ExceptionAck.encode({
          errorCode: ErrorCodes.REFRESH_TOKEN_REUSED_OR_REVOKED,
          message: this.i18nService.translate('TOKEN_REVOKED_RECONNECT'),
          timestamp: new Date().toISOString(),
          serverSupportedVersions: [],
        }).finish(),
      );

      exceptionBuffer = this.monkeyService.frame(
        { cmd: MonkeyCmd.EXCEPTION_ACK, reqId: 0, flags: 0 },
        exceptionPayload,
      );
    }

    for (const client of this.activeSockets) {
      const connection = this.socketMap.get(client);
      if (connection && connection.jti === jti) {
        this.logger.warn(
          { userId: connection.userId, reason },
          this.i18nService.translate('KICKING_USER_REVOKED_TOKEN_LOG', {
            userId: connection.userId,
          }),
        );
        if (client.readyState === client.OPEN) {
          if (exceptionBuffer) {
            client.send(exceptionBuffer, { binary: true });
            client.terminate();
          } else {
            // Graceful close for normal logout
            client.close(1000, 'Normal Logout');
          }
        }
      }
    }
  }

  /**
   * Dispatches a downbound event (received from the NATS message bus) to the specific device(s) of a user.
   *
   * This method handles both unicast and broadcast delivery:
   * - Unicast: If a `deviceId` is provided, the message is sent only to that specific device.
   * - Broadcast: If `deviceId` is undefined, the message is broadcast to all active devices of the user.
   *
   * Special handling is applied for `MonkeyCmd.MSG_NOTIFY`:
   * Instead of being sent immediately, the payload is decoded and enqueued into the connection's
   * micro-batching queue (`enqueueNotify`) to collapse multiple notifications into a single frame.
   *
   * @param userId - The unique identifier of the target user.
   * @param deviceId - The specific device identifier. If undefined, broadcasts to all devices of the user.
   * @param cmd - The protocol command identifier (e.g., MSG_NOTIFY, MSG_UP_ACK).
   * @param payloadBase64 - The Base64 encoded Protobuf payload to be sent.
   * @param reqId - The request ID for RPC matching. Defaults to 0 (indicating a server-initiated push).
   */
  public dispatchDownbound(
    userId: string,
    deviceId: string | undefined,
    cmd: MonkeyCmd,
    payloadBase64: string,
    reqId: number = 0,
  ) {
    const deviceMap = this.userRoutingTree.get(userId);
    if (!deviceMap) {
      // Edge Case Handling: Redis master-slave failover might cause asynchronous replication data loss (e.g., missed offline event).
      // Zombie Route Detected! User is not on this node at all.
      // We passively heal the global presence state by re-emitting an offline event.
      this.logger.debug(
        this.i18nService.translate('ZOMBIE_ROUTE_DETECTED_LOG', {
          userId,
          deviceId,
        }),
      );
      if (deviceId) {
        this.gatewayService.reportOffline(userId, deviceId, this.gatewayId);
      }
      return;
    }

    const payload = Buffer.from(payloadBase64, 'base64');

    if (deviceId) {
      const connection = deviceMap.get(deviceId);
      if (connection) {
        if (cmd === MonkeyCmd.MSG_NOTIFY) {
          const decoded = this.processor.decodeMsgNotify(payload);
          connection.enqueueNotify(decoded.groupId, decoded.syncSeqId);
        } else {
          const buffer = this.monkeyService.frame(
            { cmd, reqId, flags: 0 },
            payload,
          );
          connection.sendRaw(buffer);
        }
      } else {
        // Edge Case Handling: Redis master-slave failover might cause asynchronous replication data loss.
        // Zombie Device Route Detected! User is on this node, but not this specific device.
        this.logger.debug(
          this.i18nService.translate('ZOMBIE_DEVICE_ROUTE_DETECTED_LOG', {
            userId,
            deviceId,
          }),
        );
        this.gatewayService.reportOffline(userId, deviceId, this.gatewayId);
      }
    } else {
      for (const connection of deviceMap.values()) {
        const buffer = this.monkeyService.frame(
          { cmd, reqId, flags: 0 },
          payload,
        );
        connection.sendRaw(buffer);
      }
    }
  }

  /**
   * TODO: Dispatches a cross-device sync event.
   */
  public dispatchSync(userId: string, groupId: string, syncSeqId: string) {
    const deviceMap = this.userRoutingTree.get(userId);
    if (!deviceMap) return;

    const payload = Buffer.from(
      ReadReceipt.encode({ groupId, syncSeqId }).finish(),
    );
    const buffer = this.monkeyService.frame(
      { cmd: MonkeyCmd.READ_RECEIPT, reqId: 0, flags: 0 },
      payload,
    );

    for (const connection of deviceMap.values()) {
      connection.sendRaw(buffer);
    }
  }

  /**
   * Scans for idle connections and cleans up zombies based on the Asymmetric Heartbeat mechanism.
   *
   * This method periodically iterates over all currently active WebSocket physical connections and checks their last active time (`lastActiveTime`).
   * - If a connection has been idle for 30 seconds (`idlePingThreshold`), the server proactively pushes a `PING` frame.
   * - If a connection remains unauthenticated for 5 seconds (`handshakeTimeoutThreshold`), it is forcefully closed.
   * - If a connection has been idle for 60 seconds (`deadTimeoutThreshold`), it is considered a zombie connection.
   *   The system directly calls `terminate()` to forcefully sever the underlying TCP/WebSocket connection, preventing resource leaks.
   *
   * @private
   */
  private sweepZombies() {
    const now = Date.now();
    const deadTimeoutThreshold = MonkeyHeartbeat.DEAD_TIMEOUT;
    const idlePingThreshold = MonkeyHeartbeat.SERVER_PING_INTERVAL;
    const handshakeTimeoutThreshold = MonkeyHeartbeat.HANDSHAKE_TIMEOUT;

    for (const client of this.activeSockets) {
      const connection = this.socketMap.get(client);
      if (!connection) continue;

      // Asymmetric Heartbeat: Enforce Handshake Window Timeout
      if (
        connection.authStatus === ConnectionAuthStatus.PENDING &&
        now - connection.connectedAt > handshakeTimeoutThreshold
      ) {
        this.logger.warn(this.i18nService.translate('HANDSHAKE_TIMEOUT_LOG'));
        client.close(
          ErrorCodes.WS_CLOSE_HANDSHAKE_TIMEOUT,
          'Handshake Timeout',
        );
        continue;
      }

      const idleTime = now - connection.lastActiveTime;

      if (idleTime >= deadTimeoutThreshold) {
        const uid = connection.userId || 'unauthenticated';
        this.logger.warn(
          { userId: uid },
          this.i18nService.translate('TERMINATING_ZOMBIE_CONNECTION_LOG', {
            userId: uid,
          }),
        );
        client.terminate(); // Force close
      } else if (idleTime >= idlePingThreshold && !connection.pingSent) {
        // Asymmetric Heartbeat: Server proactively pushes PING [0x03]
        const pingBuffer = this.monkeyService.frame(
          { cmd: MonkeyCmd.PING, reqId: 0, flags: 0 },
          Buffer.alloc(0),
        );
        connection.sendRaw(pingBuffer);
        connection.pingSent = true;
      }
    }
  }

  /**
   * Periodically sends a global presence heartbeat event for all active and authenticated WebSocket connections.
   *
   * This method iterates over all physical connections maintained by the gateway (`activeSockets`). For connections
   * that have successfully authenticated (having a valid `userId` and `deviceId`), it delegates to the `gatewayService`
   * to publish a `presence.conn.heartbeat` event to the NATS message bus.
   *
   * This heartbeat mechanism is central to the distributed IM online state management. It is primarily used to renew
   * the Redis route table's TTL (`HEXPIRE`), preventing truly active users from being falsely marked as offline
   * due to a lack of interactive messages (preventing zombie connection cleanup).
   *
   * @private
   * @remarks This method is driven by the timer created during gateway initialization (`heartbeatTimer`) and typically runs every 3 minutes (180s).
   */
  private sendPresenceHeartbeats() {
    let count = 0;
    for (const client of this.activeSockets) {
      const connection = this.socketMap.get(client);
      if (
        connection &&
        connection.authStatus === ConnectionAuthStatus.AUTHENTICATED &&
        connection.userId &&
        connection.deviceId
      ) {
        this.gatewayService.reportHeartbeat(
          connection.userId,
          connection.deviceId,
          this.gatewayId,
        );
        count++;
      }
    }
    if (count > 0) {
      this.logger.debug(
        this.i18nService.translate('SENT_HEARTBEATS_LOG', { count }),
      );
    }
  }

  /**
   * Registers a successfully authenticated connection into the gateway's routing structures.
   *
   * This method updates the connection's internal state to authenticated and adds it to the
   * `userRoutingTree` to enable targeted message delivery (unicast to a specific device or broadcast to all devices of a user).
   *
   * @param connection - The client connection to register.
   * @param userId - The unique identifier of the authenticated user.
   * @param deviceId - The unique identifier of the device the user is connecting from.
   * @param jti - The JWT ID used for this connection, tracked for instant revocation (kicking).
   */
  private registerConnection(
    connection: ClientConnection,
    userId: string,
    deviceId: string,
    jti: string,
  ) {
    connection.authenticate(userId, deviceId, jti);

    let deviceMap = this.userRoutingTree.get(userId);
    if (!deviceMap) {
      deviceMap = new Map();
      this.userRoutingTree.set(userId, deviceMap);
    }
    deviceMap.set(deviceId, connection);
  }
}
