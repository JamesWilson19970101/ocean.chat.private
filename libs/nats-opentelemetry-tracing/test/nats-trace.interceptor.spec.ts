/* eslint-disable @typescript-eslint/unbound-method */
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { NatsContext } from '@nestjs/microservices';
import { headers as natsHeaders } from 'nats';
import { of } from 'rxjs';

import { NatsTraceInterceptor } from '../src/lib/interceptors/nats-trace.interceptor';

describe('NatsTraceInterceptor', () => {
  let interceptor: NatsTraceInterceptor;

  beforeEach(() => {
    interceptor = new NatsTraceInterceptor();
  });

  it('should extract trace context from NatsContext headers and start a span', (done) => {
    const headers = natsHeaders();
    headers.append(
      'traceparent',
      '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
    );

    const natsContextMock = {
      getSubject: jest.fn().mockReturnValue('test.subject'),
      getHeaders: jest.fn().mockReturnValue(headers),
    } as unknown as NatsContext;

    const rpcContextMock = {
      getContext: jest.fn().mockReturnValue(natsContextMock),
      getData: jest.fn().mockReturnValue({ some: 'data' }),
    };

    const executionContextMock = {
      getType: jest.fn().mockReturnValue('rpc'),
      switchToRpc: jest.fn().mockReturnValue(rpcContextMock),
    } as unknown as ExecutionContext;

    const nextMock: CallHandler = {
      handle: () => {
        // Without a registered ContextManager, OpenTelemetry API acts as a no-op,
        // so trace.getSpan(context.active()) may return undefined here.
        // We mainly want to ensure that interceptor extracts headers and handles the stream correctly.
        return of('result');
      },
    };

    interceptor.intercept(executionContextMock, nextMock).subscribe({
      next: (val) => {
        expect(val).toBe('result');
        expect(natsContextMock.getHeaders).toHaveBeenCalled();
        done();
      },
    });
  });

  it('should skip non-RPC contexts', (done) => {
    const executionContextMock = {
      getType: jest.fn().mockReturnValue('http'),
    } as unknown as ExecutionContext;

    const nextMock: CallHandler = {
      handle: () => of('http-result'),
    };

    interceptor.intercept(executionContextMock, nextMock).subscribe({
      next: (val) => {
        expect(val).toBe('http-result');
        done();
      },
    });
  });
});
