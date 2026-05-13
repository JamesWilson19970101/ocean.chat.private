<p align="center">
  <img  src="https://github.com/JamesWilson19970101/ocean.chat.Artwork/blob/main/logos/logo.svg" data-canonical-src="https://github.com/JamesWilson19970101/ocean.chat.Artwork/blob/main/logos/logo.svg" width="400" />
</p>

<h1 align="center">
  Ocean Chat -- An IM platform you can fully trust.
</h1>

[doc](https://jameswilson19970101.github.io/ocean.chat.docs/docs/devdocs/monkey-protocol-spec) | [文档](https://jameswilson19970101.github.io/ocean.chat.docs/zh-CN/docs/devdocs/microservice)

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
