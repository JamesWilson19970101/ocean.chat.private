/**
 * @fileoverview
 * Minimal Room Data required for Authorization Checks.
 *
 * Decoupling Strategy:
 * The Authorization Library doesn't need to know the full Room Entity structure.
 * It only needs specific fields to make decisions (e.g. is it public? is it a team?).
 */
export interface IRoomContext {
  _id: string;
  t: 'c' | 'p' | 'd' | 'l'; // Type: c(channel), p(private), d(direct), l(livechat)
  teamId?: string; // If belongs to a team
  prid?: string; // Parent Room ID (for discussions)
}

/**
 * Interface for individual validator strategies.
 */
export interface IRoomValidator {
  /**
   * Validates if the user has access to the room based on specific logic.
   * @returns true if access is granted, false if this validator cannot grant access (continue chain).
   */
  validate(userId: string, room: IRoomContext): Promise<boolean>;
}

/**
 * Provider to fetch Team information.
 * Implemented by Group Service.
 */
export abstract class ITeamDataProvider {
  abstract getTeamType(teamId: string): Promise<'PUBLIC' | 'PRIVATE' | null>;
  abstract isTeamMember(userId: string, teamId: string): Promise<boolean>;
}

/**
 * Provider to fetch Parent Room information.
 * Implemented by Group Service.
 */
export abstract class IRoomDataProvider {
  abstract getRoomContext(roomId: string): Promise<IRoomContext | null>;
}
