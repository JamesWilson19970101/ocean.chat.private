import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '@ocean.chat/models';
import { AuthenticatedUser } from '@ocean.chat/types';
/**
 * Custom parameter decorator to extract the user object that was manually
 * attached to the RPC context by a guard.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Partial<User> => {
    const rpcUser = context.switchToRpc().getData<AuthenticatedUser>();
    return { username: rpcUser.username, _id: rpcUser._id };
  },
);

export const validateUser = createParamDecorator(
  (
    _data: unknown,
    context: ExecutionContext,
  ): { username: string; sub: string } => {
    const rpcData = context.switchToRpc().getData();

    const rpcUser = (
      rpcData as {
        user: { username: string; sub: string } & Record<string, unknown>;
      }
    ).user;
    return { username: rpcUser.username, sub: rpcUser.sub }; // if code runs here, sub and username must exist
  },
);
