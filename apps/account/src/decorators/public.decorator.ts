import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key used to identify public routes/handlers.
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Decorator factory that marks a route handler or controller as public.
 * Public routes bypass the global authentication guard (e.g., AuthGuard).
 *
 * @example
 * ```ts
 * @Public()
 * @Get('/public-route')
 * getPublicData() {
 * // This route can be accessed without authentication.
 * }
 * ```
 *
 * @returns A decorator function produced by SetMetadata.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
