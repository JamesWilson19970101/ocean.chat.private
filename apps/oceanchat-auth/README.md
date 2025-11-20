# Identity & Access Management (IAM) Service

This service provide following features:

1. Authentication
   - "Who are you?" Handles login, registration, and OAuth.
   - Issues JWT tokens.
2. Authorization Management - "Defining who can do what"
   - Manages the `Roles` table: Creates, deletes, modifies, and queries system roles.
   - Manages the `Permissions` table: Initializes and updates permission points.
   - Manages the `Users-Roles` relationship: Handles global role assignment for users.

## Exception defense mechanism

1. Initialization phase: Includes `bootstrap().catch` and `process.exit(1)` as a fallback, and logs are forced to be in JSON format.
2. Request processing phase: A complete closed loop is formed using `AllExceptionsFilter`, and `ValidationPipe`.
3. Asynchronous/runtime phase: A global listener `process.on` prevents silent process crashes.
4. Operation phase: OpenTelemetry tracing, a unified JSON log format, and graceful shutdown ensure an impeccable performance from the SRE team.
