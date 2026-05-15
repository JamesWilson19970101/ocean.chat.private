import {
  ClientNats,
  NatsOptions,
  NatsRecord,
  NatsRecordBuilder,
} from '@nestjs/microservices';
import {
  context,
  propagation,
  SpanKind,
  TextMapSetter,
  trace,
} from '@opentelemetry/api';
import { headers as natsHeaders, MsgHdrs } from 'nats';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { attr } from '../interceptors/nats-trace.interceptor';

class NatsHeaderSetter implements TextMapSetter<MsgHdrs> {
  set(carrier: MsgHdrs, key: string, value: string): void {
    carrier.append(key, value);
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
      let record: NatsRecord;

      if (data instanceof NatsRecord) {
        // Data is already a NatsRecord. We should inject headers into its existing headers.
        const currentHeaders = data.headers || natsHeaders();
        propagation.inject(context.active(), currentHeaders, setter);
        // Build a new record with the injected headers
        record = new NatsRecordBuilder(data.data)
          .setHeaders(currentHeaders)
          .build();
      } else {
        // Data is not a NatsRecord. We create one.
        const currentHeaders = natsHeaders();
        propagation.inject(context.active(), currentHeaders, setter);
        record = new NatsRecordBuilder(data).setHeaders(currentHeaders).build();
      }

      const resultObservable = superMethod(
        pattern,
        record as unknown as TInput,
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
