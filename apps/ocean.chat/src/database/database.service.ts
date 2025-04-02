import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, ConnectionStates } from 'mongoose';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { getWatchCollections } from './utils/getWatchCollections';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private retryCounts: number = 0;
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectPinoLogger('database.module') private readonly logger: PinoLogger,
    private readonly configService: ConfigService,
  ) {}
  onModuleInit() {
    this.logger.info('DatabaseService initialized.');
    this.watchChangeStream();
  }
  watchChangeStream(resumeObject?: unknown) {
    try {
      if (this.connection.readyState !== ConnectionStates.connected) {
        this.logger.warn(
          'MongoDB connection not ready yet, delaying change stream initialization.',
        );
        // set a short delay to retry a connection event
        setTimeout(() => this.watchChangeStream(), 1000);
        return;
      }
      this.logger.info('Attempting to start MongoDB change stream...');

      const options: Record<string, any> = {};
      if (this.configService.get<string>('database.fullDocument')) {
        options.fullDocument = 'updateLookup';
      }
      if (resumeObject) {
        options.startAfter = resumeObject;
      }

      // define watch collections
      const watchCollections: string[] = getWatchCollections();

      let resume: unknown;

      // Monitor changes in the entire database
      const changeStream = this.connection.watch(
        [
          {
            $match: {
              operationType: { $in: ['insert', 'update', 'delete'] },
              'ns.coll': { $in: watchCollections },
            },
          },
        ],
        options,
      );

      changeStream.on('change', (change) => {
        resume = change._id;
        switch (change.operationType) {
          case 'insert':
            return { operation: 'insert', doc: change.fullDocument };
        }
      });

      changeStream.on('error', (error) => {
        this.logger.error(error, 'Change stream error.');
        setTimeout(
          () => {
            this.watchChangeStream(resume);
          },
          (this.retryCounts + 1) * 1000,
        );
      });
    } catch (error: unknown) {
      this.logger.fatal(error, 'Somthing goes error when watch change stream.');
    }
  }
}
