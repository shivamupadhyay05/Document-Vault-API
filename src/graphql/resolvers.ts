import { Collection, Document, Prisma } from "@prisma/client";
import { GraphQLError } from "graphql";
import { GraphQLContext } from "./context";
import {
  validateCollectionInput,
  validateDocumentInput,
} from "../utils/validation";

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
    createCollection: async (
      _: unknown,
      { input }: { input: { name: string; slug: string } },
      ctx: GraphQLContext
    ) => {
      validateCollectionInput(input.name, input.slug);

      try {
        return await ctx.prisma.collection.create({
          data: {
            name: input.name.trim(),
            slug: input.slug.trim(),
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          throw new GraphQLError("A collection with this slug already exists.");
        }
        throw error;
      }
    },
    createDocument: async (
      _: unknown,
      {
        input,
      }: {
        input: {
          title: string;
          content: string;
          tags?: string[];
          collectionId: string;
        };
      },
      ctx: GraphQLContext
    ) => {
      validateDocumentInput(input.title, input.content);

      const collection = await ctx.prisma.collection.findUnique({
        where: { id: input.collectionId },
      });

      if (!collection) {
        throw new GraphQLError("Collection not found");
      }

      return ctx.prisma.document.create({
        data: {
          title: input.title.trim(),
          content: input.content.trim(),
          tags: input.tags ?? [],
          collectionId: input.collectionId,
        },
      });
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
