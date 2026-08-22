import { Collection, Document } from "@prisma/client";
import { GraphQLContext } from "./context";

export const resolvers = {
  Query: {
    collections: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      return ctx.prisma.collection.findMany();
    },
    collection: async (
      _: unknown,
      { id }: { id: string },
      ctx: GraphQLContext
    ) => {
      return ctx.prisma.collection.findUnique({
        where: { id },
      });
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
  Collection: {
    createdAt: (parent: Collection) => {
      return parent.createdAt instanceof Date
        ? parent.createdAt.toISOString()
        : parent.createdAt;
    },
    documents: async (parent: Collection, _: unknown, ctx: GraphQLContext) => {
      return ctx.prisma.document.findMany({
        where: { collectionId: parent.id },
      });
    },
  },
  Document: {
    createdAt: (parent: Document) => {
      return parent.createdAt instanceof Date
        ? parent.createdAt.toISOString()
        : parent.createdAt;
    },
  },
};
