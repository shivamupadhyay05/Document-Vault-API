import { createSchema, createYoga } from "graphql-yoga";
import { readFileSync } from "fs";
import { join } from "path";
import { createContext, GraphQLContext } from "./graphql/context";

const typeDefs = readFileSync(
  join(process.cwd(), "src", "graphql", "schema.graphql"),
  "utf-8"
);

const resolvers = {
  Query: {
    collections: () => {
      throw new Error("Not implemented");
    },
    collection: () => {
      throw new Error("Not implemented");
    },
    documents: () => {
      throw new Error("Not implemented");
    },
  },
  Mutation: {
    createCollection: () => {
      throw new Error("Not implemented");
    },
    createDocument: () => {
      throw new Error("Not implemented");
    },
    updateDocument: () => {
      throw new Error("Not implemented");
    },
    deleteDocument: () => {
      throw new Error("Not implemented");
    },
    moveDocument: () => {
      throw new Error("Not implemented");
    },
  },
};

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
