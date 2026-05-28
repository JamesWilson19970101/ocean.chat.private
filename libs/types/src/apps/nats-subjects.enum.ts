export enum NatsSubjects {
  // IM_CORE (Gateway upstream ingress stream)
  IM_UP_GROUP = 'im.up.group',
  IM_UP_P2P = 'im.up.p2p',
  IM_UP_RECEIPT = 'im.up.receipt',

  // IM_HANDOFF (Internal routing and WAL core stream)
  IM_ROUTE_GROUP = 'im.route.group',
  IM_ROUTE_P2P = 'im.route.p2p',
  IM_ORCHESTRATE_MSG = 'im.orchestrate.msg',

  // IM_DOWNBOUND (Real-time online downbound stream)
  // Prefix for dynamic gateway subject: im.down.node.{gatewayId}
  IM_DOWN_NODE_PREFIX = 'im.down.node.',

  // OFFLINE_PUSH (Third-party push stream)
  // Prefix for dynamic vendor/user subject: push.offline.{vendor}.{userId}
  PUSH_OFFLINE_PREFIX = 'push.offline.',

  // CURSOR_STATE (Cursor state persistence stream)
  // Prefix for cursor state: cursor.read.{groupId}.{userId}
  CURSOR_READ_PREFIX = 'cursor.read.',

  // DEVICE_SYNC (Device synchronization stream)
  // Prefix for device sync: sync.cursor.read.{userId}
  SYNC_CURSOR_READ_PREFIX = 'sync.cursor.read.',

  // BACKGROUND_TASKS (Multimedia and audit stream)
  TASK_MEDIA_TRANSCODE = 'task.media.transcode',
  TASK_AUDIT_NSFW = 'task.audit.nsfw',

  // DLQ
  DLQ_PREFIX = 'dlq.',
}

export const getImDownNodeSubject = (gatewayId: string) =>
  `${NatsSubjects.IM_DOWN_NODE_PREFIX}${gatewayId}`;

export const getPushOfflineSubject = (vendor: string, userId: string) =>
  `${NatsSubjects.PUSH_OFFLINE_PREFIX}${vendor}.${userId}`;

export const getCursorReadSubject = (groupId: string, userId: string) =>
  `${NatsSubjects.CURSOR_READ_PREFIX}${groupId}.${userId}`;

export const getSyncCursorReadSubject = (userId: string) =>
  `${NatsSubjects.SYNC_CURSOR_READ_PREFIX}${userId}`;
