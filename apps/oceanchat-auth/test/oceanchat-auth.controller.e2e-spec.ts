import { ClientProxy, ClientsModule, Transport } from '@nestjs/microservices';
import { Test, TestingModule } from '@nestjs/testing';
import { connect, connection } from 'mongoose';
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
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
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

    await connect('mongodb://localhost:27017/oceanchat_test');
  });

  afterAll(async () => {
    await client.close();
    await connection.close();
  });

  describe("MessagePattern 'auth.login'", () => {
    beforeEach(async () => {
      await firstValueFrom(client.send('auth.register', testUser));
    });

    afterEach(async () => {
      await connection.collection('users').deleteMany({});
    });

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
