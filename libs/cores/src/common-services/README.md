# Services under this document

Based on the principle of separation of concerns, some functionalities are more suitable for service A, but from a performance perspective, service B should ideally also have these functionalities.

Therefore, I extracted these types of functions to this folder.

> for example:
>
> **Separation of Concerns (SoC) Perspective(validate password in oceanchat-user service):**
>
> Principle: The User Service owns user data, therefore only it should know how passwords are stored, encrypted, and verified. The Auth Service should only be responsible for "issuing tokens" and should not be concerned with "database queries."
>
> Advantages: Clear architectural boundaries. If the password hash algorithm is changed in the future (e.g., from Argon2 to bcrypt), only the User Service needs to be modified; the Auth Service does not need to be redeployed.
>
> Disadvantages: Login is a high-frequency and critical path, heavily reliant on the availability of the User Service. If the User Service goes down, or slows down due to handling a large number of user information queries, the login function will be completely paralyzed.
>
> **Performance and Usability Perspective(validate password in oceanchat-auth service):**
>
> Principle: Login (Authentication) itself is the core responsibility of the Auth Service. Verifying credentials is part of authentication.
>
> Performance Bottleneck: Network I/O: The latency of RPC (1-2ms) is almost negligible compared to the Argon2 hash calculation time (typically 50-500ms). Therefore, "network performance" is not the primary concern.
>
> CPU Isolation (Key Point): Password hashing is a CPU-intensive operation. If placed in the User Service, a large number of login requests will consume the User Service's CPU resources, slowing down normal user profile lookups.
>
> Advantage: Fault isolation. By placing the "recalculation" hashing logic in the Auth Service, even if login requests fully utilize the Auth Service's CPU, it will not affect the normal operation of logged-in users in the User Service.
>
> > The above is just to illustrate the necessity of this folder's existence.However, on the one hand, my user base hasn't reached a performance bottleneck yet, so I plan to maintain the current state. On the other hand, if `validatePassword` reaches a performance bottleneck in the future, I will evolve towards the IdP mode.
