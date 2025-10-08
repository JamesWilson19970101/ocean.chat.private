import { Test, TestingModule } from '@nestjs/testing';
import { User } from '@ocean.chat/models';

import { CreateUserDto } from '../../src/users/dto/create-user.dto';
import { UsersController } from '../../src/users/users.controller';
import { UsersService } from '../../src/users/users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: jest.Mocked<UsersService>;

  const mockCreateUserDto: CreateUserDto = {
    username: 'testuser',
    password: 'Password123!',
    confirmPassword: 'Password123!',
  };

  const mockUser: Partial<User> = {
    _id: 'some-id',
    username: 'testuser',
    name: 'testuser',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get(UsersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should call usersService.create with the payload and return the result', async () => {
      const createSpy = jest
        .spyOn(usersService, 'create')
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        .mockResolvedValue(mockUser as any);

      const result = await controller.register(mockCreateUserDto);

      expect(createSpy).toHaveBeenCalledWith(mockCreateUserDto);
      expect(result).toEqual(mockUser);
    });
  });
});
