import { ClientNats, NatsOptions } from '@nestjs/microservices';
import {
  context,
  propagation,
  SpanKind,
  TextMapSetter,
  trace,
} from '@opentelemetry/api';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

import {
  attr,
  NatsHeaderCarrier,
} from '../interceptors/nats-trace.interceptor';

class NatsHeaderSetter implements TextMapSetter<NatsHeaderCarrier> {
  set(carrier: NatsHeaderCarrier, key: string, value: string): void {
    carrier[key] = value;
  }
}

const setter = new NatsHeaderSetter();

export class InstrumentedClientNats extends ClientNats {
  private readonly tracer = trace.getTracer('nestjs-nats-manual-client');

  constructor(options: Required<NatsOptions>['options']) {
    super(options);
  }

  // override emit
  emit<TResult = any, TInput = any>(
    pattern: any,
    data: TInput,
  ): Observable<TResult> {
    const operation = () => super.emit(pattern, data);
    return this.traceableCall('PUBLISH', pattern, operation, data);
  }

  public send<TResult = any, TInput = any>(
    pattern: any,
    data: TInput,
  ): Observable<TResult> {
    const operation = () => super.send(pattern, data);
    return this.traceableCall('REQUEST', pattern, operation, data);
  }

  private traceableCall<TResult = any, TInput = any>(
    operation: 'PUBLISH' | 'REQUEST',
    pattern: any,
    callSuper: () => Observable<any>,
    data: TInput,
  ): Observable<TResult> {
    const subject =
      typeof pattern === 'object' ? JSON.stringify(pattern) : pattern;
    const spanName = `NATS ${operation} ${subject}`;

    // get current active context as parent, it's the key of call chain
    const parentContext = context.active();

    // create a span as the son
    const span = this.tracer.startSpan(spanName, {
      kind: SpanKind.CLIENT,
      attributes: {
        [attr.MESSAGING_SYSTEM]: 'nats',
        [attr.MESSAGING_DESTINATION]: subject,
        [attr.MESSAGING_OPERATION]: operation.toLowerCase(),
      },
    });

    return context.with(trace.setSpan(parentContext, span), () => {
      const newData =
        typeof data === 'object' && data !== null ? { ...data } : data;

      const headers =
        typeof newData === 'object' && newData !== null && 'headers' in newData
          ? (newData as { headers?: any }).headers || {}
          : {};
      // inject header into context
      propagation.inject(
        trace.setSpan(context.active(), span),
        headers,
        setter,
      );
      if (typeof newData === 'object' && newData !== null) {
        (newData as { headers?: {} & Record<string, unknown> }).headers =
          headers;
      }

      const resultObservable = callSuper.apply({
        ...this,
        data: newData,
      }) as Observable<any>;

      // make sure span will be ended
      return resultObservable.pipe(
        finalize(() => {
          span.end();
        }),
      );
    }) as Observable<TResult>;
  }
}
