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
      ENVIRONMENT_PRODUCTION: 'Production',
      ENVIRONMENT_DEVELOPMENT: 'Development',
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
      ENVIRONMENT_PRODUCTION: '生产环境',
      ENVIRONMENT_DEVELOPMENT: '开发环境',
    },
  },
};
