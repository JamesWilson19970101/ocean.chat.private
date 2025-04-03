import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import { Admin } from 'mongodb';
import { Connection, ConnectionStates } from 'mongoose';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { getWatchCollections } from './utils/getWatchCollections';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private retryCounts: number = 0;
  private isReplicaSet: boolean = false;
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectPinoLogger('database.module') private readonly logger: PinoLogger,
    private readonly configService: ConfigService,
  ) {}
  async onModuleInit(): Promise<void> {
    this.logger.info('DatabaseService initialized.');
    try {
      const admin: Admin | undefined = this.connection.db?.admin();
      const serverInfo = await admin?.command({ hello: 1 });

      if (serverInfo && serverInfo.setName) {
        this.isReplicaSet = true;
        // TODO: specify log detail
        this.logger.info('MongoDB is running as replica set.');
        this.watchChangeStream();
      } else {
        this.isReplicaSet = false;
        const errorMessage: string =
          'CRITICAL: MongoDB is NOT running as a replica set. Change Streams are required but cannot be initialized. Application will exit.';
        this.logger.error(errorMessage);
        throw new Error(errorMessage);
      }
    } catch (error) {
      const errorMessage =
        'Failed to check MongoDB server status or initialize Change Streams due to an error.';
      this.isReplicaSet = false;
      // stop starting Application
      throw new Error(
        `${errorMessage} Original error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
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
