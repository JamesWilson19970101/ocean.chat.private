import { Injectable } from '@nestjs/common';
import type {
  ChangeStreamDeleteDocument,
  ChangeStreamInsertDocument,
  ChangeStreamUpdateDocument,
} from 'mongodb';

import type { OceanChatRecord, StreamData } from './OceanChatRecord';

@Injectable()
export class UtilsService {
  /**
   * Converts a MongoDB change stream payload into a standardized stream data format.
   * @param playload Change stream payload from MongoDB.
   * This can be an insert, update, or delete operation.
   * @returns A standardized StreamData object containing the operation details.
   */
  convertChangeStreamPlayload(
    playload:
      | ChangeStreamInsertDocument<OceanChatRecord>
      | ChangeStreamUpdateDocument<OceanChatRecord>
      | ChangeStreamDeleteDocument<OceanChatRecord>,
  ): StreamData<OceanChatRecord> {
    switch (playload.operationType) {
      case 'insert':
        return {
          id: playload.documentKey._id.toString(),
          action: 'insert',
          clientAction: 'inserted',
          data: playload.fullDocument,
          oplog: true,
        };
      case 'update':
        return {
          id: playload.documentKey._id.toString(),
          action: 'update',
          clientAction: 'updated',
          data: playload.fullDocument,
          diff: {
            ...playload.updateDescription?.updatedFields,
            ...(playload.updateDescription?.removedFields || []).reduce(
              (acc, removeField) => {
                return {
                  ...acc,
                  [removeField]: undefined, // Assuming removed fields should be set to null
                };
              },
              {},
            ),
          },
          unset: (playload.updateDescription?.removedFields || []).reduce(
            (acc, removeField) => {
              return {
                ...acc,
                [removeField]: 1,
              };
            },
            {},
          ),
          oplog: true,
        };
      case 'delete':
        return {
          id: playload.documentKey._id.toString(),
          action: 'remove',
          clientAction: 'removed',
          oplog: true,
        };
      default:
        throw new Error('Unknown operation type');
    }
  }
}
