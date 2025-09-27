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
    },
  },
};
