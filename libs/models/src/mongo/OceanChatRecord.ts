export interface OceanChatRecord {
  _id: string;
  _updatedAt: Date;
}

export type StreamData<T> = {
  id: string;
  action: 'insert' | 'update' | 'remove';
  clientAction: 'inserted' | 'updated' | 'removed';
  data?: T;
  diff?: Record<string, any>;
  unset?: Record<string, number>;
  oplog?: true;
};
