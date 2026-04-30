import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { I18nService } from '@ocean.chat/i18n';
import { IAuthenticatedRequest } from '@ocean.chat/types';
import { AuthenticatedUser } from '@ocean.chat/types';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { PERMISSIONS_METADATA_KEY } from '../constants/metadata-keys';
import { PermissionIdType } from '../constants/permission-ids';
import { PermissionCheckerService } from '../logic/permission-checker.service';

/**
 * @fileoverview
 * Universal Permission Guard.
 *
 * This guard intercepts requests (both HTTP and RPC/NATS) to enforce permission requirements.
 * It automatically extracts:
 * 1. Required Permissions (from @RequirePermission decorator)
 * TODO: The rpc data structure has not yet been tested. We assume the following code is correct, but it will need to be tested later.
 * 2. User ID (from request.user or payload.userId)
 * 3. Scope ID (e.g., roomId) (from params/body/query)
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionChecker: PermissionCheckerService,
    // Inject I18nService for user-friendly error messages
    private readonly i18nService: I18nService,
    // Inject PinoLogger for structured logging
    @InjectPinoLogger('oceanchat.auth.users.service')
    private readonly logger: PinoLogger,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Read metadata from Handler (Method) first, then Class (Controller)
    const requiredPermissions = this.reflector.getAllAndOverride<
      PermissionIdType[]
    >(PERMISSIONS_METADATA_KEY, [context.getHandler(), context.getClass()]);

    // If no permissions are required, allow access
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    // Extract Context (User and Scope)
    const { userId, scopeId } = this.extractContext(context);

    if (!userId) {
      this.logger.warn(
        this.i18nService.translate('PERMISSION_GUARD_NO_USER_ID_IN_CONTEXT'),
      );
      return false;
    }

    const hasAccess = await this.permissionChecker.hasAllPermissions(
      userId,
      requiredPermissions,
      scopeId,
    );

    if (!hasAccess) {
      this.logger.debug(
        this.i18nService.translate('PERMISSION_GUARD_ACCESS_DENIED', {
          userId,
          className: context.getClass().name,
          handlerName: context.getHandler().name,
          permissions: requiredPermissions.join(', '),
        }),
      );
    }

    return hasAccess;
  }

  private extractContext(context: ExecutionContext) {
    let userId: string | null = null;
    let requestData: Record<string, any> & { rid?: string } = {};
    // --- Handle HTTP Requests (api-gateway) ---
    if (context.getType() === 'http') {
      const req = context.switchToHttp().getRequest<IAuthenticatedRequest>();
      // Assuming previous AuthGuard populated req.user
      userId = req.user.sub || null;

      // Aggregate all possible sources for parameters
      requestData = { ...req.query, ...req.params, ...req.body };
    } else if (context.getType() === 'rpc') {
      const data = context.switchToRpc().getData<AuthenticatedUser>();
      userId = data.sub || (data._id as string);
      requestData = data || {};
    }

    const scopeId = requestData.rid || undefined;

    return { userId, scopeId };
  }
}
