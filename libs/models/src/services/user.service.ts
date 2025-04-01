import { Injectable } from '@nestjs/common';

import { User } from '../entities/user.entity';
import { UserRepository } from '../repositories/user.repository';

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  // async findAll(): Promise<User[]> {
  //   return this.userRepository.find();
  // }

  async findById(id: string): Promise<User | null> {
    return await this.userRepository.findById(id);
  }

  // async create(user: Partial<User>): Promise<User> {
  //   return this.userRepository.create(user);
  // }

  async update(id: string, user: Partial<User>): Promise<User | null> {
    return this.userRepository.update(id, user);
  }

  async delete(id: string): Promise<boolean> {
    return this.userRepository.delete(id);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findByEmail(email);
  }

  // async initUsers(): Promise<void> {
  //   const users = await this.findAll();
  //   if (users.length === 0) {
  //     await this.create({ name: 'user1', email: 'user1@example.com' });
  //     await this.create({ name: 'user2', email: 'user2@example.com' });
  //     console.log('Initialized users data.');
  //   }
  // }
}
