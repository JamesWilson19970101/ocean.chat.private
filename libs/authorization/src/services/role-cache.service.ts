import { HttpStatus, Injectable, Optional } from '@nestjs/common';
import { BaseRpcException, ErrorCodes } from '@ocean.chat/common-exceptions';
import { I18nService } from '@ocean.chat/i18n';
import { RedisService } from '@ocean.chat/redis';
import { IRoleDataSource } from '@ocean.chat/types';

const CACHE_KEY_PREFIX = 'auth:';
const L2_CACHE_TTL_SEC = 3600; // 1 Hour Redis cache
// --- Critical Configuration ---
// The L1 memory cache only lives for 10 seconds.
// This means that after a permission change, there will be a 10-second delay in the worst case.
// But this avoids complex broadcast communication logic (assuming the service is deployed on 10 pods, it is necessary to ensure that each of these 10 pods is broadcast to the message; only in this way can the L1 cache maintained in each pod be invalidated).
const L1_CACHE_TTL_MS = 10 * 1000; // 10 Seconds memory cache
const L1_MAX_SIZE = 10000; // Max 5000 items per instance to prevent OOM

/**
 * A simplified LRU (Least Recently Used) Cache to prevent memory leaks.
 * Wraps a Map with size tracking.
 */
class LRUCache<V> {
  private cache = new Map<string, { value: V; expiry: number }>();
  constructor(private max: number) {}
  get(key: string): V | undefined {
    const item = this.cache.get(key);
    if (!item) return undefined;

    // Lazy expiration check
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return undefined;
    }

    // Refresh item position (delete and re-add makes it "newest" in Map iteration)
    this.cache.delete(key);
    this.cache.set(key, item);
    return item.value;
  }

  set(key: string, value: V, ttlMs: number) {
    // Evict oldest if full
    if (this.cache.size >= this.max) {
      // Map.keys().next() returns the oldest inserted key (insertion order)
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, { value, expiry: Date.now() + ttlMs });
  }

  delete(key: string) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }
}

@Injectable()
export class RoleCacheService {
  // Simple L1 Memory Cache to reduce Redis network round-trips
  // Use LRU
  private userRolesL1Cache = new LRUCache<string[]>(L1_MAX_SIZE);
  private permRolesL1Cache = new LRUCache<string[]>(L1_MAX_SIZE);

  constructor(
    private readonly i18nService: I18nService,
    private readonly redis: RedisService,
    // Optional: If not provided, cache misses will call redis.get directly
    @Optional() private readonly dataSource?: IRoleDataSource,
  ) {}

  /**
   * Retrieves the global roles assigned to a specific user.
   * Strategy: L1 Memory (userRolesL1Cache/permRolesL1Cache) -> L2 Redis (getOrSet with Lock) -> DB Source
   */
  async getUserGlobalRoles(userId: string): Promise<string[]> {
    // Check L1 Cache (Memory)
    const l1 = this.userRolesL1Cache.get(userId);
    if (l1) return l1;

    const key = `${CACHE_KEY_PREFIX}user:${userId}:roles`;
    // Check L2 Cache (Redis) with Protection
    // If dataSource is present, use getOrSet to handle stampedes.
    // If no dataSource, just get.
    let roles: string[] | null = null;
    try {
      if (this.dataSource) {
        const result = await this.redis.getOrSet<string[]>(
          key,
          async () => {
            return this.dataSource!.getUserGlobalRoles(userId);
          },
          {
            ttl: L2_CACHE_TTL_SEC,
            ttlJitter: 60, // Add jitter to prevent simultaneous expiration
            lockTtl: 5,
          },
        );
        roles = result as string[];
      } else {
        roles = await this.redis.get<string[]>(key);
      }
    } catch (err) {
      throw new BaseRpcException(
        this.i18nService.translate('ROLE_CACHE_FETCH_FAILED'),
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCodes.UNEXPECTED_ERROR,
        { cause: err },
      );
    }
    // Default to empty array if nothing found
    const finalRoles = roles || [];
    // Update L1 Cache
    this.userRolesL1Cache.set(userId, finalRoles, L1_CACHE_TTL_MS);

    return finalRoles;
  }

  /**
   * Retrieves the list of roles that are granted a specific permission.
   */
  async getRolesForPermission(permissionId: string): Promise<string[]> {
    // Check L1 Cache (Memory)
    const l1 = this.permRolesL1Cache.get(permissionId);
    if (l1) return l1;

    const key = `${CACHE_KEY_PREFIX}perm:${permissionId}:roles`;

    // Check L2 Cache
    let roles: string[] | null = null;

    try {
      if (this.dataSource) {
        const result = await this.redis.getOrSet<string[]>(
          key,
          async () => {
            return this.dataSource!.getRolesForPermission(permissionId);
          },
          {
            ttl: L2_CACHE_TTL_SEC * 24, // Permissions change rarely, cache longer
            ttlJitter: 300,
            lockTtl: 5,
          },
        );
        roles = result as string[];
      } else {
        roles = await this.redis.get<string[]>(key);
      }
    } catch (err) {
      throw new BaseRpcException(
        this.i18nService.translate('PERMISSION_CACHE_FETCH_FAILED'),
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCodes.UNEXPECTED_ERROR,
        { cause: err },
      );
    }

    const finalRoles = roles || [];

    // Update L1 Cache
    this.permRolesL1Cache.set(permissionId, finalRoles, L1_CACHE_TTL_MS);

    return finalRoles;
  }

  /**
   * Checks if a user is a "Super Admin" (bypass all checks).
   */
  async isSuperAdmin(userId: string): Promise<boolean> {
    const roles = await this.getUserGlobalRoles(userId);
    return roles.includes('admin');
  }

  /**
   * Local Invalidation: Clears L1 and L2.
   * Call this when specific user roles change locally (e.g. in Auth Service).
   */
  async invalidateUserRoles(userId: string): Promise<void> {
    // Clearing your local L1 cache (this will also take effect immediately if the request happens to hit the Writer node), but there's no guarantee you'll be that lucky.
    // Don't bother broadcasting invalidation messages to other instances; the short L1 TTL will handle eventual consistency.
    this.userRolesL1Cache.delete(userId); // Clear local L1
    const key = `${CACHE_KEY_PREFIX}user:${userId}:roles`;
    await this.redis.del(key); // Clear shared L2
  }

  /**
   * Local Invalidation: Clears L1 and L2 for permissions.
   * Call this when specific role permissions change locally (e.g. in Auth Service).
   */
  async invalidatePermissionRoles(permissionId: string): Promise<void> {
    this.permRolesL1Cache.delete(permissionId);
    const key = `${CACHE_KEY_PREFIX}perm:${permissionId}:roles`;
    await this.redis.del(key);
  }
}
