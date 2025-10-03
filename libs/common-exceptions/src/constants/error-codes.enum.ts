/**
 * Defines business-specific error codes for the application.
 */
export enum ErrorCodes {
  USERNAME_ALREADY_EXISTS = 10001, // e.g., when trying to register with an existing username
  // username validation errors
  USERNAME_TOO_SHORT = 10002, // e.g., less than 3 characters
  USERNAME_TOO_LONG = 10003, // e.g., more than 20 characters
  USERNAME_INVALID_CHARACTERS = 10004, // e.g., contains special characters not allowed
  // password validation errors
  PASSWORD_TOO_SHORT = 10010, // e.g., less than 8 characters
  PASSWORD_NO_DIGIT = 10011, // e.g., does not contain at least one numeric digit
  PASSWORD_NO_LOWERCASE = 10012, // e.g., does not contain at least one lowercase letter
  PASSWORD_NO_UPPERCASE = 10013, // e.g., does not contain at least one uppercase letter
  PASSWORD_NO_SPECIAL_CHAR = 10014, // e.g., does not contain at least one special character
  // login errors
  INVALID_CREDENTIALS = 10020, // e.g., incorrect username or password

  UNEXPECTED_ERROR = 99999, // e.g., for unexpected errors not covered by other codes
}
