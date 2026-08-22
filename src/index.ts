import { createSchema, createYoga } from "graphql-yoga";
import { readFileSync } from "fs";
import { join } from "path";
import { createContext, GraphQLContext } from "./graphql/context";
import { resolvers } from "./graphql/resolvers";

const typeDefs = readFileSync(
  join(process.cwd(), "src", "graphql", "schema.graphql"),
  "utf-8"
);

const schema = createSchema<GraphQLContext>({
  typeDefs,
  resolvers,
});

const yoga = createYoga<GraphQLContext>({
  schema,
  context: createContext,
  graphqlEndpoint: "/graphql",
});

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;

const server = Bun.serve({
  port,
  fetch: (request) => yoga.handle(request),
});

console.log(`Document Vault GraphQL API running at http://localhost:${server.port}/graphql`);
