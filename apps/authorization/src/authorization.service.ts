import { Injectable } from '@nestjs/common';
import { Enforcer } from 'casbin';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@Injectable()
export class AuthorizationService {
  private enforcer: Enforcer;

  constructor(
    @InjectPinoLogger('authorization.authorization.module')
    private readonly logger: PinoLogger,
  ) {}
  getHello(): string {
    return 'Hello World!';
  }
}
