# Identity & Access Management (IAM) Service

This service provide following features:

1. Authentication
   - "Who are you?" Handles login, registration, and OAuth.
   - Issues JWT tokens.
2. Authorization Management - "Defining who can do what"
   - Manages the `Roles` table: Creates, deletes, modifies, and queries system roles.
   - Manages the `Permissions` table: Initializes and updates permission points.
   - Manages the `Users-Roles` relationship: Handles global role assignment for users.
