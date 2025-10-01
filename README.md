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
