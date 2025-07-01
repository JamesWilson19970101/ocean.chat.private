import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Db, MongoClient, MongoClientOptions } from 'mongodb';

import { UserRepository } from '../repositories/user.repository';

@Injectable()
export class DatabaseService {
  private clientPromise: Promise<MongoClient> | null = null;
  private dbInstance: Db;

  constructor(
    private userRepo: UserRepository,
    private configService: ConfigService,
  ) {}

  /**
   * Connects to the MongoDB database using the provided URI from the configuration service.
   * @param options - Optional MongoDB client options.
   * @returns A promise that resolves to a connected MongoClient instance.
   * If the connection fails, it logs the error and exits the process.
   */
  connectDb(options?: MongoClientOptions): Promise<MongoClient> {
    const uri = this.configService.get<string>('database.uri') as string;
    const name = this.configService.get<string>('database.name') as string;
    const client = new MongoClient(`${uri}/${name}`, options);

    return client.connect().catch((error) => {
      // exits the process in case of any error
      console.error(error);
      // Firstly, I want to excute process.exit(1) to ensure that the process exits immediately. But this operation ignore the following item:
      // Separation of Concerns: the responsibility od DatabaseService is to manage the database connection, not to handle process termination. If conenection fails, it should not directly control the application lifecycle, just tell callers that the connection failed.
      // Testability: It is not friendly for testing. If the service throws an error, it can be caught and handled in the test environment, allowing for more flexible error handling and assertions.
      // Resiliency & Recoverability: Exit directly means once the connection fails, the application stops. Sometimes, failures is just temporary.
      // This throw is crucial for testing, as it ensures the promise is rejected.
      throw error;
    });
  }
  /**
   * Retrieves the names of the collections that the service is watching.
   * @returns An array of collection names that the service is watching.
   * Currently, it only includes the user repository's collection name.
   */
  getWatchCollectionNames(): string[] {
    return [this.userRepo.getCollectionName()];
  }

  /**
   * Retrieves a connection to the MongoDB database.
   * If a connection already exists, it returns that instance.
   * If not, it creates a new connection using the `connectDb` method.
   * <B>Note:</B> If the first call to `getConnection` is made but the connection haven't been established yet, subsequent calls to `getConnection` will wait for the first call to resolve or reject, if connect successfully, all calls share the same MongoClient instance, if connection fails, suspended calls will reestablish the connection and try to connect again.
   * @returns A promise that resolves or rejects to the MongoDB database instance.
   */
  async getConnection(): Promise<Db> {
    if (this.dbInstance) {
      return this.dbInstance;
    }

    // If the client promise is not set, create a new connection
    // This ensures that we only create one connection to the database because this is synchronous
    // This.clientPromise play a crucial role in ensuring that we do not create multiple connections, like a lock. When the first call to getConnection is made, it initializes this.clientPromise with the result of connectDb. Subsequent calls to getConnection will wait for this.clientPromise to resolve, ensuring that they all share the same MongoClient instance.
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    if (!this.clientPromise) {
      this.clientPromise = this.connectDb();
    }

    // prevent multiple connections from holding the rejected MongoClient
    try {
      // All connections will from sharing the same MongoClient instance here.
      const client = await this.clientPromise;
      this.dbInstance = client.db();
      return this.dbInstance;
    } catch (error) {
      this.clientPromise = null;
      throw error;
    }
  }
}
