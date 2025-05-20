import { Injectable, OnModuleInit } from '@nestjs/common';
import { Enforcer, newEnforcer } from 'casbin';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { join } from 'path';

@Injectable()
export class AuthorizationService implements OnModuleInit {
  private enforcer: Enforcer;

  constructor(
    @InjectPinoLogger('authorization.authorization.module')
    private readonly logger: PinoLogger,
  ) {}

  async onModuleInit() {
    const modelPath = join(__dirname, '/authorization_assets/model.conf'); // Adjust path relative to dist/
    this.logger.info(`Using Casbin model from: ${modelPath}`);
    this.enforcer = await newEnforcer(modelPath);
    // // TODO: find policies from mongodb
    // // demo: https://casbin.org/docs/management-api/#addpolicies
    // const permissions = [['admin', 'menu', '/admin', 'view']];
    // await this.enforcer.addPolicies(permissions);
    // await this.enforcer.addGroupingPolicies([['james', 'admin']]);
    // this.logger.info('Casbin policies loaded');
  }

  getHello(): string {
    return 'Hello World!';
  }
}
