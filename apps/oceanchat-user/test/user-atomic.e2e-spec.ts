/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import { OceanchatUserService } from '../src/oceanchat-user.service';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import {
  User,
  OceanModel,
  UserRepository,
  Permission,
} from '@ocean.chat/models';
import { SettingsService } from '@ocean.chat/settings';
import { PasswordService } from '../src/password.service';
import { I18nService } from '@ocean.chat/i18n';
import { PinoLogger } from 'nestjs-pino';
import { connect, connection, Model, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { ErrorCodes } from '@ocean.chat/common-exceptions';

/**
 * @file User Atomic & Concurrency E2E Test Suite
 *
 * Focus: MongoDB Atomic Operations & Distributed Consistency.
 * This suite ensures that high-concurrency events (like logins from multiple devices)
 * do not cause data loss in the user's document, and that registration conflicts
 * are handled gracefully by the database.
 *
 * Rules:
 * - Real MongoDB: Critical for verifying $cond/$map atomic logic.
 * - Concurrency: Uses Promise.all to stress the update logic.
 */
describe('User Data Atomic Operations (Real MongoDB E2E)', () => {
  let service: OceanchatUserService;
  let userModel: Model<User>;

  const MONGO_URI = 'mongodb://localhost:27017/oceanchat_test';

  beforeAll(async () => {
    await connect(MONGO_URI);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OceanchatUserService,
        {
          provide: UserRepository,
          useValue: {
            updateOne: (filter: any, update: any) => userModel.updateOne(filter, update),
            create: (data: any) => {
              if (!data._id) {
                data._id = uuidv4();
              }
              return userModel.create(data);
            },
          },
        },
        {
          provide: PasswordService,
          useValue: { hash: jest.fn().mockResolvedValue('hashed-pass') },
        },
        {
          provide: SettingsService,
          useValue: { 
            getSettingValue: jest.fn().mockImplementation((key) => {
              const defaultSettings: Record<string, any> = {
                Accounts_Username_MinLength: 3,
                Accounts_Username_MaxLength: 20,
                Accounts_Username_Regex: '^[a-zA-Z0-9_.]+$',
                Accounts_Password_MinLength: 8,
                Accounts_Password_RequireDigit: true,
                Accounts_Password_RequireLowercase: true,
                Accounts_Password_RequireUppercase: true,
                Accounts_Password_RequireSpecialChar: true,
              };
              return Promise.resolve(defaultSettings[key]);
            })
          },
        },
        {
          provide: I18nService,
          useValue: { translate: (key: string) => key },
        },
        {
          provide: 'PinoLogger:ocean.chat.user.service',
          useValue: {
            info: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
            warn: jest.fn(),
          },
        },
        {
          provide: getModelToken(User.name),
          useFactory: () =>
            connection.model(
              User.name,
              (User as any).schema ||
                new Schema({ _id: String }, { strict: false }),
            ),
        },
        {
          provide: getModelToken(Permission.name),
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<OceanchatUserService>(OceanchatUserService);
    userModel = module.get<Model<User>>(getModelToken(User.name));
  });

  afterAll(async () => {
    await connection.close();
  });

  beforeEach(async () => {
    // Cleanup users collection before each test to ensure isolation.
    await userModel.deleteMany({});
  });

  /**
   * Test: Concurrent Device Addition
   * Scenario: A user logs in from 10 different devices at the exact same time.
   * Logic: The service uses a complex Mongoose update with $concatArrays.
   * Expectation: ALL 10 devices should be present in the document. No "Lost Updates".
   */
  it('should atomically add 10 unique devices without data loss during high concurrency', async () => {
    const userId = uuidv4();
    // Pre-create the user document
    await userModel.create({
      _id: userId,
      username: 'concurrency_guy',
      devices: [],
    });

    // Create 10 unique device IDs
    const deviceIds = Array.from({ length: 10 }).map((_, i) => `device-${i}`);

    // Act: Fire 10 concurrent addDevice calls
    await Promise.all(
      deviceIds.map((deviceId) => service.addDevice(userId, deviceId)),
    );

    // Assert: Verify total device count in MongoDB
    const updatedUser = await userModel.findById(userId).lean();
    expect(updatedUser?.devices).toHaveLength(10);

    // Ensure all device IDs are present
    const savedDeviceIds = updatedUser?.devices?.map((d: any) => d.deviceId);
    expect(savedDeviceIds).toEqual(expect.arrayContaining(deviceIds));
  });

  /**
   * Test: Device LastLogin Update
   * Scenario: Same device logs in multiple times concurrently.
   * Expectation: The device entry should be updated (LastLogin), not duplicated.
   */
  it('should update existing device lastLogin instead of duplicating the entry', async () => {
    const userId = uuidv4();
    const deviceId = 'shared-tablet';

    await userModel.create({
      _id: userId,
      username: 'multi_login_user',
      devices: [{ deviceId, lastLogin: new Date(0) }],
    });

    // Act: Fire 5 concurrent logins for the same device
    const now = new Date();
    await Promise.all(
      Array.from({ length: 5 }).map(() =>
        service.addDevice(userId, deviceId, now),
      ),
    );

    // Assert: Still only 1 device in the array
    const updatedUser = await userModel.findById(userId).lean();
    expect(updatedUser?.devices).toHaveLength(1);
    expect(updatedUser?.devices?.[0]?.lastLogin?.getTime()).toBe(now.getTime());
  });

  /**
   * Test: Registration Conflict (Race Condition)
   * Scenario: Two users try to register with the same username at the same time.
   * Expectation: MongoDB unique index triggers, and service converts it to DomainException(409).
   */
  it('should correctly handle concurrent registration for the same username', async () => {
    const createUserDto = {
      username: 'unique_runner',
      password: 'StrongPassword123!',
      confirmPassword: 'StrongPassword123!',
    };

    // Act: Fire 2 identical registration attempts
    const results = await Promise.allSettled([
      service.create(createUserDto),
      service.create(createUserDto),
    ]);

    const successful = results.filter(r => r.status === 'fulfilled');
    const failed = results.filter(r => r.status === 'rejected');

    if (successful.length === 0) {
      console.error('All registration attempts failed. Reasons:', failed.map(f => (f as PromiseRejectedResult).reason));
    }

    // Assert: Exactly one succeeds
    expect(successful.length).toBe(1);
    expect(failed.length).toBe(1);

    // Loser should get the "Already Exists" domain error
    const error = (failed[0] as PromiseRejectedResult).reason;
    expect(error.errorCode).toBe(ErrorCodes.USERNAME_ALREADY_EXISTS);
  });
});
