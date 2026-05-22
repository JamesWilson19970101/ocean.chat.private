import { INestApplicationContext } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import { MessageMappingProperties } from '@nestjs/websockets';
import { I18nService } from '@ocean.chat/i18n';
import { RedisService } from '@ocean.chat/redis';
import { IncomingMessage } from 'http';
import { Logger } from 'nestjs-pino';
import { EMPTY, fromEvent, Observable } from 'rxjs';
import { filter, mergeMap } from 'rxjs/operators';
import * as WebSocket from 'ws';

/**
 * Custom WebSocket Adapter to implement Edge Protection.
 * Defends against Connection Flood / FD Exhaustion attacks by limiting
 * the maximum number of concurrent connections originating from a single IP address
 * across the entire distributed cluster using Redis.
 */
export class RateLimitedWsAdapter extends WsAdapter {
  private readonly pinoLogger: Logger;
  private readonly redisService: RedisService;
  private readonly i18nService: I18nService;
  // Strictly limit each IP to max 20 concurrent connections to prevent FD exhaustion
  private readonly MAX_CONNECTIONS_PER_IP = 20;
  // Fallback TTL (24 hours) to prevent counter leaks in Redis if a close event is missed
  private readonly COUNTER_TTL_SECONDS = 86400;

  constructor(app: INestApplicationContext) {
    super(app);
    this.pinoLogger = app.get(Logger);
    this.redisService = app.get(RedisService);
    this.i18nService = app.get(I18nService);
  }

  public create(
    port: number,
    options: WebSocket.ServerOptions = {},
  ): WebSocket.Server {
    const server: WebSocket.Server = super.create(port, options);

    // Intercept the HTTP Upgrade request *before* the websocket handshake is completed.
    server.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const ip = this.getClientIp(req);
      const redisKey = `rate:ws:ip:${ip}`;

      let isClosed = false;

      // Register the close handler synchronously to guarantee we never miss an instant disconnection
      // that might happen while we are awaiting the Redis INCR operation.
      const handleClose = () => {
        isClosed = true;
        void (async () => {
          try {
            const LUA_DECR = `
              local current = redis.call("DECR", KEYS[1])
              if current <= 0 then
                redis.call("DEL", KEYS[1])
              else
                redis.call("EXPIRE", KEYS[1], ARGV[1])
              end
              return current
            `;
            await this.redisService.eval(
              LUA_DECR,
              [redisKey],
              [this.COUNTER_TTL_SECONDS],
            );
          } catch (err) {
            const errorMessage = this.i18nService.translate('DECREMENT_FAILED');
            this.pinoLogger.error({ err, ip }, errorMessage);
          }
        })();
      };

      ws.once('close', handleClose);

      void (async () => {
        try {
          // Atomically INCR and set EXPIRE
          const LUA_INCR = `
            local current = redis.call("INCR", KEYS[1])
            redis.call("EXPIRE", KEYS[1], ARGV[1])
            return current
          `;

          const currentCount = (await this.redisService.eval(
            LUA_INCR,
            [redisKey],
            [this.COUNTER_TTL_SECONDS],
          )) as number;

          if (currentCount > this.MAX_CONNECTIONS_PER_IP) {
            const warnMessage = this.i18nService.translate('FLOOD_REJECTED', {
              ip,
              limit: this.MAX_CONNECTIONS_PER_IP,
            });

            this.pinoLogger.warn(warnMessage);

            // If the socket hasn't closed yet, forcefully terminate it.
            // ws.terminate() will synchronously or tick-asynchronously emit the 'close' event,
            // which safely invokes `handleClose` and handles the Redis DECR for us.
            if (!isClosed) {
              ws.terminate();
            }
            return;
          }
        } catch {
          // Fail-open: If Redis is down or INCR fails, we remove the close listener so we don't blindly DECR later.
          ws.off('close', handleClose);
          this.pinoLogger.error('REDIS_ERROR_FAIL_OPEN');
        }
      })();
    });

    return server;
  }

  /**
   * Extracts the true client IP, accounting for potential load balancers or reverse proxies.
   */
  private getClientIp(req: IncomingMessage): string {
    // 1. Prioritize X-Real-IP forcibly set by a trusted reverse proxy.
    // Since it's usually overwritten rather than appended, it is extremely difficult to spoof.
    const realIp = req.headers['x-real-ip'];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0].trim() : realIp.trim();
    }

    // 2. Fall back to X-Forwarded-For if X-Real-IP is absent.
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
      if (typeof forwardedFor === 'string') {
        return forwardedFor.split(',')[0].trim();
      } else if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
        return forwardedFor[0].trim();
      }
    }
    return req.socket.remoteAddress || 'unknown';
  }

  public bindMessageHandlers(
    client: any,
    handlers: MessageMappingProperties[],
    process: (data: any) => Observable<any>,
  ) {
    const handlersMap = new Map<string, MessageMappingProperties>();
    handlers.forEach((handler) => handlersMap.set(handler.message, handler));

    fromEvent(client, 'message')
      .pipe(
        mergeMap((data) => this.bindMessageHandler(data, handlersMap, process)),
        filter((result) => result !== undefined && result !== null),
      )
      .subscribe();
  }

  public bindMessageHandler(
    buffer: any,
    handlers: Map<string, MessageMappingProperties>,
    process: (data: any) => Observable<any>,
  ): Observable<any> {
    const messageHandler = Array.from(handlers.values()).find(
      (handler) => handler.message === 'message',
    );
    if (!messageHandler) {
      return EMPTY;
    }

    const payload =
      buffer instanceof Buffer
        ? buffer
        : (buffer as { data?: any })?.data || buffer;
    return process(messageHandler.callback(payload));
  }
}
