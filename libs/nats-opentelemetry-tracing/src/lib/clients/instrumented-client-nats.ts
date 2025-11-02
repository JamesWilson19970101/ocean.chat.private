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
    // NATS headers expect values to be an array of strings.
    // To ensure compatibility with the NatsHeaderGetter on the receiving side,
    // which expects an array, we wrap the value in an array.
    carrier[key] = [value];
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
    // Pass the super.emit method bound to `this` context.
    return this.traceableCall('PUBLISH', pattern, super.emit.bind(this), data);
  }

  public send<TResult = any, TInput = any>(
    pattern: any,
    data: TInput,
  ): Observable<TResult> {
    // Pass the super.send method bound to `this` context.
    return this.traceableCall('REQUEST', pattern, super.send.bind(this), data);
  }

  private traceableCall<TResult = any, TInput = any>(
    operation: 'PUBLISH' | 'REQUEST',
    pattern: any,
    superMethod: (pattern: any, data: TInput) => Observable<any>,
    data: TInput,
  ): Observable<TResult> {
    const subject = this.normalizePattern(pattern);
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
      // Create a mutable copy of data if it's an object, otherwise use it as is.
      // This prevents side effects on the original data object passed by the caller.
      const newData =
        typeof data === 'object' && data !== null ? { ...data } : data;

      // Ensure headers object exists for context injection.
      // If newData is an object, we can potentially add/modify its headers.
      const headers =
        typeof newData === 'object' && newData !== null && 'headers' in newData
          ? (newData as { headers?: NatsHeaderCarrier }).headers || {}
          : {};

      // Inject the active span's context into the headers.
      // The first argument should be the active context.
      propagation.inject(context.active(), headers, setter);

      // Re-assign the (potentially modified) headers back to the data payload if it's an object.
      if (typeof newData === 'object' && newData !== null) {
        (newData as { headers?: NatsHeaderCarrier }).headers = headers;
      }

      const resultObservable = superMethod(
        pattern,
        newData,
      ) as Observable<TResult>;
      // make sure span will be ended
      return resultObservable.pipe(
        finalize(() => {
          span.end();
        }),
      );
    });
  }
}
