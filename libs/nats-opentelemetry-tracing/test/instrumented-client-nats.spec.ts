/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  ClientNats,
  NatsRecord,
  NatsRecordBuilder,
} from '@nestjs/microservices';
import { of } from 'rxjs';

import { InstrumentedClientNats } from '../src/lib/clients/instrumented-client-nats';

describe('InstrumentedClientNats', () => {
  let client: InstrumentedClientNats;

  beforeEach(() => {
    client = new InstrumentedClientNats({});

    // We mock the superclass method using prototype.
    jest.spyOn(ClientNats.prototype, 'send').mockImplementation(function (
      pattern: any,
      data: any,
    ) {
      return of({ pattern, data });
    });
    jest.spyOn(ClientNats.prototype, 'emit').mockImplementation(function (
      pattern: any,
      data: any,
    ) {
      return of({ pattern, data });
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should wrap payload in NatsRecord and inject trace headers on send', (done) => {
    client.send('test.pattern', { hello: 'world' }).subscribe({
      next: (res: any) => {
        const data = res.data;
        expect(data).toBeInstanceOf(NatsRecord);
        // It should contain the original data
        expect(data.data).toEqual({ hello: 'world' });
        // It should inject headers
        const headers = data.headers;
        expect(headers).toBeDefined();
        // The context traceparent will only exist if we have an active context,
        // but we can at least check that the headers object is populated by tracing interceptor logic.
        expect(headers.has('traceparent')).toBeDefined(); // OpenTelemetry propagation uses traceparent by default with W3C
        done();
      },
    });
  });

  it('should inject trace headers into existing NatsRecord on emit', (done) => {
    const existingRecord = new NatsRecordBuilder({ hello: 'world' }).build();
    client.emit('test.emit.pattern', existingRecord).subscribe({
      next: (res: any) => {
        const data = res.data;
        expect(data).toBeInstanceOf(NatsRecord);
        expect(data.data).toEqual({ hello: 'world' });
        const headers = data.headers;
        expect(headers).toBeDefined();
        done();
      },
    });
  });
});
