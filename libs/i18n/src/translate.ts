export default {
  en: {
    translation: {
      HELLO: 'Hello {{name}}!',
      GOODBYE: 'Goodbye!',
      WELCOME: 'Welcome!',
      Current_Environment: 'Current environment is {{env}}.',
      Watching_Collection:
        'Setting up watch stream for collections: {{collections}}',
      Using_Casbin_Model: 'Using Casbin model from {{modelPath}}',
      Database_Connected: 'Database connected successfully',
      Redis_Client_Connected: 'Redis client connected',
      Redis_Client_Ready: 'Redis client is ready to use',
      Redis_Client_Error: 'Redis client error',
      Initializing_DatabaseWatcher: 'Initializing DatabaseWatcher...',
      No_Collections_To_Watch:
        'No collections configured to be watched. DatabaseWatcher will be idle.',
      DatabaseWatcher_Init_Failed:
        'Failed to initialize DatabaseWatcher during onModuleInit.',
      Database_Change_Detected: 'Database change detected',
      Change_Stream_Error: 'Change stream encountered an error.',
      Change_Stream_Start_Failed:
        'Failed to start the change stream. Please ensure MongoDB is running as a replica set.',
      Redis_Breaker_Opened: 'Redis circuit breaker has opened.',
      Redis_Breaker_Closed: 'Redis circuit breaker has closed.',
      Redis_Breaker_HalfOpen:
        'Redis circuit breaker is half-open, attempting recovery in {{resetTimeout}}ms.',
      Cache_Hit_For_Setting: 'Cache hit for setting.',
      Cache_Get_Failed_Fallback:
        'Failed to get setting from Redis. Falling back to database.',
      Lock_Acquire_Failed:
        'Failed to acquire Redis lock. Proceeding without lock.',
      Cache_Miss_Lock_Acquired: 'Cache miss, lock acquired. Fetching from DB.',
      DB_Fetch_Or_Cache_Set_Error:
        'Error fetching from DB or setting cache while holding lock.',
      Lock_Release_Failed:
        'Failed to release Redis lock. It will expire automatically.',
      Cache_Miss_Lock_Not_Acquired:
        'Cache miss, lock not acquired. Waiting and retrying from cache.',
      Cache_Invalidate_Failed:
        'Failed to invalidate setting cache in Redis after DB update.',
      USERNAME_ALREADY_EXISTS: 'Username already exists',
      USER_CREATION_FAILED: 'Failed to create user.',
      USERNAME_TOO_SHORT:
        'Username must be at least {{minLength}} characters long.',
      USERNAME_TOO_LONG:
        'Username must be no more than {{maxLength}} characters long.',
      USERNAME_INVALID_CHARACTERS:
        'Username can only contain letters, numbers, underscores, dots, and hyphens.',
      PASSWORD_TOO_SHORT: 'Password is too short.',
      PASSWORD_NO_DIGIT: 'Password must contain at least one digit.',
      PASSWORD_NO_LOWERCASE:
        'Password must contain at least one lowercase letter.',
      PASSWORD_NO_UPPERCASE:
        'Password must contain at least one uppercase letter.',
      PASSWORD_NO_SPECIAL_CHAR:
        'Password must contain at least one special character.',
      Cache_Hit: 'Cache hit for key {{key}}.',
      Initializing_Default_Settings: 'Initializing default settings...',
      Default_Settings_Initialized: 'Default settings initialized.',
      Initializing_Settings_Cache: 'Initializing settings cache...',
      Settings_Cache_Pre_Warming_Completed:
        'Settings cache pre-warming completed.',
      Redis_Client_Closing: 'Disconnecting Redis client...',
      Failed_to_parse_redis_value:
        'Failed to parse Redis value for key "{{key}}" as JSON. Returning raw string.',
      Trying_To_Get_Setting_From_DB:
        'Trying to get setting from DB for key {{key}}',
      User_not_found: 'User not found',
      Redis_Down_Fallback_To_DB: 'Redis is down, falling back to DB check',
      JWT_Revoked: 'JWT token is revoked',
      User_From_Validate_JWT_But_Not_Found:
        'User from valid JWT not found in database during fallback. This should not happen.',
      Cache_Set_Failed: 'Cache sets failed.',
      Retry_Failed_Fallback_To_Fetcher:
        'Retry failed. Falling back to fetcher directly.',
      Retry_Failed_Fallback_To_Null: 'Retry failed. Falling back to null.',
      Cache_Get_Failed: 'Cache get failed.',
      Cache_Set_Failed_After_DB_Fetch:
        'Cache set failed after DB update After DB fetch successfully.',
      Retry_Success_Cache_Hit: 'Retry successfully. Cache hit',
      Default_Settings_Initialization_Failed:
        'Default settings initialization failed.',
      Login_Session_Store_Failed: 'Login session store failed.',
      Refresh_Token_Failed:
        'Refresh token verification failed. It might be expired or invalid.',
      User_Not_Found_With_Valid_Token:
        'User not found for a valid refresh token. The user may have been deleted.',
      INVALID_CREDENTIALS: 'Invalid credentials',
      UNKNOWN_EXECUTION_CONTEXT_TYPE:
        'Unknown execution context type-{{contextType}} caught by AllExceptionsFilter',
      RPC_ERROR_CAUGHT_BY_FILTER: 'RPC Error caught by AllExceptionsFilter',
      INTERNAL_SERVER_ERROR: 'Internal Server Error',
      USER_CREATION_ERROR: 'User creation failed',
      USERNAME_VALIDATION_REGEX_NOT_CONFIGURED_SUCCESSFULLY:
        'Username validation regex not configured successfully.',
      UNAUTHORIZED: 'Unauthorized',
      User_Login_Successful: 'User {{username}} login successful',
      NATS_STREAM_NAME_REQUIRED: 'Stream name is required in streamConfig.',
      NATS_CONNECTING_TO_PROVISION_STREAM:
        "Connecting to NATS at {{natsUrl}} to provision stream '{{streamName}}'...",
      NATS_STREAM_FOUND_UPDATING:
        "Stream '{{streamName}}' found. Updating configuration...",
      NATS_STREAM_NOT_FOUND_CREATING:
        "Stream '{{streamName}}' not found. Creating...",
      NATS_STREAM_PROVISIONED_SUCCESSFULLY:
        "Stream '{{streamName}}' provisioned successfully.",
      NATS_STREAM_DESCRIPTION:
        'Stream for the {{serviceName}} microservice ({{environment}})',
      AUTH_STATE_STREAM_DESCRIPTION:
        'Global Security Stream for Zero-I/O local authentication',
      DLQ_STREAM_DESCRIPTION: 'Dead-letter queue.',
      AUTH_EVENTS_STREAM_DESCRIPTION:
        'Stream for authentication events (e.g., user login)',
      USER_EVENTS_STREAM_DESCRIPTION:
        'Stream for user-related events (e.g., user creation, profile updates)',
      IM_HANDOFF_STREAM_DESCRIPTION:
        'Internal routing and Write-Ahead Log (WAL) core stream',
      IM_DOWNBOUND_STREAM_DESCRIPTION:
        'Real-time online downbound stream for gateway nodes',
      ENVIRONMENT_PRODUCTION: 'Production',
      ENVIRONMENT_DEVELOPMENT: 'Development',
      REFRESH_TOKEN_REUSED_OR_REVOKED:
        'Refresh token is either reused or revoked.',
      FAILED_TO_PUBLISH_LOGGEDIN_EVENT:
        'Failed to publish user.loggedIn event to NATS JetStream',
      SERVICE_ERROR: 'Service thrown an error when call {{method}}',
      GET_OR_SET_RETURNED_NULL_RETRYING:
        'getOrSet returned null. Retrying after {{delay}}ms...',
      GET_SETTING_VALUE_FAILED_AFTER_RETRIES:
        'Failed to get setting value after multiple retries.',
      IDEMPOTENCY_CONFLICT: 'Idempotency conflict.',
      IDEMPOTENCY_CACHED_RESPONSE_RETURNED:
        'Idempotency: Cached response returned.',
      IDEMPOTENCY_CONFLICT_DETECTED: 'Idempotency: Conflict detected.',
      IDEMPOTENCY_LOCK_ACQUIRED:
        'Idempotency: Lock acquired, executing operation.',
      IDEMPOTENCY_OPERATION_FAILED:
        'Idempotency: Operation failed, releasing lock.',
      REGISTRATION_FAILED: 'Registration failed',
      NO_SETTINGS_FOUND_TO_CACHE: 'No settings found in database to cache.',
      FAILED_TO_RETRIEVE_SCOPED_ROLES: 'Failed to retrieve scoped roles.',
      ROLE_CACHE_FETCH_FAILED:
        'Failed to fetch roles from cache or data source.',
      PERMISSION_CACHE_FETCH_FAILED:
        'Failed to fetch permissions from cache or data source.',
      PERMISSION_GUARD_NO_USER_ID_IN_CONTEXT:
        'Access denied: No User ID found in context. Ensure AuthGuard runs before PermissionGuard.',
      PERMISSION_GUARD_ACCESS_DENIED:
        'User {{userId}} denied access to {{className}}.{{handlerName}}. Missing one of: [{{permissions}}]',
      SETTINGS_SEEDER_SKIPPED: 'Settings Seeder skipped (Reader Mode)',
      Redis_HSet_Failed: 'Failed to set hash field in Redis.',
      Redis_HDel_Failed: 'Failed to delete hash field from Redis.',
      TOKEN_REFRESH_ERROR: 'Error refreshing token.',
      REFRESHTOKEN_ERROR: 'Refresh token error',
      CircuitBreaker_Open:
        '[CircuitBreaker] OPEN: {{name}} - Stopping requests',
      CircuitBreaker_HalfOpen:
        '[CircuitBreaker] HALF-OPEN: {{name}} - Testing service',
      CircuitBreaker_Close:
        '[CircuitBreaker] CLOSE: {{name}} - Service recovered',
      Service_Unavailable: 'Service Unavailable',
      TOKEN_JTI_ADDED_TO_BLACKLIST:
        'Token JTI added to local memory blacklist.',
      FAILED_TO_PUBLISH_REVOKE_EVENT_LOGOUT:
        'Failed to publish auth.jwt.revoke event during logout',
      FAILED_TO_PARSE_SESSION_OR_PUBLISH_REVOCATION:
        'Failed to parse session or publish revocation event',
      CORRUPTED_SESSION_DATA_IN_REDIS: 'Corrupted session data in Redis',
      REPLAY_ATTACK_DETECTED:
        'Refresh Token Replay Attack detected! Revoking all user sessions.',
      FAILED_TO_PUBLISH_REVOKE_EVENT_REPLAY:
        'Failed to publish revocation during replay attack handling',
      FAILED_TO_PUBLISH_OLD_TOKEN_REVOCATION:
        'Failed to publish old token revocation during refresh',
      SUCCESSFULLY_PROCESSED_LOGGEDIN_EVENT:
        'Successfully processed auth.event.user.loggedIn event.',
      NATS_URL_NOT_FOUND: 'NATS URL not found in configuration.',
      FAILED_TO_UPDATE_CONSUMER_CONFIG:
        'Failed to update existing durable consumer configuration. Falling back to existing consumer config.',
      SUCCESSFULLY_PROCESSED_CONSUMER:
        'Successfully provisioned {{type}} consumer.',
      FAILED_TO_ADD_CONSUMER:
        'Failed to add consumer for stream {{streamName}}. Ensure the stream is provisioned.',
      NATS_CONSUMER_ADD_RETRYING:
        'Stream {{streamName}} might not be ready. Retrying to add consumer in {{delay}}ms... (Attempt {{attempt}}/{{maxAttempts}})',
      PULL_CONSUMER_FATAL_ERROR: 'Pull Consumer loop exited with fatal error.',
      FAILED_TO_INITIALIZE_PULL_CONSUMER:
        'Failed to initialize NATS pull consumer.',
      DISCARDING_MALFORMED_EVENT: 'Discarding malformed NATS event.',
      FAILED_TO_PROCESS_EVENT_REQUEUEING:
        'Failed to process NATS event. Requeueing.',
      MESSAGE_MOVED_TO_DLQ: 'Message moved to DLQ after max failed attempts.',
      FATAL_FAILED_TO_MOVE_TO_DLQ:
        'FATAL: Failed to move message to DLQ! Message might be dropped or stuck.',
      ERROR_DURING_NATS_SHUTDOWN: 'Error during NATS connection shutdown.',
      NO_STREAM_CONFIGS_PROVIDED:
        'No stream configurations provided for JetStream provisioner.',
      FAILED_TO_PROVISION_JETSTREAM_STREAMS:
        'Failed to provision JetStream streams.',
      BOUNDED_PUBLISHER_NOT_OPERATIONAL:
        'BoundedPublisher is not operational (no JetStream client). Message dropped.',
      CRITICAL_SECURITY_SIGNAL_DROPPED:
        'CRITICAL SECURITY SIGNAL DROPPED! Queue is completely exhausted.',
      NORMAL_EVENT_DROPPED: 'Normal event dropped due to backpressure.',
      QUEUE_LIMIT_REACHED: 'Queue limit reached: {{msg}}',
      BOUNDED_PUBLISHER_TASK_FAILED:
        'Bounded publisher task failed. Attempting to route to DLQ.',
      FATAL_FAILED_TO_PUBLISH_TO_DLQ:
        'FATAL: Failed to publish to DLQ. Message is lost.',
      ID_GENERATOR_SEGMENT_EXHAUSTED:
        'Segment exhausted, triggering slow path allocation',
      ID_GENERATOR_LOCK_ACQUIRED_BY_OTHER:
        'Lock acquired by another pod, waiting and retrying...',
      ID_GENERATOR_REDIS_EVAL_FAILED: 'Redis eval failed during ID generation',
      ID_GENERATOR_ALLOCATION_ERROR: 'Failed to allocate sequence segment',
      ID_GENERATOR_REDIS_ERROR: 'Redis service unavailable',
      ID_GENERATOR_ALLOCATION_FAILED: 'Sequence allocation failed',
      INVALID_SEQUENCE_KEY: 'Invalid sequence key format',
      ID_GENERATOR_LOCK_TIMEOUT:
        'Failed to acquire lock for sequence allocation',
      ID_GENERATOR_DELAYED_ALLOCATION_DISCARDED:
        'Delayed allocation detected. Segment discarded to prevent sequence rollback.',
      TOKEN_REVOKED_RECONNECT: 'Token has been revoked. Please log in again.',
      SERVICE_SHUTDOWN_RECONNECT: 'Service is shutting down, please reconnect.',
      HANDSHAKE_TIMEOUT_LOG: 'Connection closed due to handshake timeout.',
      KICKING_USER_REVOKED_TOKEN_LOG:
        'Kicking user whose id is {{userId}}, due to revoked token.',
      WS_GATEWAY_INITIALIZED_LOG:
        'WS Gateway initialized with ID: {{gatewayId}}',
      WS_GATEWAY_SHUTTING_DOWN_LOG: 'WS Gateway shutting down.',
      NEW_CONNECTION_WAITING_AUTH_REQ_LOG:
        'New connection established. Waiting for AUTH_REQ...',
      USER_DISCONNECTED_LOG: 'User {{userId}} disconnected.',
      TERMINATING_ZOMBIE_CONNECTION_LOG:
        'Terminating zombie connection for user: {{userId}}',
      UNHANDLED_COMMAND_LOG: 'Unhandled command: 0x{{cmd}}',
      USER_AUTHENTICATED_ON_DEVICE_LOG:
        'User {{userId}} authenticated on device {{deviceId}}',
      AUTH_FAILED_LOG: 'Auth failed: {{errorMessage}}',
      FAILED_TO_INGEST_MSG_UP_LOG: 'Failed to ingest MSG_UP: {{errorMessage}}',
      REPORTING_USER_OFFLINE_LOG: 'Reporting user offline: {{userId}}',
      FAILED_TO_PUBLISH_OFFLINE_EVENT_LOG:
        'Failed to publish offline event to {{subject}}',
      FAILED_TO_PROCESS_TOKEN_REVOCATION:
        'Failed to process token revocation event',
      RECEIVED_DOWNBOUND_EVENT_WITHOUT_USERID:
        'Received downbound event without userId',
      FAILED_TO_DISPATCH_SYNC_EVENT: 'Failed to dispatch sync event to gateway',
      DECREMENT_FAILED: 'Failed to decrement IP connection counter in Redis',
      FLOOD_REJECTED:
        'Connection flood rejected. IP {{ip}} exceeded limit of {{limit}} connections.',
      REDIS_ERROR_FAIL_OPEN:
        'Redis error during IP rate limiting. Allowing connection (fail-open).',
      OVERSIZED_PAYLOAD_TERMINATED_LOG:
        'Received oversized payload, terminating connection to prevent OOM.',
      ZOMBIE_ROUTE_DETECTED_LOG:
        'user:{{userId}}-device:{{deviceId}} Zombie route detected. Emitting offline event to heal presence state.',
      ZOMBIE_DEVICE_ROUTE_DETECTED_LOG:
        'user:{{userId}}-device:{{deviceId}} Zombie device route detected. Emitting offline event to heal presence state.',
      SENT_HEARTBEATS_LOG:
        'Sent global presence heartbeats for {{count}} active authenticated connections.',
      RATE_LIMIT_EXCEEDED: 'Rate limit exceeded.',
      PING_PAYLOAD_NOT_EMPTY: 'PING payload must be empty',
      INVALID_OR_EXPIRED_TOKEN: 'Invalid or expired token',
      PROTOCOL_VERSION_MISMATCH: 'Protocol version mismatch',
      CACHE_LOCK_TIMEOUT_PREVENT_STAMPEDE:
        'Cache lock wait timeout. Throwing error to prevent database stampede.',
      CACHE_LOCK_TIMEOUT_CAUSE:
        'Timeout waiting for cache lock on key: {{key}}. Potential database bottleneck or lock starvation.',
      Seeding_Permissions_Skipped:
        'Another instance is currently seeding permissions. Skipping...',
      Seeding_Permissions_Started:
        'Lock acquired. Starting to seed roles and permissions to database...',
      Watchdog_Renew_Permission_Lock_Failed:
        'Watchdog failed to renew permission seeder lock TTL',
      Watchdog_Renew_Permission_Lock_Success:
        'Watchdog successfully renewed permission seeder lock',
      Seeding_Permissions_Success: 'Successfully seeded roles and permissions.',
      Seeding_Permissions_Failed: 'Failed to seed roles and permissions',
      Release_Permission_Lock_Failed:
        'Failed to release permission seeder lock safely',
      DIRECT_MESSAGE_REQUIRES_TWO_USERS:
        'Direct message requires exactly two users',
      USER_NOT_FOUND: 'User not found',
      DIRECT_MESSAGE_FALLBACK_NAME: 'Direct Message',
      FAILED_TO_INSERT_GROUP_MEMBERS: 'Failed to insert group members',
      CONCURRENT_DM_CREATION_DETECTED:
        'Concurrent DM creation detected. Returning existing group gracefully.',
      FAILED_TO_RELEASE_IDEMPOTENCY_LOCK_STATUS:
        'Failed to release idempotency lock after unsuccessful status code',
      FAILED_TO_RELEASE_IDEMPOTENCY_LOCK_EXCEPTION:
        'Failed to release idempotency lock after exception',
      JWT_MISSING_EXP_CLAIM: 'JWT must have an expiration time (exp) claim',
      DETECTED_DUPLICATED_NATS_DELIVERY:
        'Detected duplicated NATS delivery. Message already processed.',
      BAD_REQUEST: 'Bad Request',
      RATE_LIMIT_EXCEEDED_BIZ: 'User {{userId}} exceeded business rate limit',
      INVALID_MESSAGE_MISSING_ID:
        'Invalid message: Missing groupId or clientMsgId',
      SUCCESSFULLY_ROUTED_MSG_UP: 'Successfully routed MSG_UP',
      FAILED_TO_PROCESS_MSG_UP: 'Failed to process MSG_UP',
    },
  },
  zh: {
    translation: {
      HELLO: '你好 {{name}}！',
      GOODBYE: '再见！',
      WELCOME: '欢迎！',
      Current_Environment: '当前环境是 {{env}}。',
      Watching_Collection: '为 stream 设置的监听集合: {{collections}}',
      Using_Casbin_Model: '使用的 Casbin 模型来自 {{modelPath}}',
      Database_Connected: '数据库连接成功',
      Redis_Client_Connected: 'Redis 客户端已连接',
      Redis_Client_Ready: 'Redis 客户端已准备就绪',
      Redis_Client_Error: 'Redis 客户端错误',
      Initializing_DatabaseWatcher: '正在初始化数据库watcher...',
      No_Collections_To_Watch:
        '没有配置要观察的集合。数据库watcher将处于空闲状态。',
      DatabaseWatcher_Init_Failed: '初始化数据库watcher失败。',
      Database_Change_Detected: '检测到数据库变更',
      Change_Stream_Error: 'change stream 遇到错误。',
      Change_Stream_Start_Failed:
        '无法启动change stream。请确保 MongoDB 正在作为副本集运行。',
      Redis_Breaker_Opened: 'Redis 断路器已打开。',
      Redis_Breaker_Closed: 'Redis 断路器已关闭。',
      Redis_Breaker_HalfOpen:
        'Redis 断路器处于半开状态，将在 {{resetTimeout}} 毫秒后尝试恢复。',
      Cache_Hit_For_Setting: '设置项缓存命中。',
      Cache_Get_Failed_Fallback: '从 Redis 获取设置失败，回退到数据库。',
      Lock_Acquire_Failed: '获取 Redis 锁失败，无锁继续执行。',
      Cache_Miss_Lock_Acquired: '缓存未命中，已获取锁，正在从数据库获取。',
      DB_Fetch_Or_Cache_Set_Error: '持有锁期间，从数据库获取或设置缓存时出错。',
      Lock_Release_Failed: '释放 Redis 锁失败，锁将自动过期。',
      Cache_Miss_Lock_Not_Acquired:
        '缓存未命中，未获取到锁，等待后从缓存重试。',
      Cache_Invalidate_Failed: '数据库更新后，使 Redis 缓存失效失败。',
      USERNAME_ALREADY_EXISTS: '用户名已存在',
      USER_CREATION_FAILED: '创建用户失败。',
      USERNAME_TOO_SHORT: '用户名至少需要 {{minLength}} 个字符。',
      USERNAME_TOO_LONG: '用户名最多只能有 {{maxLength}} 个字符。',
      USERNAME_INVALID_CHARACTERS:
        '用户名只能包含字母、数字、下划线、点和连字符。',
      PASSWORD_TOO_SHORT: '密码太短。',
      PASSWORD_NO_DIGIT: '密码必须包含至少一位数字。',
      PASSWORD_NO_LOWERCASE: '密码必须包含至少一个小写字母。',
      PASSWORD_NO_UPPERCASE: '密码必须包含至少一个大写字母。',
      PASSWORD_NO_SPECIAL_CHAR: '密码必须包含至少一个特殊字符。',
      Cache_Hit: '键 {{key}} 的缓存命中。',
      Initializing_Default_Settings: '正在初始化默认设置...',
      Default_Settings_Initialized: '默认设置初始化完成。',
      Initializing_Settings_Cache: '正在初始化设置缓存...',
      Settings_Cache_Pre_Warming_Completed: '设置缓存预热完成。',
      Redis_Client_Closing: '正在断开 Redis 客户端连接...',
      Failed_to_parse_redis_value:
        '无法将 Redis 键 "{{key}}" 的值解析为 JSON。返回原始字符串。',
      Trying_To_Get_Setting_From_DB: '正在尝试从数据库获取键 {{key}} 的设置',
      User_not_found: '未找到用户',
      Redis_Down_Fallback_To_DB: 'Redis 宕机，回退到数据库检查',
      JWT_Revoked: 'JWT 令牌已撤销',
      User_From_Validate_JWT_But_Not_Found:
        '在回退过程中，验证的 JWT 中的用户在数据库中未找到。这不应该发生。',
      Cache_Set_Failed: '缓存设置失败。',
      Retry_Failed_Fallback_To_Fetcher: '重试失败，往后直接回退到获取器。',
      Retry_Failed_Fallback_To_Null: '重试失败，返回 null。',
      Cache_Get_Failed: '缓存获取失败。',
      Cache_Set_Failed_After_DB_Fetch: '从数据库成功获取数据后，缓存设置失败。',
      Retry_Success_Cache_Hit: '重试成功，缓存命中',
      Default_Settings_Initialization_Failed: '默认设置初始化失败。',
      Login_Session_Store_Failed: '登录会话存储失败。',
      Refresh_Token_Failed: '刷新令牌验证失败。它可能已过期或无效。',
      User_Not_Found_With_Valid_Token:
        '用户token有效，但是未找到该用户。用户可能已被删除。',
      INVALID_CREDENTIALS: '凭证无效',
      UNKNOWN_EXECUTION_CONTEXT_TYPE:
        'AllExceptionsFilter 捕获到未知执行上下文类型-{{contextType}}',
      RPC_ERROR_CAUGHT_BY_FILTER: 'RPC 错误被 AllExceptionsFilter 捕获',
      INTERNAL_SERVER_ERROR: '内部服务器错误',
      USER_CREATION_ERROR: '创建用户失败',
      USERNAME_VALIDATION_REGEX_NOT_CONFIGURED_SUCCESSFULLY:
        '用户名验证正则表达式未配置。',
      UNAUTHORIZED: '未经授权',
      User_Login_Successful: '用户 {{username}} 登录成功',
      NATS_STREAM_NAME_REQUIRED: 'Stream 配置中缺少流名称。',
      NATS_CONNECTING_TO_PROVISION_STREAM:
        "正在连接到 NATS 服务器 {{natsUrl}} 以配置流 '{{streamName}}'...",
      NATS_STREAM_FOUND_UPDATING: "已找到流 '{{streamName}}'。正在更新配置...",
      NATS_STREAM_NOT_FOUND_CREATING: "未找到流 '{{streamName}}'。正在创建...",
      NATS_STREAM_PROVISIONED_SUCCESSFULLY: "流 '{{streamName}}' 配置成功。",
      NATS_STREAM_DESCRIPTION:
        '用于 {{serviceName}} 微服务的流 ({{environment}})',
      AUTH_STATE_STREAM_DESCRIPTION: '用于零 I/O 本地身份验证的全局安全流',
      DLQ_STREAM_DESCRIPTION: '死信队列。',
      AUTH_EVENTS_STREAM_DESCRIPTION:
        '用于身份验证相关事件的流（例如，用户登录）',
      USER_EVENTS_STREAM_DESCRIPTION:
        '用于用户相关事件的流（例如，用户创建、个人资料更新）',
      IM_HANDOFF_STREAM_DESCRIPTION: '用于内部路由和预写日志 (WAL) 核心的流',
      IM_DOWNBOUND_STREAM_DESCRIPTION: '用于网关节点的实时在线下发流',
      ENVIRONMENT_PRODUCTION: '生产环境',
      ENVIRONMENT_DEVELOPMENT: '开发环境',
      REFRESH_TOKEN_REUSED_OR_REVOKED: '刷新令牌已使用或已撤销。',
      FAILED_TO_PUBLISH_LOGGEDIN_EVENT:
        '发布 user.loggedIn 事件到 NATS JetStream 失败',
      SERVICE_ERROR: '当调用 {{method}} 的时候，服务抛出错误',
      GET_OR_SET_RETURNED_NULL_RETRYING:
        'getOrSet 返回了 null。将在 {{delay}}ms 后重试...',
      GET_SETTING_VALUE_FAILED_AFTER_RETRIES: '多次重试后未能获取设置值。',
      IDEMPOTENCY_CONFLICT: '幂等性冲突。',
      IDEMPOTENCY_CACHED_RESPONSE_RETURNED: '幂等性：返回缓存的响应。',
      IDEMPOTENCY_CONFLICT_DETECTED: '幂等性：检测到冲突。',
      IDEMPOTENCY_LOCK_ACQUIRED: '幂等性：已获取锁，正在执行操作。',
      IDEMPOTENCY_OPERATION_FAILED: '幂等性：操作失败，正在释放锁。',
      REGISTRATION_FAILED: '注册失败',
      NO_SETTINGS_FOUND_TO_CACHE: '数据库中未找到可缓存的设置。',
      FAILED_TO_RETRIEVE_SCOPED_ROLES: '获取作用域角色失败。',
      ROLE_CACHE_FETCH_FAILED: '从缓存或数据源获取角色失败。',
      PERMISSION_CACHE_FETCH_FAILED: '从缓存或数据源获取权限失败。',
      PERMISSION_GUARD_NO_USER_ID_IN_CONTEXT:
        '访问被拒绝：上下文中未找到用户ID。请确保AuthGuard在PermissionGuard之前运行。',
      PERMISSION_GUARD_ACCESS_DENIED:
        '用户 {{userId}} 被拒绝访问 {{className}}.{{handlerName}}。缺少以下权限之一：[{{permissions}}]',
      SETTINGS_SEEDER_SKIPPED: '设置种子已跳过（只读模式）',
      Redis_HSet_Failed: '在 Redis 中设置哈希字段失败。',
      Redis_HDel_Failed: '从 Redis 中删除哈希字段失败。',
      TOKEN_REFRESH_ERROR: '刷新 TOKEN 出现错误。',
      REFRESHTOKEN_ERROR: '刷新令牌错误',
      CircuitBreaker_Open: '[熔断器] 开启: {{name}} - 停止请求',
      CircuitBreaker_HalfOpen: '[熔断器] 半开启: {{name}} - 测试服务',
      CircuitBreaker_Close: '[熔断器] 关闭: {{name}} - 服务已恢复',
      Service_Unavailable: '服务不可用',
      TOKEN_JTI_ADDED_TO_BLACKLIST: 'Token JTI 已加入本地内存黑名单。',
      FAILED_TO_PUBLISH_REVOKE_EVENT_LOGOUT:
        '登出时发布 auth.jwt.revoke 事件失败',
      FAILED_TO_PARSE_SESSION_OR_PUBLISH_REVOCATION:
        '解析会话或发布撤销事件失败',
      CORRUPTED_SESSION_DATA_IN_REDIS: 'Redis 中的会话数据已损坏',
      REPLAY_ATTACK_DETECTED: '检测到刷新令牌重放攻击！正在撤销所有用户会话。',
      FAILED_TO_PUBLISH_REVOKE_EVENT_REPLAY: '处理重放攻击时发布撤销事件失败',
      FAILED_TO_PUBLISH_OLD_TOKEN_REVOCATION: '刷新时发布旧令牌撤销事件失败',
      SUCCESSFULLY_PROCESSED_LOGGEDIN_EVENT:
        '成功处理 auth.event.user.loggedIn 事件。',
      NATS_URL_NOT_FOUND: '配置中未找到 NATS URL。',
      FAILED_TO_UPDATE_CONSUMER_CONFIG:
        '更新现有持久化消费者配置失败。回退到现有配置。',
      SUCCESSFULLY_PROCESSED_CONSUMER: '成功配置 {{type}} 消费者。',
      FAILED_TO_ADD_CONSUMER:
        '为流 {{streamName}} 添加消费者失败。请确保该流已配置。',
      NATS_CONSUMER_ADD_RETRYING:
        '流 {{streamName}} 可能尚未就绪。将在 {{delay}}ms 后重试添加消费者... (第 {{attempt}}/{{maxAttempts}} 次尝试)',
      PULL_CONSUMER_FATAL_ERROR: 'Pull Consumer 循环因致命错误退出。',
      FAILED_TO_INITIALIZE_PULL_CONSUMER: '初始化 NATS pull 消费者失败。',
      DISCARDING_MALFORMED_EVENT: '丢弃格式错误的 NATS 事件。',
      FAILED_TO_PROCESS_EVENT_REQUEUEING: '处理 NATS 事件失败。正在重新入队。',
      MESSAGE_MOVED_TO_DLQ:
        '达到最大失败尝试次数后，消息已移至死信队列 (DLQ)。',
      FATAL_FAILED_TO_MOVE_TO_DLQ:
        '致命错误：将消息移至 DLQ 失败！消息可能被丢弃或卡住。',
      ERROR_DURING_NATS_SHUTDOWN: '关闭 NATS 连接时出错。',
      NO_STREAM_CONFIGS_PROVIDED: '未提供 JetStream provisioner 的流配置。',
      FAILED_TO_PROVISION_JETSTREAM_STREAMS: '配置 JetStream 流失败。',
      BOUNDED_PUBLISHER_NOT_OPERATIONAL:
        'BoundedPublisher 不可用（无 JetStream 客户端）。消息已丢弃。',
      CRITICAL_SECURITY_SIGNAL_DROPPED: '关键安全信号被丢弃！队列已完全耗尽。',
      NORMAL_EVENT_DROPPED: '由于背压，正常事件被丢弃。',
      QUEUE_LIMIT_REACHED: '达到队列限制：{{msg}}',
      BOUNDED_PUBLISHER_TASK_FAILED: '有界发布任务失败。尝试路由到 DLQ。',
      FATAL_FAILED_TO_PUBLISH_TO_DLQ: '致命错误：发布到 DLQ 失败。消息丢失。',
      ID_GENERATOR_SEGMENT_EXHAUSTED: '号段耗尽，触发慢路径分配',
      ID_GENERATOR_LOCK_ACQUIRED_BY_OTHER: '锁已被其他 Pod 获取，等待并重试...',
      ID_GENERATOR_REDIS_EVAL_FAILED: 'ID 生成期间 Redis eval 失败',
      ID_GENERATOR_ALLOCATION_ERROR: '分配序列号段失败',
      ID_GENERATOR_REDIS_ERROR: 'Redis 服务不可用',
      ID_GENERATOR_ALLOCATION_FAILED: '序列分配失败',
      INVALID_SEQUENCE_KEY: '无效的序列键格式',
      ID_GENERATOR_LOCK_TIMEOUT: '获取序列分配锁失败，重试次数耗尽',
      ID_GENERATOR_DELAYED_ALLOCATION_DISCARDED:
        '检测到延迟分配。已丢弃该号段以防止序列回退。',
      TOKEN_REVOKED_RECONNECT: '令牌已撤销。请重新登录。',
      SERVICE_SHUTDOWN_RECONNECT: '服务正在关闭，请重新连接。',
      HANDSHAKE_TIMEOUT_LOG: '连接因握手超时而关闭。',
      KICKING_USER_REVOKED_TOKEN_LOG:
        '因令牌撤销而踢出用户，该用户id是{{userId}}。',
      WS_GATEWAY_INITIALIZED_LOG: 'WS 网关已初始化，ID: {{gatewayId}}',
      WS_GATEWAY_SHUTTING_DOWN_LOG: 'WS 网关正在关闭。',
      NEW_CONNECTION_WAITING_AUTH_REQ_LOG: '已建立新连接。正在等待 AUTH_REQ...',
      USER_DISCONNECTED_LOG: '用户 {{userId}} 已断开连接。',
      TERMINATING_ZOMBIE_CONNECTION_LOG: '正在终止僵尸连接，用户: {{userId}}',
      UNHANDLED_COMMAND_LOG: '未处理的命令：0x{{cmd}}',
      USER_AUTHENTICATED_ON_DEVICE_LOG:
        '用户 {{userId}} 在设备 {{deviceId}} 上认证成功',
      AUTH_FAILED_LOG: '认证失败：{{errorMessage}}',
      FAILED_TO_INGEST_MSG_UP_LOG: '处理 MSG_UP 失败：{{errorMessage}}',
      FAILED_TO_INGEST_READ_RECEIPT_LOG:
        '处理 READ_RECEIPT 失败：{{errorMessage}}',
      REPORTING_USER_OFFLINE_LOG: '正在报告用户离线: {{userId}}',
      FAILED_TO_PUBLISH_OFFLINE_EVENT_LOG: '发布离线事件到 {{subject}} 失败',
      FAILED_TO_PROCESS_TOKEN_REVOCATION: '令牌撤销事件处理失败',
      RECEIVED_DOWNBOUND_EVENT_WITHOUT_USERID: '收到没有用户 ID 的下行事件',
      FAILED_TO_DISPATCH_SYNC_EVENT: '向网关分发同步事件失败',
      DECREMENT_FAILED: 'Redis 中 IP 连接计数器递减失败',
      FLOOD_REJECTED:
        '连接洪水攻击被拒绝。IP {{ip}} 的连接数超过了 {{limit}} 的限制。',
      REDIS_ERROR_FAIL_OPEN:
        'IP 速率限制期间 Redis 出错。允许连接（失败打开）。',
      OVERSIZED_PAYLOAD_TERMINATED_LOG:
        '接收到过大的有效载荷，为防止内存溢出，已终止连接。',
      ZOMBIE_ROUTE_DETECTED_LOG:
        'user:{{userId}}-device:{{deviceId}} 检测到僵尸路线。发出离线事件以恢复在线状态。',
      ZOMBIE_DEVICE_ROUTE_DETECTED_LOG:
        'user:{{userId}}-device:{{deviceId}} 检测到僵尸设备路由。正在发出离线事件以恢复在线状态。',
      SENT_HEARTBEATS_LOG:
        '已向 {{count}} 个已验证的活动连接发送全球在线状态心跳。',
      RATE_LIMIT_EXCEEDED: '超出速率限制。',
      PING_PAYLOAD_NOT_EMPTY: 'PING 有效载荷必须为空。',
      INVALID_OR_EXPIRED_TOKEN: '无效或过期的令牌',
      PROTOCOL_VERSION_MISMATCH: '协议版本不匹配',
      CACHE_LOCK_TIMEOUT_PREVENT_STAMPEDE:
        '缓存锁等待超时。抛出错误以防止数据库雪崩。',
      CACHE_LOCK_TIMEOUT_CAUSE:
        '等待键为 {{key}} 的缓存锁超时。可能存在数据库性能瓶颈或锁饥饿。',
      Seeding_Permissions_Skipped: '另一个实例正在初始化权限。跳过...',
      Seeding_Permissions_Started: '获取到锁。开始向数据库初始化角色和权限...',
      Watchdog_Renew_Permission_Lock_Failed: '看门狗续期权限初始化锁 TTL 失败',
      Watchdog_Renew_Permission_Lock_Success: '看门狗成功续期权限初始化锁',
      Seeding_Permissions_Success: '成功初始化角色和权限。',
      Seeding_Permissions_Failed: '初始化角色和权限失败',
      Release_Permission_Lock_Failed: '安全释放权限初始化锁失败',
      DIRECT_MESSAGE_REQUIRES_TWO_USERS: '私聊需要正好两个用户',
      USER_NOT_FOUND: '未找到用户',
      DIRECT_MESSAGE_FALLBACK_NAME: '私聊',
      FAILED_TO_INSERT_GROUP_MEMBERS: '插入群组成员失败',
      CONCURRENT_DM_CREATION_DETECTED:
        '检测到私聊并发创建冲突。正在优雅地返回已存在的群组。',
      FAILED_TO_RELEASE_IDEMPOTENCY_LOCK_STATUS:
        '在返回非成功状态码后释放幂等性锁失败',
      FAILED_TO_RELEASE_IDEMPOTENCY_LOCK_EXCEPTION:
        '在捕获异常后释放幂等性锁失败',
      JWT_MISSING_EXP_CLAIM: 'JWT 必须包含过期时间 (exp) 声明',
      DETECTED_DUPLICATED_NATS_DELIVERY:
        '检测到重复的 NATS 消息分发，该消息已处理。',
      BAD_REQUEST: '错误的请求',
      RATE_LIMIT_EXCEEDED_BIZ: '用户 {{userId}} 超出了业务速率限制',
      INVALID_MESSAGE_MISSING_ID: '无效消息：缺少 groupId 或 clientMsgId',
      SUCCESSFULLY_ROUTED_MSG_UP: '成功路由 MSG_UP',
      FAILED_TO_PROCESS_MSG_UP: '处理 MSG_UP 失败',
    },
  },
};
