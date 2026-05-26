import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DomainException, ErrorCodes } from '@ocean.chat/common-exceptions';
import { TokenBlacklistService } from '@ocean.chat/cores';
import { I18nService } from '@ocean.chat/i18n';
import {
  AuthAck,
  AuthReq,
  ExceptionAck,
  MonkeyVersion,
  MsgNotify,
  MsgUp,
} from '@ocean.chat/monkey';
import { MonkeyCmd, MonkeyService } from '@ocean.chat/monkey';
import { BoundedPublisherService } from '@ocean.chat/nats-jetstream-provisioner';
import {
  IJwtPayload,
  ImUpEnvelopeDto,
  PresenceOnlineEventDto,
} from '@ocean.chat/types';
import { SERVICE_INSTANCE_ID } from '@ocean.chat/types';
import { plainToInstance } from 'class-transformer';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { ClientConnection } from './client-connection';

/**
 * Core processor for the Ocean Chat WebSocket Gateway.
 *
 * This service acts as the central brain for handling all incoming raw binary frames
 * from connected WebSocket clients. Its primary responsibilities include:
 * - Protocol unframing and decoding using the custom Monkey Protocol.
 * - Validating client rate limits using a per-connection Token Bucket.
 * - Handling the initial authentication handshake (`AUTH_REQ`) and JWT verification.
 * - Routing upstream messages (`MSG_UP`) safely to the central message bus (NATS JetStream).
 * - Managing heartbeat connections (`PING` / `PONG`).
 *
 * Note: This processor is designed to be strictly stateless. All connection-specific state
 * is maintained entirely within the passed `ClientConnection` instances.
 */
@Injectable()
export class OceanchatWsGatewayProcessor {
  constructor(
    private readonly monkeyService: MonkeyService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly i18nService: I18nService,
    private readonly tokenBlacklistService: TokenBlacklistService,
    private readonly boundedPublisher: BoundedPublisherService,
    @Inject(SERVICE_INSTANCE_ID) private readonly gatewayId: string,
    @InjectPinoLogger(OceanchatWsGatewayProcessor.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Processes a raw binary message received from a WebSocket client.
   *
   * This method implements the core pipeline for incoming WebSocket frames, including:
   * - Token Bucket rate limiting.
   * - Protocol unframing using the custom Monkey Protocol.
   * - Activity timestamp refreshing to prevent zombie connection sweeps.
   * - Pre-authentication rejection.
   * - Command-based routing (e.g., `AUTH_REQ`, `MSG_UP`, `PING`/`PONG`).
   *
   * @param connection - The stateful wrapper for the physical WebSocket client connection.
   * @param buffer - The raw binary frame buffer received from the network.
   * @param registerCb - A callback function invoked after successful authentication (`AUTH_REQ`). It registers the authenticated user and device into the gateway's routing structures.
   * @throws {DomainException} Thrown if the rate limit is exceeded (`AppStatus.TOO_MANY_REQUESTS`), an unauthenticated client sends a non-auth command (`AppStatus.UNAUTHORIZED`), or a PING payload is invalid.
   * @returns A promise that resolves when the buffer has been successfully routed and processed.
   */
  public async handleIncomingBuffer(
    connection: ClientConnection,
    buffer: Buffer,
    registerCb: (
      connection: ClientConnection,
      userId: string,
      deviceId: string,
      jti: string,
      exp: number,
    ) => void,
  ): Promise<void> {
    // rate limit
    if (!connection.rateLimiter.consume()) {
      throw new DomainException(
        this.i18nService.translate('RATE_LIMIT_EXCEEDED'),
        ErrorCodes.RATE_LIMIT_EXCEEDED,
      );
    }

    const { header, payload } = this.monkeyService.unframe(buffer);

    // Smooth Version Negotiation (Zero I/O Intercept)
    if (
      !(MonkeyVersion.SUPPORTED_VERSIONS as readonly number[]).includes(
        header.version,
      )
    ) {
      const exceptionAckPayload = Buffer.from(
        ExceptionAck.encode({
          errorCode: 426,
          message: this.i18nService.translate('PROTOCOL_VERSION_MISMATCH', {
            defaultValue: 'Protocol version mismatch',
          }),
          serverSupportedVersions: [...MonkeyVersion.SUPPORTED_VERSIONS],
          timestamp: Date.now().toString(),
        }).finish(),
      );
      this.sendRaw(
        connection,
        MonkeyCmd.EXCEPTION_ACK,
        header.reqId,
        exceptionAckPayload,
      );
      setTimeout(() => connection.ws.terminate(), 100);
      return;
    }

    // Must be executed after successful unframe parsing to prevent malicious clients from sending garbage data to maintain the connection
    connection.refreshActivity();

    connection.pingSent = false;

    if (!connection.userId && header.cmd !== MonkeyCmd.AUTH_REQ) {
      throw new DomainException(
        this.i18nService.translate('UNAUTHORIZED'),
        ErrorCodes.UNAUTHORIZED,
        401,
      );
    }

    switch (header.cmd) {
      case MonkeyCmd.AUTH_REQ:
        await this.handleAuthReq(connection, header.reqId, payload, registerCb);
        break;

      case MonkeyCmd.MSG_UP:
        this.handleMsgUp(connection, header.reqId, payload);
        break;

      case MonkeyCmd.PING:
        // The payload of the PING command must be empty
        if (payload.length > 0) {
          throw new DomainException(
            this.i18nService.translate('PING_PAYLOAD_NOT_EMPTY'),
            ErrorCodes.UNEXPECTED_ERROR,
          );
        }
        this.sendRaw(connection, MonkeyCmd.PONG, header.reqId, Buffer.alloc(0));
        break;
      case MonkeyCmd.PONG:
        // Any message (including PONG) refreshes activity, which is already handled above. No-op.
        break;

      default:
        this.logger.warn(
          this.i18nService.translate('UNHANDLED_COMMAND_LOG', {
            defaultValue: 'Unhandled command: 0x{{cmd}}',
            cmd: header.cmd.toString(16),
          }),
        );
    }
  }

  /**
   * Utility to decode MSG_NOTIFY payload for micro-batching.
   */
  public decodeMsgNotify(payload: Buffer): MsgNotify {
    return MsgNotify.decode(payload);
  }

  /**
   * Handles the [0x01] AUTH_REQ handshake.
   */
  private async handleAuthReq(
    connection: ClientConnection,
    reqId: number,
    payload: Buffer,
    registerCb: (
      connection: ClientConnection,
      userId: string,
      deviceId: string,
      jti: string,
      exp: number,
    ) => void,
  ): Promise<void> {
    const authReq = AuthReq.decode(payload);

    try {
      const jwtPayload = await this.jwtService.verifyAsync<IJwtPayload>(
        authReq.jwt,
        {
          publicKey: this.configService.get<string>('jwt.accessPublicKey'),
          algorithms: ['RS256'],
        },
      );

      const isRevoked = await this.tokenBlacklistService.isRevoked(
        jwtPayload.jti,
      );
      if (isRevoked) {
        throw new DomainException(
          this.i18nService.translate('UNAUTHORIZED'),
          ErrorCodes.UNAUTHORIZED,
        );
      }

      if (!jwtPayload.exp) {
        throw new Error(this.i18nService.translate('JWT_MISSING_EXP_CLAIM'));
      }

      registerCb(
        connection,
        jwtPayload.sub,
        authReq.deviceId,
        jwtPayload.jti,
        jwtPayload.exp,
      );

      this.logger.info(
        this.i18nService.translate('USER_AUTHENTICATED_ON_DEVICE_LOG', {
          defaultValue: 'User {{userId}} authenticated on device {{deviceId}}',
          userId: jwtPayload.sub,
          deviceId: authReq.deviceId,
        }),
      );

      const onlineEvent = plainToInstance(PresenceOnlineEventDto, {
        userId: jwtPayload.sub,
        deviceId: authReq.deviceId,
        deviceType: authReq.deviceType,
        gatewayId: this.gatewayId,
        timestamp: new Date().toISOString(),
      });

      void this.boundedPublisher.publishSafe(
        'presence.conn.online',
        onlineEvent,
        'ws_auth_success',
        { isCritical: false },
      );

      this.sendResponse(connection, MonkeyCmd.AUTH_ACK, reqId, AuthAck, {
        userId: jwtPayload.sub,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.warn(
        this.i18nService.translate('AUTH_FAILED_LOG', {
          defaultValue: 'Auth failed: {{errorMessage}}',
          errorMessage,
        }),
      );
      this.sendResponse(
        connection,
        MonkeyCmd.EXCEPTION_ACK,
        reqId,
        ExceptionAck,
        {
          errorCode: ErrorCodes.UNAUTHORIZED,
          message: this.i18nService.translate('INVALID_OR_EXPIRED_TOKEN'),
          timestamp: new Date().toISOString(),
          serverSupportedVersions: [],
        },
      );
      connection.ws.terminate();
    }
  }

  /**
   * Handles the [0x05] MSG_UP ingestion.
   */
  private handleMsgUp(
    connection: ClientConnection,
    reqId: number,
    payload: Buffer,
  ): void {
    const msgUp = MsgUp.decode(payload);
    const isGroup = msgUp.groupId.startsWith('G');
    const subject = isGroup ? 'im.up.group' : 'im.up.p2p';

    const envelope = plainToInstance(ImUpEnvelopeDto, {
      userId: connection.userId,
      deviceId: connection.deviceId,
      gatewayId: this.gatewayId,
      rawHeader: {
        cmd: MonkeyCmd.MSG_UP,
        reqId: reqId,
      },
      payload: payload.toString('base64'),
    });

    void this.boundedPublisher
      .publishSafe(subject, envelope, 'msg_up_ingestion', { isCritical: false })
      .catch((err) => {
        const errorMessage = err instanceof Error ? err.message : String(err);
        this.logger.error(
          this.i18nService.translate('FAILED_TO_INGEST_MSG_UP_LOG', {
            defaultValue: 'Failed to ingest MSG_UP: {{errorMessage}}',
            errorMessage,
          }),
        );
      });
  }

  private sendResponse<T>(
    connection: ClientConnection,
    cmd: number,
    reqId: number,
    proto: { encode: (msg: T) => { finish: () => Uint8Array } },
    message: T,
  ): void {
    const payload = Buffer.from(proto.encode(message).finish());
    this.sendRaw(connection, cmd, reqId, payload);
  }

  private sendRaw(
    connection: ClientConnection,
    cmd: number,
    reqId: number,
    payload: Buffer,
  ): void {
    const buffer = this.monkeyService.frame({ cmd, reqId, flags: 0 }, payload);
    connection.sendRaw(buffer);
  }
}
