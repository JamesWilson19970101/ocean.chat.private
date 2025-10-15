import { startTracing } from '@ocean.chat/tracing';
startTracing({ name: 'oceanchat-router-client' });
import {
  ClientGrpc,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { join } from 'path';
import { firstValueFrom, Observable } from 'rxjs';

interface OceanchatRouterClient {
  getHello(request: object): Observable<{ message: string }>;
}

describe('OceanchatRouter (e2e)', () => {
  let client: ClientGrpc;
  let service: OceanchatRouterClient;

  beforeAll(() => {
    client = ClientProxyFactory.create({
      transport: Transport.GRPC,
      options: {
        package: 'oceanchat_router',
        protoPath: join(
          __dirname,
          '../src/oceanchat_router_assets/oceanchat-router.proto',
        ),
        url: '0.0.0.0:50051',
      },
    });

    service = client.getService<OceanchatRouterClient>('OceanchatRouter');
  });

  it('should call GetHello and return "Hello World!"', async () => {
    const response = await firstValueFrom(service.getHello({}));
    expect(response).toEqual({ message: 'Hello World!' });
  });
});
