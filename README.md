# ocean.chat.private

An IM platform you can fully trust.

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ yarn install
```

## mongodb setup

Firstly specify the replica set name in mongod.conf.

```
replication:
  replSetName: "ocrs0"
```

Then initiate replica set.

```js
rs.initiate(); // should set replica set first to watch change stream.
```

## Compile and run the project

```bash
# run with watch mode
# Notice: This command will first execute nest build. By default, nest build will use tsc to build the code in all root directories, so the code under the packages will be automatically built into dist. So the turbo build command currently does not play a role in the running process of the project.
$ yarn run start:dev

# production mode
$ yarn run start:prod
```

## Run tests

```bash
# unit tests
$ yarn run test

# e2e tests
$ yarn run test:e2e

# test coverage
$ yarn run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ yarn install -g mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

# file structure

```
src/
├── app.module.ts             # 根模块
├── app.controller.ts         # 根控制器 (可选，用于处理全局路由等)
├── app.service.ts            # 根服务 (可选，用于处理全局业务逻辑等)
├── auth/                     # 认证模块 (登录相关功能)
│   ├── auth.module.ts        # 认证模块
│   ├── auth.controller.ts    # 认证控制器，处理登录相关的 HTTP 请求
│   ├── auth.service.ts       # 认证服务，处理登录相关的业务逻辑
│   ├── strategies/           # 认证策略目录 (不同的登录方式)
│   │   ├── jwt.strategy.ts   # JWT 认证策略
│   │   ├── google.strategy.ts # Google 认证策略
│   │   └── wechat.strategy.ts # 微信认证策略
│   ├── guards/               # 认证守卫目录 (保护路由)
│   │   └── jwt-auth.guard.ts # JWT 认证守卫
│   ├── dtos/                 # DTO 目录 (数据传输对象)
│   │   ├── login.dto.ts      # 登录请求数据结构
│   │   └── register.dto.ts   # 注册请求数据结构
│   └── interfaces/           # 接口定义目录
│       └── auth.interface.ts  # 认证接口
├── assets/                   # The assets should be located in the src folder otherwise they will not be copied. https://docs.nestjs.com/cli/monorepo#assets
├── users/                    # 用户模块 (可选，如果需要用户信息管理)
│   ├── users.module.ts       # 用户模块
│   ├── users.controller.ts   # 用户控制器
│   └── users.service.ts      # 用户服务
├── common/                   # 公共模块 (可复用的工具、装饰器等)
│   └── filters/             # 全局错误处理filter
│       └── http-exception.filter.ts
├── config/                   # 配置模块
│       └── configuration.ts  # 配置项
└── main.ts                   # 应用入口
```
