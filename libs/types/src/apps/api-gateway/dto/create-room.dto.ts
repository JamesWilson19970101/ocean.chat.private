import { GroupType } from '@ocean.chat/types';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class CreateRoomDto {
  /**
   * The type of room to create.
   * We only support DIRECT ('d') and PRIVATE_GROUP ('p') currently.
   */
  @IsEnum([GroupType.DIRECT, GroupType.PRIVATE_GROUP])
  type: GroupType;

  /**
   * The name of the room.
   * Required for PRIVATE_GROUP, optional/ignored for DIRECT.
   */
  @ValidateIf((o: CreateRoomDto) => o.type === GroupType.PRIVATE_GROUP)
  @IsString()
  @MaxLength(100)
  name?: string;

  /**
   * List of user IDs to invite/add to the room.
   * For DIRECT ('d'), it should contain exactly 1 member (the other participant).
   */
  @IsArray()
  @IsString({ each: true })
  @ValidateIf((o: CreateRoomDto) => o.type === GroupType.DIRECT)
  @ArrayNotEmpty({
    message: 'Direct message requires a target user in the members array',
  })
  members: string[];
}
