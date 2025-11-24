import { DynamicModule, Global, Module } from '@nestjs/common';
import { ModelDefinition, MongooseModule } from '@nestjs/mongoose';
import {} from '@nestjs/mongoose';

import { OceanModel } from './constants/model.constants';
import {
  MODEL_DEFINITIONS,
  REPOSITORY_MAP,
} from './definitions/schema-repository.definition';

@Global()
@Module({})
export class ModelsModule {
  /**
   * Selectively registers Mongoose schemas and Repositories.
   *
   * @param models List of models to load (e.g. [OceanModel.User, OceanModel.Role])
   */
  static forFeature(models: OceanModel[]): DynamicModule {
    // Filter Schemas
    const schemaDefinitions = models.reduce<ModelDefinition[]>((acc, model) => {
      const definition = MODEL_DEFINITIONS[model];
      if (definition) {
        acc.push(definition);
      } else {
        console.warn(
          `[ModelsModule] No schema definition found for model: ${model}`,
        );
      }
      return acc;
    }, []);

    // Filter Repositories
    const repositories = models
      .map((model) => REPOSITORY_MAP[model])
      .filter((repo): repo is any => !!repo); // Filter out undefined repositories

    return {
      module: ModelsModule,
      imports: [
        // This registers the Schemas with Mongoose for the current context
        MongooseModule.forFeature(schemaDefinitions),
      ],
      providers: [...repositories],
      exports: [
        // Export MongooseModule so services can inject @InjectModel() directly if needed
        // Sometimes need to bypass the repository to perform some very low-level operations.(Although not recommended, it may be necessary for complex aggregation queries)
        MongooseModule,
        // Export Custom Repositories
        ...repositories,
      ],
    };
  }
}
