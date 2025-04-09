import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { ObjectId } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { User, UserSchema } from '../src/entities/user.entity';
import { UserRepository } from '../src/repositories/user.repository';

describe('test users model', () => {
  let userRepo: UserRepository;

  let mongod: MongoMemoryServer;

  let moduleRef: TestingModule;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();

    moduleRef = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(uri, { dbName: 'test' }),
        MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
      ],
      providers: [UserRepository],
    }).compile();

    userRepo = moduleRef.get<UserRepository>(UserRepository);
  });

  afterAll(async () => {
    if (moduleRef) {
      await moduleRef.close();
    }

    if (mongod) {
      await mongod.stop();
    }
  });

  // test create user
  describe('create', () => {
    it('should create a user', async () => {
      const user = {
        username: 'testuser',
        credentials: { passwordHash: 'hashedpassword', salt: 'salt' },
      };
      const createdUser = await userRepo.create(user);
      expect(createdUser.username).toBe('testuser');
      expect(createdUser._id).toBeDefined();
    });
  });

  describe('findByUserId', () => {
    it('should find a user by id', async () => {
      const createdUser = await userRepo.create({
        username: 'testfinduser',
        credentials: { passwordHash: 'hashedpassword' },
      });

      const findUser = await userRepo.findById(createdUser._id);
      expect(findUser).toBeDefined();
      expect(findUser?.username).toBe('testfinduser');
      expect(findUser?._id).toBeDefined();
    });

    it('should return null if user is not found', async () => {
      const nonExistentUser = await userRepo.findById(
        new ObjectId('67f628c699b7bd7708c21e28'),
      );
      expect(nonExistentUser).toBeNull();
    });
  });

  describe('update', () => {
    it('should update a user', async () => {
      const createdUser = await userRepo.create({
        username: 'testupdateuser',
        credentials: { passwordHash: 'hashedpassword' },
      });
      const updatedUser = await userRepo.update(createdUser._id, {
        username: 'updateduser',
      });
      expect(updatedUser?.username).toBe('updateduser');
    });

    it('should return null if user is not found', async () => {
      const updatedUser = await userRepo.update(
        new ObjectId('67f628c699b7bd7708c21e29'),
        {
          username: 'updateduser',
        },
      );
      expect(updatedUser).toBeNull();
    });

    describe('delete', () => {
      it('should delete a user', async () => {
        const createdUser = await userRepo.create({
          username: 'testdeleteuser',
          credentials: { passwordHash: 'hashedpassword' },
        });
        const result = await userRepo.delete(createdUser._id);
        expect(result).toBe(true);
        const foundUser = await userRepo.findById(createdUser._id);
        expect(foundUser).toBeNull();
      });
      it('should return false if user is not found', async () => {
        const result = await userRepo.delete(
          new ObjectId('67f628c699b7bd7708c21e29'),
        );
        expect(result).toBe(false);
      });
    });
  });
});
