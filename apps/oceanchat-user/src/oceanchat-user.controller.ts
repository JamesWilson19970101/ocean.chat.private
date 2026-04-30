import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AuthProvider } from '@ocean.chat/models';
import { CreateUserDto, ValidatePasswordDto } from '@ocean.chat/types';

import { OceanchatUserService } from './oceanchat-user.service';

@Controller()
export class OceanchatUserController {
  constructor(private readonly oceanchatUserService: OceanchatUserService) {}

  /**
   * Handles RPC requests for user creation (registration).
   * @param createUserDto - The data transfer object containing user creation info.
   * @returns The created user object (partial, without sensitive data).
   */
  @MessagePattern('user.create')
  async create(@Payload() createUserDto: CreateUserDto) {
    return this.oceanchatUserService.create(createUserDto);
  }

  /**
   * Handles RPC requests to fetch a user's public profile by their ID.
   * This is typically called by the API Gateway to assemble the 'me' object.
   * @param id - The user's unique identifier (_id).
   * @returns The user object (partial, without sensitive data), or null if not found.
   */
  @MessagePattern('user.query.profile')
  async findOneById(@Payload('userId') id: string) {
    return this.oceanchatUserService.findOneById(id);
  }

  /**
   * Handles RPC requests to find a user by username and provider.
   * This is primarily used internally by the auth-service during the login process
   * to retrieve user details, including the password hash for verification.
   * @param username - The username to search for.
   * @param provider - The authentication provider (e.g., 'local'). Defaults to LOCAL.
   * @returns The full user object including sensitive fields for internal processing, or null if not found.
   */
  @MessagePattern('user.query.byUsername')
  async findByUsername(
    @Payload('username') username: string,
    @Payload('provider') provider: AuthProvider = AuthProvider.LOCAL,
  ) {
    return this.oceanchatUserService.findOneByUsernameAndProvider(
      username,
      provider,
    );
  }

  /**
   * Handles RPC requests to validate a user's credentials.
   * @param payload - An object containing the username and password.
   * @returns A partial user object if credentials are valid, otherwise null.
   */
  @MessagePattern('user.validate.password')
  async validatePassword(@Payload() payload: ValidatePasswordDto) {
    const { username, password } = payload;
    return await this.oceanchatUserService.validatePassword(username, password);
  }
}
