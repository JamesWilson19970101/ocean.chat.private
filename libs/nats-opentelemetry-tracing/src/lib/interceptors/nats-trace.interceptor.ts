import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { NatsContext } from '@nestjs/microservices';
import {
  context,
  propagation,
  SpanKind,
  SpanStatusCode,
  TextMapGetter,
  trace,
} from '@opentelemetry/api';
import { Observable, throwError } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

export type NatsHeaderCarrier = Record<string, unknown>;

export const attr = {
  MESSAGING_SYSTEM: 'messaging.system',
  MESSAGING_DESTINATION: 'messaging.destination',
  MESSAGING_OPERATION: 'messaging.operation',
};

class NatsHeaderGetter implements TextMapGetter<NatsHeaderCarrier> {
  keys(carrier: NatsHeaderCarrier): string[] {
    return Object.keys(carrier);
  }
  get(carrier: NatsHeaderCarrier, key: string): string | undefined {
    const value = carrier[key];
    // NATS headers are an array of strings. We only need the first one.
    return Array.isArray(value) && value.length > 0
      ? (value[0] as string)
      : undefined;
  }
}

const getter = new NatsHeaderGetter();

@Injectable()
export class NatsTraceInterceptor implements NestInterceptor {
  private readonly tracer = trace.getTracer('nestjs-nats-manual-interceptor');

  intercept(
    executionContext: ExecutionContext,
    next: CallHandler<any>,
  ): Observable<any> {
    // If the context is not for NATS (e.g., it's an HTTP request),
    // skip the tracing logic and proceed.
    if (executionContext.getType() !== 'rpc') {
      return next.handle();
    }

    const rpcContext = executionContext.switchToRpc();
    const natsContext = rpcContext.getContext<NatsContext>();

    const subject = natsContext.getSubject();
    const headers = natsContext.getHeaders() ?? {};

    // extract context
    const parentContext = propagation.extract(
      context.active(),
      headers,
      getter,
    );

    // create span
    const span = this.tracer.startSpan(
      `NATS RECEIVE ${subject}`,
      {
        kind: SpanKind.SERVER,
        attributes: {
          [attr.MESSAGING_SYSTEM]: 'nats',
          [attr.MESSAGING_DESTINATION]: subject,
          [attr.MESSAGING_OPERATION]: 'publish',
        },
      },
      parentContext,
    );

    // Active span and run next
    return context.with(trace.setSpan(context.active(), span), () => {
      return next.handle().pipe(
        catchError((error) => {
          span.recordException(error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error.message,
          });
          return throwError(() => error);
        }),
        finalize(() => {
          span.end();
        }),
      );
    });
  }
}
