import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { User } from '@ocean.chat/models';

import { OceanchatAuthService } from '../src/oceanchat-auth.service';
import { UsersService } from '../src/users/users.service';

describe('OceanchatAuthService', () => {
  let service: OceanchatAuthService;
  let jwtService: jest.Mocked<JwtService>;

  const mockUser: Pick<User, '_id' | 'username'> = {
    _id: 'user-id-123',
    username: 'testuser',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OceanchatAuthService,
        {
          provide: UsersService,
          useValue: {},
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn(),
            verifyAsync: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OceanchatAuthService>(OceanchatAuthService);
    jwtService = module.get(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('should generate an access token and return it with the user', async () => {
      const mockToken = 'mock.jwt.token';
      const expectedPayload = {
        sub: mockUser._id,
        username: mockUser.username,
      };

      // Arrange
      const signAsyncSpy = jest
        .spyOn(jwtService, 'signAsync')
        .mockResolvedValue(mockToken);

      // Act
      const result = await service.login(mockUser);

      // Assert
      expect(signAsyncSpy).toHaveBeenCalledWith(expectedPayload);
      // Assert
      expect(result).toEqual({
        accessToken: mockToken,
        user: mockUser,
      });
    });
  });

  describe('validateToken', () => {
    it('should return the payload for a valid token', async () => {
      const mockToken = 'valid.jwt.token';
      const mockPayload = { sub: mockUser._id, username: mockUser.username };

      // Arrange
      const verifyAsyncSpy = jest
        .spyOn(jwtService, 'verifyAsync')
        .mockResolvedValue(mockPayload);

      // Act
      const result = await service.validateToken(mockToken);

      // Assert
      expect(result).toEqual(mockPayload);
      expect(verifyAsyncSpy).toHaveBeenCalledWith(mockToken);
    });

    it('should return null for an invalid or expired token', async () => {
      // Arrange
      jwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));

      // Act & Assert
      await expect(service.validateToken('invalid.token')).resolves.toBeNull();
    });
  });
});
