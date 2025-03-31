# models

Now, I have two options to connect mongodb, one is mongodb, the other is mongoose.

## Mongoose

### pros

- Schema Validation: Mongoose provides a powerful schema definition system. You can define data types, required fields, validation rules, and more. This improves data integrity and reduces the risk of errors.
- Data Modeling: Mongoose's schema system makes it easier to model complex data relationships.
- Middleware: Mongoose offers middleware hooks (pre/post) that allow you to run custom logic before or after database operations. This can be useful for tasks like data transformation, auditing, or triggering other events.
- Simplified Queries: Mongoose provides a more object-oriented way to interact with the database, making queries more readable and maintainable.
- Built-in Validation: Mongoose handles validation automatically, reducing the amount of code you need to write.
- Type Safety: Mongoose schemas, combined with TypeScript, provide a high level of type safety.
- Population: Mongoose's population feature makes it easier to work with related documents.

### Cons

- Performance Overhead: Mongoose adds a layer of abstraction on top of the native driver, which can introduce some performance overhead. This might be noticeable in high-traffic scenarios.
- Less Flexibility: Mongoose's schema system can be restrictive. If you need to use a MongoDB feature that Mongoose doesn't directly support, you might have to drop down to the native driver.
- Learning Curve: Developers need to learn Mongoose's API and concepts.
- Potential for Over-Abstraction: If not used carefully, Mongoose can lead to over-engineered schemas and unnecessary complexity.
- Dependency: Adds another dependency to the project.
- Schema Migrations: Managing schema changes over time can be more complex with Mongoose.
- Not a Drop-in Replacement: Switching to Mongoose would require significant code refactoring.

## Native MongoDB Driver ---- mongodb

### Pros

- Performance: The native MongoDB driver is generally the fastest way to interact with MongoDB. It has minimal overhead and provides direct access to MongoDB's features.
- Flexibility: It offers complete control over MongoDB operations. You can use any MongoDB feature or aggregation pipeline without limitations.
- Lightweight: The driver itself is relatively small and has fewer dependencies compared to Mongoose.
- Direct Mapping: The code directly interacts with MongoDB documents, which can be easier to understand if you're familiar with MongoDB's data model.
- No Schema Enforcement: The current code does not enforce a strict schema. This allows for flexibility in data structure, which can be useful in a rapidly evolving application like Rocket.Chat.

### Cons

- Boilerplate: You often need to write more code for common tasks like validation, data transformation, and handling relationships.
- Schema Management: There's no built-in schema validation. You have to implement it manually if you need it.
- Data Integrity: Without schema enforcement, it's easier to introduce data inconsistencies.
- Code Readability: Complex queries and aggregations can become verbose and harder to read.
- Type Safety: While TypeScript helps, the lack of a strict schema means you can't rely on the database to enforce data types.

**So finally I decide to use mongoose.**
