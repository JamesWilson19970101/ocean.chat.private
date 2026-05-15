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
import { MsgHdrs } from 'nats';
import { Observable, throwError } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

export const attr = {
  MESSAGING_SYSTEM: 'messaging.system',
  MESSAGING_DESTINATION: 'messaging.destination',
  MESSAGING_OPERATION: 'messaging.operation',
};

class NatsHeaderGetter implements TextMapGetter<MsgHdrs> {
  keys(carrier: MsgHdrs): string[] {
    return carrier.keys();
  }
  get(carrier: MsgHdrs, key: string): string | undefined {
    return carrier.get(key) || undefined;
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
    const headers = natsContext.getHeaders();

    // extract context
    const parentContext = headers
      ? propagation.extract(context.active(), headers, getter)
      : context.active();

    // create span
    const span = this.tracer.startSpan(
      `NATS RECEIVE ${subject}`,
      {
        kind: SpanKind.SERVER,
        attributes: {
          [attr.MESSAGING_SYSTEM]: 'nats',
          [attr.MESSAGING_DESTINATION]: subject,
          [attr.MESSAGING_OPERATION]: 'receive',
        },
      },
      parentContext,
    );

    // Active span and run next
    return context.with(trace.setSpan(context.active(), span), () => {
      return next.handle().pipe(
        catchError((error: { message: string; [key: string]: unknown }) => {
          span.recordException(error as any);
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
