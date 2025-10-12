import { User } from '@ocean.chat/models';

/**
 * Represents the data structure for a user object after successful authentication.
 * It's a subset of the main User entity.
 */
export type AuthenticatedUser = Pick<User, '_id' | 'username'> & {
  sub: string;
};

/**
 * A legacy type used to mimic an HTTP request for passport-local strategy.
 */
export type RequestLike = { body: { username: string; password: string } };
