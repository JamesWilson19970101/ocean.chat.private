/**
 * @fileoverview
 * User Role Provider (Data Provider)
 *
 * This service is responsible for answering: "What roles does this user have?"
 *
 * It is a critical part of the authorization system and is designed for a distributed,
 * high-concurrency environment. Its key responsibilities are:
 *
 * 1. Differentiate between GLOBAL roles ('admin') and SCOPED roles ('owner' in room '123').
 * 2. Use a centralized Redis cache for both global and scoped roles to ensure data consistency across all microservice instances.
 * 3. Fetch data from two different microservices (`oceanchat-user` for global, `oceanchat-group` for scoped).
 * 4. Implement distributed locking (via RedisService.getOrSet) to prevent cache stampedes during cache misses.
 * 5. Listen to NATS events (`auth.role.changed`) to invalidate cache entries when roles are modified.
 */
import { Injectable } from '@nestjs/common';
@Injectable()
export class UserRoleProvider {
  // Cache for GLOBAL roles (e.g., 'admin', 'user')
  // Key: userId
}
