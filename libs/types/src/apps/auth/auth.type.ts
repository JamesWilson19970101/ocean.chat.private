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

/**
 * Result returned when the login request is successful.
 */
export type LoginResult = {
  accessToken: string;
  refreshToken: string;
  user: Pick<User, 'username' | '_id'>;
};

/**
 * Result returned when the refresh token request is successful.
 */
export type RefreshTokenResult = {
  accessToken: string;
  refreshToken: string;
};
