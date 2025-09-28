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
        'Failed to acquire Redis lock due to breaker/error. Proceeding without lock.',
      Cache_Miss_Lock_Acquired: 'Cache miss, lock acquired. Fetching from DB.',
      Cache_Set_Failed_After_DB:
        'Failed to set cache after DB fetch. Operation still successful.',
      DB_Fetch_Or_Cache_Set_Error:
        'Error fetching from DB or setting cache while holding lock.',
      Lock_Release_Failed:
        'Failed to release Redis lock. It will expire automatically.',
      Cache_Miss_Lock_Not_Acquired:
        'Cache miss, lock not acquired. Waiting and retrying from cache.',
      Cache_Invalidate_Failed:
        'Failed to invalidate setting cache in Redis after DB update.',
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
      Lock_Acquire_Failed:
        '因断路器或错误导致获取 Redis 锁失败，无锁继续执行。',
      Cache_Miss_Lock_Acquired: '缓存未命中，已获取锁，正在从数据库获取。',
      Cache_Set_Failed_After_DB: '数据库获取后设置缓存失败，但操作仍成功。',
      DB_Fetch_Or_Cache_Set_Error: '持有锁期间，从数据库获取或设置缓存时出错。',
      Lock_Release_Failed: '释放 Redis 锁失败，锁将自动过期。',
      Cache_Miss_Lock_Not_Acquired:
        '缓存未命中，未获取到锁，等待后从缓存重试。',
      Cache_Invalidate_Failed: '数据库更新后，使 Redis 缓存失效失败。',
    },
  },
};
