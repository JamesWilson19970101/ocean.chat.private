# JWT Key Generation

To support Ocean Chat's Zero-I/O Authentication and JWT Hybrid Mode (which relies on RS256 asymmetric cryptography), must generate the necessary cryptographic keys before starting the platform.
Run the following script to generate the RSA public/private key pairs `node @scripts/generate-jwt-keys.js`, This script creates the keys needed by the oceanchat-auth service (private keys for signing tokens) and the oceanchat-api-gateway (public keys for local, stateless verification).
