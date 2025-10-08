import { INestMicroservice } from '@nestjs/common';
import { ClientProxy, ClientsModule, Transport } from '@nestjs/microservices';
import { Test, TestingModule } from '@nestjs/testing';
import { firstValueFrom } from 'rxjs';

import { CreateUserDto } from '../../src/users/dto/create-user.dto';
import { UsersController } from '../../src/users/users.controller';
import { UsersService } from '../../src/users/users.service';

describe('UsersController (e2e)', () => {
  let app: INestMicroservice;
  let client: ClientProxy;

  // Mock UsersService to avoid database connections in this test
  const mockUsersService = {
    create: jest.fn(),
  };

  // Runs once before all tests
  beforeAll(async () => {
    // 1. Create the NestJS testing module
    const moduleFixture: TestingModule = await Test.createTestingModule({
      // Import the client module to create a test client
      imports: [
        ClientsModule.register([
          {
            name: 'AUTH_SERVICE_CLIENT', // A unique name for the client
            transport: Transport.NATS,
            options: {
              servers: ['nats://localhost:4222'], // NATS server for the test
            },
          },
        ]),
      ],
      controllers: [UsersController],
      providers: [
        // Provide the mock service instead of the real one
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    // 2. Create and start the microservice application
    app = moduleFixture.createNestMicroservice({
      transport: Transport.NATS,
      options: {
        servers: ['nats://localhost:4222'],
      },
    });
    await app.listen(); // Start listening for messages

    // 3. Get the client instance from the application context
    client = app.get('AUTH_SERVICE_CLIENT');
    await client.connect(); // Connect the client to the NATS server
  });

  // Runs once after all tests
  afterAll(async () => {
    await client.close();
    await app.close();
  });

  // Reset mocks before each test
  beforeEach(() => {
    mockUsersService.create.mockClear();
  });

  // The actual test case
  it("should handle 'auth.register' message and create a user", async () => {
    // Arrange: Prepare the input data and the expected mock response
    const createUserDto: CreateUserDto = {
      username: 'testuser',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    };

    const expectedUser = {
      _id: 'some-id',
      username: 'testuser',
    };

    // Tell the mock service what to return when `create` is called
    mockUsersService.create.mockResolvedValue(expectedUser);

    // Act: Send the message to the 'auth.register' pattern and wait for the response
    const result = await firstValueFrom(
      client.send('auth.register', createUserDto),
    );

    // Assert: Check if the response and service calls are correct
    expect(result).toEqual(expectedUser);
    expect(mockUsersService.create).toHaveBeenCalledWith(createUserDto);
  });
});
