import { ClientProxy, ClientsModule, Transport } from '@nestjs/microservices';
import { Test, TestingModule } from '@nestjs/testing';
import { firstValueFrom } from 'rxjs';

const AUTH_CLIENT = 'AUTH_CLIENT';

describe('OceanchatAuthController (e2e)', () => {
  let client: ClientProxy;

  const testUser = {
    username: 'james',
    password: 'James123456',
    confirmPassword: 'James123456',
  };

  beforeAll(async () => {
    // 这个测试模块现在非常小，只包含客户端和数据库连接
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        // 1. 注册 NATS 客户端
        ClientsModule.register([
          {
            name: AUTH_CLIENT,
            transport: Transport.NATS,
            options: {
              servers: [process.env.NATS_URL || 'nats://localhost:4222'],
            },
          },
        ]),
      ],
    }).compile();

    client = moduleFixture.get<ClientProxy>(AUTH_CLIENT);
    await client.connect();
  });

  afterAll(async () => {
    await client.close();
  });

  describe("MessagePattern 'auth.login'", () => {
    // beforeEach(async () => {
    //   await firstValueFrom(client.send('auth.register', testUser));
    // });

    it('should throw an RpcException with wrong password', async () => {
      const payload = {
        username: testUser.username,
        password: 'WrongPassword',
      };

      const response = await firstValueFrom(client.send('auth.login', payload));

      // The error from BaseRpcException is nested inside the 'error' property.
      expect(response).toHaveProperty('error');
      // The error message from the microservice is a JSON string, so we need to parse it.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
      const errorDetails = JSON.parse(response.error.message);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(errorDetails.message).toBe('Invalid credentials');
    });
  });
});
