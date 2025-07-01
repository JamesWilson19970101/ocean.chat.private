import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Db, MongoClient, MongoClientOptions } from 'mongodb';

import { DatabaseService } from '../../src/mongo/mongo.service';
import { UserRepository } from '../../src/repositories/user.repository';

const mockConnect = jest.fn();
const mockClose = jest.fn();
const mockDb = jest.fn();

jest.mock('mongodb', (): any => {
  const actualMongo = jest.requireActual('mongodb');
  return {
    ...actualMongo,
    MongoClient: jest.fn().mockImplementation(() => ({
      connect: mockConnect,
      close: mockClose,
      db: mockDb,
    })),
  };
});

describe('DatabaseService', () => {
  let service: DatabaseService;
  let configService: ConfigService;
  let userRepository: UserRepository;
  let mockConsoleError: jest.SpyInstance;

  beforeEach(async () => {
    mockConsoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatabaseService,
        {
          provide: UserRepository,
          useValue: {
            getCollectionName: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DatabaseService>(DatabaseService);
    configService = module.get<ConfigService>(ConfigService);
    userRepository = module.get<UserRepository>(UserRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('connectDb', () => {
    const mockUri = 'mongodb://127.0.0.1:27017/oceanchat_development';

    it('should connect to the database successfully', async () => {
      jest.spyOn(configService, 'get').mockReturnValue(mockUri);
      const mockMongoClientInstance = {} as MongoClient;
      mockConnect.mockResolvedValue(mockMongoClientInstance);

      const client = await service.connectDb();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(configService.get).toHaveBeenCalledWith('database.uri');
      expect(MongoClient).toHaveBeenCalledWith(mockUri, undefined);
      expect(mockConnect).toHaveBeenCalled();
      expect(client).toBe(mockMongoClientInstance);
      expect(mockConsoleError).not.toHaveBeenCalled();
    });

    it('should throw an error if connection fails', async () => {
      jest.spyOn(configService, 'get').mockReturnValue(mockUri);
      const connectionError = new Error('Connection failed');
      mockConnect.mockRejectedValue(connectionError);

      await expect(service.connectDb()).rejects.toThrow(connectionError);
      expect(mockConsoleError).toHaveBeenCalledWith(connectionError);
    });

    it('should pass options to MongoClient if provided', async () => {
      jest.spyOn(configService, 'get').mockReturnValue(mockUri);

      mockConnect.mockResolvedValue({} as MongoClient);

      const options: MongoClientOptions = { appName: 'TestApp' };
      await service.connectDb(options);
      expect(MongoClient).toHaveBeenCalledWith(mockUri, options);
    });
  });

  describe('getWatchCollectionNames', () => {
    it('should return the collection name from UserRepository', () => {
      const collectionName = 'users';
      (userRepository.getCollectionName as jest.Mock).mockReturnValue(
        collectionName,
      );

      const result = service.getWatchCollectionNames();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(userRepository.getCollectionName).toHaveBeenCalled();
      expect(result).toEqual([collectionName]);
    });
  });

  describe('getConnection', () => {
    const mockUri = 'mongodb://localhost:27017/testdb';
    const mockDbInstance = { databaseName: 'testdb' } as Db;
    const mockMongoClientInstance = {
      db: jest.fn().mockReturnValue(mockDbInstance),
    } as unknown as MongoClient;

    beforeEach(() => {
      jest.spyOn(configService, 'get').mockReturnValue(mockUri);
      // Reset the service instance state before each test
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      (service as any).clientPromise = null;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      (service as any).dbInstance = undefined;

      mockDb.mockReturnValue(mockDbInstance);
    });

    it('should establish a connection on the first call and return a Db instance', async () => {
      mockConnect.mockResolvedValue(mockMongoClientInstance);

      const db = await service.getConnection();

      expect(db).toBe(mockDbInstance);
      expect(mockConnect).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockMongoClientInstance.db).toHaveBeenCalledTimes(1);
    });

    it('should return the cached connection on subsequent calls', async () => {
      mockConnect.mockResolvedValue(mockMongoClientInstance);

      const db1 = await service.getConnection();
      const db2 = await service.getConnection();

      expect(db1).toBe(mockDbInstance);
      expect(db2).toBe(mockDbInstance);
      expect(mockConnect).toHaveBeenCalledTimes(1); // Crucial check for singleton
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockMongoClientInstance.db).toHaveBeenCalledTimes(1);
    });

    it('should handle concurrent calls by connecting only once', async () => {
      mockConnect.mockResolvedValue(mockMongoClientInstance);

      const [db1, db2, db3] = await Promise.all([
        service.getConnection(),
        service.getConnection(),
        service.getConnection(),
      ]);

      expect(db1).toBe(db2);
      expect(db2).toBe(db3);
      expect(mockConnect).toHaveBeenCalledTimes(1);
    });

    it('should propagate connection errors', async () => {
      const connectionError = new Error('Connection failed');
      mockConnect.mockRejectedValue(connectionError);

      await expect(service.getConnection()).rejects.toThrow(connectionError);
      expect(mockConsoleError).toHaveBeenCalledWith(connectionError);
    });

    it('should allow retrying connection after a failure', async () => {
      const connectionError = new Error('Connection failed');
      // First call fails
      mockConnect.mockRejectedValueOnce(connectionError);
      await expect(service.getConnection()).rejects.toThrow(connectionError);
      expect(mockConnect).toHaveBeenCalledTimes(1);

      // Second call succeeds
      mockConnect.mockResolvedValue(mockMongoClientInstance);
      const db = await service.getConnection();

      expect(db).toBe(mockDbInstance);
      expect(mockConnect).toHaveBeenCalledTimes(2); // Connection was retried
    });
  });
});
