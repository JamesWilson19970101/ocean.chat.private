import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { InjectConnection } from '@nestjs/mongoose';
import {
  DomainException,
  ErrorCodes,
  InfrastructureException,
  isAppException,
} from '@ocean.chat/common-exceptions';
import { I18nService } from '@ocean.chat/i18n';
import { Group, GroupRepository, User } from '@ocean.chat/models';
import {
  CreateRoomRpcRequest,
  CreateRoomRpcResponse,
  GroupType,
} from '@ocean.chat/types';
import { Connection } from 'mongoose';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { catchError, firstValueFrom, timeout } from 'rxjs';

@Injectable()
export class OceanchatGroupService {
  constructor(
    private readonly groupRepository: GroupRepository,
    @Inject('USER_SERVICE') private readonly userClient: ClientProxy,
    private readonly i18nService: I18nService,
    @InjectConnection() private readonly connection: Connection,
    @InjectPinoLogger(OceanchatGroupService.name)
    protected readonly logger: PinoLogger,
  ) {}

  async createGroup(
    payload: CreateRoomRpcRequest,
  ): Promise<CreateRoomRpcResponse> {
    const { type, name, members, userId } = payload;
    console.log('payload is: ', payload);

    // De-duplicate members, ensure creator is included, and SORT them for determinism.
    const uniqueMembers = [...new Set([...members, userId])].sort();

    // Generate deterministic hash for DM uniqueness
    const dmIdentifier =
      type === GroupType.DIRECT ? uniqueMembers.join(':') : undefined;

    // Check for Direct Message member count
    if (type === GroupType.DIRECT) {
      if (uniqueMembers.length !== 2) {
        throw new DomainException(
          this.i18nService.translate('DIRECT_MESSAGE_REQUIRES_TWO_USERS'),
          ErrorCodes.UNEXPECTED_ERROR,
          HttpStatus.BAD_REQUEST,
        );
      }

      // Fast path check: does a DM already exist?
      // Use lean() for read operations
      const existingDm = await this.groupRepository.findOne({
        type: GroupType.DIRECT,
        $or: [
          { dmIdentifier }, // Fast check with new index
          { participantIds: { $all: uniqueMembers } }, // Fallback for old records
        ],
      });

      if (existingDm) {
        return {
          groupId: String(existingDm._id),
          type: existingDm.type,
          name: existingDm.name,
        };
      }
    }

    // Call USER_SERVICE to validate uniqueMembers and get their snapshots
    const users = await this.validateAndFetchUsers(uniqueMembers);

    // Safe to assert 'creator' exists because validateAndFetchUsers ensures ALL uniqueMembers exist.
    const creator = users.find((u) => String(u._id) === userId)!;

    const session = await this.connection.startSession();
    session.startTransaction();

    let savedGroup: Group;
    try {
      // Create the Group Document
      const groupPayload: Partial<Group> = {
        type,
        name: type === GroupType.PRIVATE_GROUP ? name : undefined,
        u: {
          _id: String(creator._id),
          username: creator.username,
          name: creator.name,
          avatarETag: creator.avatarETag,
        },
        membersCount: uniqueMembers.length,
        sysMsgEnabled: true,
        participantIds: type === GroupType.DIRECT ? uniqueMembers : undefined,
        dmIdentifier,
      };

      savedGroup = await this.groupRepository.create(groupPayload, { session });

      // Create the GroupMember documents
      const groupMembers = users.map((user) => {
        const isCreator = String(user._id) === userId;
        // Determine roles
        const roles: string[] = [];
        if (type === GroupType.PRIVATE_GROUP && isCreator) {
          roles.push('owner');
        }

        // Determine the specific group name to display for this user
        // For DM, we show the OTHER person's name. For Group, we show the Group name.
        let displayGroupName = name || '';
        if (type === GroupType.DIRECT) {
          const otherUser = users.find(
            (u) => String(u._id) !== String(user._id),
          );
          displayGroupName = otherUser
            ? otherUser.name || otherUser.username
            : this.i18nService.translate('DIRECT_MESSAGE_FALLBACK_NAME');
        }

        return {
          groupId: String(savedGroup._id),
          user: {
            _id: String(user._id),
            username: user.username,
            name: user.name,
            avatarETag: user.avatarETag,
          },
          type,
          name: displayGroupName,
          roles,
        };
      });

      await this.groupRepository.insertManyMembers(groupMembers, { session });
      await session.commitTransaction();
    } catch (error: unknown) {
      await session.abortTransaction();

      const err = error as { code?: number };

      // Gracefully handle concurrent DM creation hitting the unique index
      if (err?.code === 11000 && type === GroupType.DIRECT) {
        this.logger.warn(
          { dmIdentifier },
          this.i18nService.translate('CONCURRENT_DM_CREATION_DETECTED'),
        );
        const existingDm = await this.groupRepository.findOne({ dmIdentifier });
        if (existingDm) {
          return {
            groupId: String(existingDm._id),
            type: existingDm.type,
            name: existingDm.name,
          };
        }
      }

      this.logger.error(
        { err: error },
        this.i18nService.translate('FAILED_TO_INSERT_GROUP_MEMBERS'),
      );
      throw new InfrastructureException(
        this.i18nService.translate('INTERNAL_SERVER_ERROR'),
        ErrorCodes.UNEXPECTED_ERROR,
        HttpStatus.INTERNAL_SERVER_ERROR,
        false,
        { cause: error },
      );
    } finally {
      await session.endSession();
    }

    return {
      groupId: String(savedGroup._id),
      type: savedGroup.type,
      name: savedGroup.name,
    };
  }

  private async validateAndFetchUsers(userIds: string[]): Promise<User[]> {
    const users = await firstValueFrom(
      this.userClient
        .send<User[]>('user.query.profiles.bulk', { userIds })
        .pipe(
          timeout(5000),
          catchError((err) => {
            if (isAppException(err)) {
              throw err;
            }
            throw new InfrastructureException(
              this.i18nService.translate('INTERNAL_SERVER_ERROR'),
              ErrorCodes.UNEXPECTED_ERROR,
              HttpStatus.INTERNAL_SERVER_ERROR,
              false,
              { cause: err },
            );
          }),
        ),
    );

    // Check if all requested users were found
    // Since userIds is pre-deduplicated, comparing lengths is safe and efficient
    if (!users || users.length !== userIds.length) {
      throw new DomainException(
        this.i18nService.translate('USER_NOT_FOUND'),
        ErrorCodes.USER_NOT_FOUND,
        HttpStatus.NOT_FOUND,
      );
    }

    return users;
  }
}
