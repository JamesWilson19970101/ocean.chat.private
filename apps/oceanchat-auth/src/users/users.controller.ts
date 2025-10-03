import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { CreateUserDto } from './dto/create-user.dto';
import { UsersService } from './users.service';

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * NATS message handler for user registration.
   * @param createUserDto - The data transfer object containing user creation info.
   * @returns The created user object (partial).
   */
  @MessagePattern('auth.register')
  async register(@Payload() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }
}
