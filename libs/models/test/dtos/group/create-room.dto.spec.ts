import { GroupType } from '@ocean.chat/types';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateRoomDto } from '../../../../types/src/apps/api-gateway/dto/create-room.dto';

describe('CreateRoomDto (Unit)', () => {
  const validateDto = async (payload: any) => {
    const dto = plainToInstance(CreateRoomDto, payload);
    return validate(dto);
  };

  describe('Direct Messages (GroupType.DIRECT)', () => {
    it('should pass when a single member is provided without a name', async () => {
      const errors = await validateDto({
        type: GroupType.DIRECT,
        members: ['user_id_1'],
      });
      expect(errors.length).toBe(0);
    });

    it('should fail when members array is empty', async () => {
      const errors = await validateDto({
        type: GroupType.DIRECT,
        members: [],
      });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints?.arrayNotEmpty).toBeDefined();
    });

    it('should ignore the name property if provided', async () => {
      const errors = await validateDto({
        type: GroupType.DIRECT,
        name: 'This should be ignored',
        members: ['user_id_1'],
      });
      expect(errors.length).toBe(0);
    });
  });

  describe('Private Groups (GroupType.PRIVATE_GROUP)', () => {
    it('should pass when a valid name and empty members are provided', async () => {
      const errors = await validateDto({
        type: GroupType.PRIVATE_GROUP,
        name: 'My Secret Group',
        members: [],
      });
      expect(errors.length).toBe(0);
    });

    it('should fail when name is missing', async () => {
      const errors = await validateDto({
        type: GroupType.PRIVATE_GROUP,
        members: ['user_id_1'],
      });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints?.isString).toBeDefined();
    });

    it('should fail when name is too long', async () => {
      const errors = await validateDto({
        type: GroupType.PRIVATE_GROUP,
        name: 'A'.repeat(101),
        members: [],
      });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints?.maxLength).toBeDefined();
    });
  });

  describe('Invalid Types', () => {
    it('should fail for unsupported group types', async () => {
      const errors = await validateDto({
        type: 'INVALID_TYPE',
        members: ['user_id_1'],
      });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints?.isEnum).toBeDefined();
    });
  });
});
