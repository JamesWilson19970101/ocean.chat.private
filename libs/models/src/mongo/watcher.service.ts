import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nService } from '@ocean.chat/i18n';
import { EventEmitter } from 'events';
import {
  ChangeStreamDeleteDocument,
  ChangeStreamInsertDocument,
  ChangeStreamUpdateDocument,
  Db,
} from 'mongodb';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { DatabaseService } from './mongo.service';
import type { OceanChatRecord } from './OceanChatRecord'; // Adjust the import path as necessary
import { UtilsService } from './utils.service';

// TODO: find a way to prevent multiple connections from broadcasting the same changes
@Injectable()
export class DatabaseWatcher extends EventEmitter implements OnModuleInit {
  constructor(
    private readonly i18nService: I18nService,
    @InjectPinoLogger('ocean.chat.models.watcher')
    private readonly logger: PinoLogger,
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
    private readonly utilsService: UtilsService,
  ) {
    super();
  }

  async onModuleInit() {
    try {
      this.logger.info('Initializing DatabaseWatcher...');
      const db = await this.databaseService.getConnection();
      const collectionsToWatch = this.databaseService.getWatchCollectionNames();

      if (collectionsToWatch.length === 0) {
        this.logger.warn(
          'No collections configured to be watched. DatabaseWatcher will be idle.',
        );
        return;
      }

      this.watchStream(db, collectionsToWatch);
    } catch (error) {
      this.logger.error(
        { err: error },
        'Failed to initialize DatabaseWatcher during onModuleInit.',
      );
    }
  }
  /**
   * Watches the specified collections in the database for changes.
   * @param db - The MongoDB database instance.
   * @param collectionNames - An array of collection names to watch.
   */
  private watchStream(db: Db, collectionNames: string[]): void {
    try {
      this.logger.info(
        this.i18nService.translate('Watching_Collection', {
          collections: collectionNames.join(', '),
        }),
      );
      // The generic parameters help TypeScript understand the shape of the change events.
      const watchStream = db.watch<
        OceanChatRecord,
        | ChangeStreamInsertDocument<OceanChatRecord>
        | ChangeStreamUpdateDocument<OceanChatRecord>
        | ChangeStreamDeleteDocument<OceanChatRecord>
      >(
        [
          {
            $match: {
              operationType: { $in: ['insert', 'update', 'delete'] },
              'ns.coll': { $in: collectionNames },
            },
          },
        ],
        { fullDocument: 'updateLookup' },
      ); // Use 'updateLookup' to get the full document on updates

      watchStream.on('change', (change) => {
        this.logger.info({ change }, 'Database change detected');
        // You can also emit typed events here for other services to consume
        this.emit(
          change.ns.coll,
          this.utilsService.convertChangeStreamPlayload(change),
        );
      });

      watchStream.on('error', (error) => {
        this.logger.error(
          { err: error },
          'Change stream encountered an error.',
        );
        // Here you might want to implement a reconnection logic
      });
    } catch (error) {
      this.logger.error(
        { err: error },
        'Failed to start the change stream. Please ensure MongoDB is running as a replica set.',
      );
    }
  }
}
