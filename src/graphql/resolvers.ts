import { Collection, Document, Prisma } from "@prisma/client";
import { GraphQLError } from "graphql";
import { GraphQLContext } from "./context";
import {
  validateCollectionInput,
  validateDocumentInput,
  validateUpdateDocumentInput,
} from "../utils/validation";
import { decodeCursor, encodeCursor } from "../utils/cursor";

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
    documents: async (
      _: unknown,
      {
        collectionId,
        search,
        isArchived,
        first,
        after,
      }: {
        collectionId?: string | null;
        search?: string | null;
        isArchived?: boolean | null;
        first?: number | null;
        after?: string | null;
      },
      ctx: GraphQLContext
    ) => {
      let limit = 20;
      if (first !== undefined && first !== null) {
        if (first <= 0) {
          throw new GraphQLError("first must be greater than 0");
        }
        if (first > 100) {
          throw new GraphQLError("first cannot be greater than 100");
        }
        limit = first;
      }

      let cursorDocId: string | null = null;
      if (after !== undefined && after !== null && after.trim().length > 0) {
        cursorDocId = decodeCursor(after);
        const cursorDoc = await ctx.prisma.document.findUnique({
          where: { id: cursorDocId },
        });
        if (!cursorDoc) {
          throw new GraphQLError("Invalid cursor");
        }
      }

      const where: Prisma.DocumentWhereInput = {};

      if (collectionId !== undefined && collectionId !== null) {
        where.collectionId = collectionId;
      }

      if (isArchived !== undefined && isArchived !== null) {
        where.isArchived = isArchived;
      }

      const searchTerm = search?.trim();
      if (searchTerm && searchTerm.length > 0) {
        where.OR = [
          { title: { contains: searchTerm, mode: "insensitive" } },
          { content: { contains: searchTerm, mode: "insensitive" } },
        ];
      }

      const totalCount = await ctx.prisma.document.count({ where });

      const findOptions: Prisma.DocumentFindManyArgs = {
        where,
        take: limit + 1,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      };

      if (cursorDocId) {
        findOptions.cursor = { id: cursorDocId };
        findOptions.skip = 1;
      }

      const rawDocs = await ctx.prisma.document.findMany(findOptions);

      const hasNextPage = rawDocs.length > limit;
      const docs = hasNextPage ? rawDocs.slice(0, limit) : rawDocs;

      const edges = docs.map((doc) => ({
        node: doc,
        cursor: encodeCursor(doc.id),
      }));

      const pageInfo = {
        hasNextPage,
        hasPreviousPage: false,
        startCursor: edges.length > 0 ? edges[0].cursor : null,
        endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null,
      };

      return {
        edges,
        pageInfo,
        totalCount,
      };
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
    updateDocument: async (
      _: unknown,
      {
        id,
        input,
      }: {
        id: string;
        input: {
          title?: string;
          content?: string;
          tags?: string[];
          isArchived?: boolean;
        };
      },
      ctx: GraphQLContext
    ) => {
      const existingDoc = await ctx.prisma.document.findUnique({
        where: { id },
      });

      if (!existingDoc) {
        throw new GraphQLError("Document not found");
      }

      validateUpdateDocumentInput(input.title, input.content);

      const updateData: Prisma.DocumentUpdateInput = {};

      if (input.title !== undefined) {
        updateData.title = input.title.trim();
      }
      if (input.content !== undefined) {
        updateData.content = input.content.trim();
      }
      if (input.tags !== undefined) {
        updateData.tags = input.tags;
      }
      if (input.isArchived !== undefined) {
        updateData.isArchived = input.isArchived;
      }

      return ctx.prisma.document.update({
        where: { id },
        data: updateData,
      });
    },
    deleteDocument: async (
      _: unknown,
      { id }: { id: string },
      ctx: GraphQLContext
    ) => {
      const existingDoc = await ctx.prisma.document.findUnique({
        where: { id },
      });

      if (!existingDoc) {
        throw new GraphQLError("Document not found");
      }

      await ctx.prisma.document.delete({
        where: { id },
      });

      return true;
    },
    moveDocument: async (
      _: unknown,
      { id, collectionId }: { id: string; collectionId: string },
      ctx: GraphQLContext
    ) => {
      const existingDoc = await ctx.prisma.document.findUnique({
        where: { id },
      });

      if (!existingDoc) {
        throw new GraphQLError("Document not found");
      }

      const targetCollection = await ctx.prisma.collection.findUnique({
        where: { id: collectionId },
      });

      if (!targetCollection) {
        throw new GraphQLError("Collection not found");
      }

      return ctx.prisma.document.update({
        where: { id },
        data: { collectionId },
      });
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
