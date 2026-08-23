import { describe, test, expect, mock, beforeEach } from "bun:test";
import { Prisma, PrismaClient } from "@prisma/client";
import { resolvers } from "../../src/graphql/resolvers";
import { GraphQLContext } from "../../src/graphql/context";
import { encodeCursor } from "../../src/utils/cursor";

describe("GraphQL Resolvers Unit Tests", () => {
  let mockPrisma: any;
  let ctx: GraphQLContext;

  beforeEach(() => {
    mockPrisma = {
      collection: {
        findMany: mock(),
        findUnique: mock(),
        create: mock(),
      },
      document: {
        findMany: mock(),
        findUnique: mock(),
        create: mock(),
        update: mock(),
        delete: mock(),
        count: mock(),
      },
    };
    ctx = { prisma: mockPrisma as unknown as PrismaClient };
  });

  // 1. COLLECTION QUERIES
  describe("Collection Queries", () => {
    test("Query.collections returns all collections", async () => {
      const mockCols = [
        { id: "col-1", name: "Vault 1", slug: "vault-1", createdAt: new Date() },
      ];
      mockPrisma.collection.findMany.mockResolvedValue(mockCols);

      const result = await resolvers.Query.collections(null, {}, ctx);
      expect(mockPrisma.collection.findMany).toHaveBeenCalled();
      expect(result).toEqual(mockCols);
    });

    test("Query.collections returns [] when empty", async () => {
      mockPrisma.collection.findMany.mockResolvedValue([]);
      const result = await resolvers.Query.collections(null, {}, ctx);
      expect(result).toEqual([]);
    });

    test("Query.collection returns collection by ID", async () => {
      const mockCol = { id: "col-1", name: "Vault 1", slug: "vault-1", createdAt: new Date() };
      mockPrisma.collection.findUnique.mockResolvedValue(mockCol);

      const result = await resolvers.Query.collection(null, { id: "col-1" }, ctx);
      expect(mockPrisma.collection.findUnique).toHaveBeenCalledWith({ where: { id: "col-1" } });
      expect(result).toEqual(mockCol);
    });

    test("Query.collection returns null when not found", async () => {
      mockPrisma.collection.findUnique.mockResolvedValue(null);
      const result = await resolvers.Query.collection(null, { id: "missing" }, ctx);
      expect(result).toBeNull();
    });

    test("Collection.documents resolves child documents via Prisma", async () => {
      const parentCol = { id: "col-1", name: "Vault 1", slug: "vault-1", createdAt: new Date() };
      const mockDocs = [{ id: "doc-1", title: "Doc 1", collectionId: "col-1" }];
      mockPrisma.document.findMany.mockResolvedValue(mockDocs);

      const result = await resolvers.Collection.documents(parentCol, {}, ctx);
      expect(mockPrisma.document.findMany).toHaveBeenCalledWith({ where: { collectionId: "col-1" } });
      expect(result).toEqual(mockDocs);
    });
  });

  // 2. CREATE COLLECTION
  describe("Mutation.createCollection", () => {
    test("creates collection successfully", async () => {
      const createdCol = { id: "col-1", name: "Engineering", slug: "engineering", createdAt: new Date() };
      mockPrisma.collection.create.mockResolvedValue(createdCol);

      const result = await resolvers.Mutation.createCollection(
        null,
        { input: { name: "Engineering", slug: "engineering" } },
        ctx
      );
      expect(mockPrisma.collection.create).toHaveBeenCalledWith({
        data: { name: "Engineering", slug: "engineering" },
      });
      expect(result).toEqual(createdCol);
    });

    test("rejects empty name with error", async () => {
      expect(
        resolvers.Mutation.createCollection(null, { input: { name: "", slug: "eng" } }, ctx)
      ).rejects.toThrow("Collection name cannot be empty");
    });

    test("rejects whitespace-only name with error", async () => {
      expect(
        resolvers.Mutation.createCollection(null, { input: { name: "   ", slug: "eng" } }, ctx)
      ).rejects.toThrow("Collection name cannot be empty");
    });

    test("rejects malformed slugs", async () => {
      const invalidSlugs = ["Engineering Team", "engineering_team", "-engineering", "engineering-", "Engineering"];
      for (const slug of invalidSlugs) {
        expect(
          resolvers.Mutation.createCollection(null, { input: { name: "Engineering", slug } }, ctx)
        ).rejects.toThrow("Invalid slug format");
      }
    });

    test("handles duplicate slug (Prisma P2002 error)", async () => {
      const p2002Error = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "6.4.0",
      });
      mockPrisma.collection.create.mockRejectedValue(p2002Error);

      expect(
        resolvers.Mutation.createCollection(null, { input: { name: "Engineering", slug: "engineering" } }, ctx)
      ).rejects.toThrow("A collection with this slug already exists.");
    });
  });

  // 3. CREATE DOCUMENT
  describe("Mutation.createDocument", () => {
    test("creates document successfully", async () => {
      mockPrisma.collection.findUnique.mockResolvedValue({ id: "col-1" });
      const createdDoc = { id: "doc-1", title: "API Specs", content: "Details", tags: ["backend"], collectionId: "col-1" };
      mockPrisma.document.create.mockResolvedValue(createdDoc);

      const result = await resolvers.Mutation.createDocument(
        null,
        { input: { title: "API Specs", content: "Details", tags: ["backend"], collectionId: "col-1" } },
        ctx
      );

      expect(mockPrisma.collection.findUnique).toHaveBeenCalledWith({ where: { id: "col-1" } });
      expect(mockPrisma.document.create).toHaveBeenCalledWith({
        data: { title: "API Specs", content: "Details", tags: ["backend"], collectionId: "col-1" },
      });
      expect(result).toEqual(createdDoc);
    });

    test("defaults tags to [] when omitted", async () => {
      mockPrisma.collection.findUnique.mockResolvedValue({ id: "col-1" });
      mockPrisma.document.create.mockResolvedValue({ id: "doc-1" });

      await resolvers.Mutation.createDocument(
        null,
        { input: { title: "API Specs", content: "Details", collectionId: "col-1" } },
        ctx
      );

      expect(mockPrisma.document.create).toHaveBeenCalledWith({
        data: { title: "API Specs", content: "Details", tags: [], collectionId: "col-1" },
      });
    });

    test("rejects empty title", async () => {
      expect(
        resolvers.Mutation.createDocument(null, { input: { title: "", content: "Valid", collectionId: "col-1" } }, ctx)
      ).rejects.toThrow("Document title cannot be empty");
    });

    test("rejects empty content", async () => {
      expect(
        resolvers.Mutation.createDocument(null, { input: { title: "Valid", content: "   ", collectionId: "col-1" } }, ctx)
      ).rejects.toThrow("Document content cannot be empty");
    });

    test("rejects non-existent collection", async () => {
      mockPrisma.collection.findUnique.mockResolvedValue(null);

      expect(
        resolvers.Mutation.createDocument(null, { input: { title: "Valid", content: "Valid", collectionId: "missing" } }, ctx)
      ).rejects.toThrow("Collection not found");
    });
  });

  // 4. UPDATE DOCUMENT
  describe("Mutation.updateDocument", () => {
    test("updates title only without overwriting other fields", async () => {
      mockPrisma.document.findUnique.mockResolvedValue({ id: "doc-1" });
      mockPrisma.document.update.mockResolvedValue({ id: "doc-1", title: "New Title" });

      await resolvers.Mutation.updateDocument(
        null,
        { id: "doc-1", input: { title: "New Title" } },
        ctx
      );

      expect(mockPrisma.document.update).toHaveBeenCalledWith({
        where: { id: "doc-1" },
        data: { title: "New Title" },
      });
    });

    test("preserves tags: [] as valid update value", async () => {
      mockPrisma.document.findUnique.mockResolvedValue({ id: "doc-1" });
      mockPrisma.document.update.mockResolvedValue({ id: "doc-1", tags: [] });

      await resolvers.Mutation.updateDocument(
        null,
        { id: "doc-1", input: { tags: [] } },
        ctx
      );

      expect(mockPrisma.document.update).toHaveBeenCalledWith({
        where: { id: "doc-1" },
        data: { tags: [] },
      });
    });

    test("preserves isArchived: false as valid update value", async () => {
      mockPrisma.document.findUnique.mockResolvedValue({ id: "doc-1" });
      mockPrisma.document.update.mockResolvedValue({ id: "doc-1", isArchived: false });

      await resolvers.Mutation.updateDocument(
        null,
        { id: "doc-1", input: { isArchived: false } },
        ctx
      );

      expect(mockPrisma.document.update).toHaveBeenCalledWith({
        where: { id: "doc-1" },
        data: { isArchived: false },
      });
    });

    test("rejects empty title update", async () => {
      mockPrisma.document.findUnique.mockResolvedValue({ id: "doc-1" });

      expect(
        resolvers.Mutation.updateDocument(null, { id: "doc-1", input: { title: "   " } }, ctx)
      ).rejects.toThrow("Document title cannot be empty");
    });

    test("rejects empty content update", async () => {
      mockPrisma.document.findUnique.mockResolvedValue({ id: "doc-1" });

      expect(
        resolvers.Mutation.updateDocument(null, { id: "doc-1", input: { content: "" } }, ctx)
      ).rejects.toThrow("Document content cannot be empty");
    });

    test("rejects non-existent document", async () => {
      mockPrisma.document.findUnique.mockResolvedValue(null);

      expect(
        resolvers.Mutation.updateDocument(null, { id: "missing", input: { title: "Title" } }, ctx)
      ).rejects.toThrow("Document not found");
    });
  });

  // 5. DELETE DOCUMENT
  describe("Mutation.deleteDocument", () => {
    test("deletes document successfully", async () => {
      mockPrisma.document.findUnique.mockResolvedValue({ id: "doc-1" });
      mockPrisma.document.delete.mockResolvedValue({ id: "doc-1" });

      const result = await resolvers.Mutation.deleteDocument(null, { id: "doc-1" }, ctx);
      expect(mockPrisma.document.delete).toHaveBeenCalledWith({ where: { id: "doc-1" } });
      expect(result).toBe(true);
    });

    test("rejects non-existent document", async () => {
      mockPrisma.document.findUnique.mockResolvedValue(null);

      expect(resolvers.Mutation.deleteDocument(null, { id: "missing" }, ctx)).rejects.toThrow("Document not found");
    });
  });

  // 6. MOVE DOCUMENT
  describe("Mutation.moveDocument", () => {
    test("moves document successfully", async () => {
      mockPrisma.document.findUnique.mockResolvedValue({ id: "doc-1", collectionId: "col-1" });
      mockPrisma.collection.findUnique.mockResolvedValue({ id: "col-2" });
      mockPrisma.document.update.mockResolvedValue({ id: "doc-1", collectionId: "col-2" });

      const result = await resolvers.Mutation.moveDocument(null, { id: "doc-1", collectionId: "col-2" }, ctx);
      expect(mockPrisma.document.update).toHaveBeenCalledWith({
        where: { id: "doc-1" },
        data: { collectionId: "col-2" },
      });
      expect(result.collectionId).toBe("col-2");
    });

    test("rejects non-existent document", async () => {
      mockPrisma.document.findUnique.mockResolvedValue(null);

      expect(resolvers.Mutation.moveDocument(null, { id: "missing", collectionId: "col-2" }, ctx)).rejects.toThrow(
        "Document not found"
      );
    });

    test("rejects non-existent target collection", async () => {
      mockPrisma.document.findUnique.mockResolvedValue({ id: "doc-1" });
      mockPrisma.collection.findUnique.mockResolvedValue(null);

      expect(resolvers.Mutation.moveDocument(null, { id: "doc-1", collectionId: "missing" }, ctx)).rejects.toThrow(
        "Collection not found"
      );
    });

    test("succeeds when moving to same collection", async () => {
      mockPrisma.document.findUnique.mockResolvedValue({ id: "doc-1", collectionId: "col-1" });
      mockPrisma.collection.findUnique.mockResolvedValue({ id: "col-1" });
      mockPrisma.document.update.mockResolvedValue({ id: "doc-1", collectionId: "col-1" });

      const result = await resolvers.Mutation.moveDocument(null, { id: "doc-1", collectionId: "col-1" }, ctx);
      expect(result.collectionId).toBe("col-1");
    });
  });

  // 7. DOCUMENT SEARCH AND FILTERS
  describe("Query.documents Filters & Search", () => {
    test("queries documents without filters", async () => {
      mockPrisma.document.count.mockResolvedValue(0);
      mockPrisma.document.findMany.mockResolvedValue([]);

      await resolvers.Query.documents(null, {}, ctx);
      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} })
      );
    });

    test("filters by collectionId", async () => {
      mockPrisma.document.count.mockResolvedValue(0);
      mockPrisma.document.findMany.mockResolvedValue([]);

      await resolvers.Query.documents(null, { collectionId: "col-1" }, ctx);
      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { collectionId: "col-1" } })
      );
    });

    test("filters by isArchived: true", async () => {
      mockPrisma.document.count.mockResolvedValue(0);
      mockPrisma.document.findMany.mockResolvedValue([]);

      await resolvers.Query.documents(null, { isArchived: true }, ctx);
      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isArchived: true } })
      );
    });

    test("filters by isArchived: false explicitly", async () => {
      mockPrisma.document.count.mockResolvedValue(0);
      mockPrisma.document.findMany.mockResolvedValue([]);

      await resolvers.Query.documents(null, { isArchived: false }, ctx);
      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isArchived: false } })
      );
    });

    test("applies case-insensitive search across title or content", async () => {
      mockPrisma.document.count.mockResolvedValue(0);
      mockPrisma.document.findMany.mockResolvedValue([]);

      await resolvers.Query.documents(null, { search: "GraphQL" }, ctx);
      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { title: { contains: "GraphQL", mode: "insensitive" } },
              { content: { contains: "GraphQL", mode: "insensitive" } },
            ],
          },
        })
      );
    });

    test("ignores whitespace-only search", async () => {
      mockPrisma.document.count.mockResolvedValue(0);
      mockPrisma.document.findMany.mockResolvedValue([]);

      await resolvers.Query.documents(null, { search: "   " }, ctx);
      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} })
      );
    });

    test("combines filters with AND semantics", async () => {
      mockPrisma.document.count.mockResolvedValue(0);
      mockPrisma.document.findMany.mockResolvedValue([]);

      await resolvers.Query.documents(null, { collectionId: "col-1", isArchived: false, search: "GraphQL" }, ctx);
      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            collectionId: "col-1",
            isArchived: false,
            OR: [
              { title: { contains: "GraphQL", mode: "insensitive" } },
              { content: { contains: "GraphQL", mode: "insensitive" } },
            ],
          },
        })
      );
    });

    test("returns empty connection for empty results", async () => {
      mockPrisma.document.count.mockResolvedValue(0);
      mockPrisma.document.findMany.mockResolvedValue([]);

      const result = await resolvers.Query.documents(null, {}, ctx);
      expect(result).toEqual({
        edges: [],
        pageInfo: {
          hasNextPage: false,
          hasPreviousPage: false,
          startCursor: null,
          endCursor: null,
        },
        totalCount: 0,
      });
    });
  });

  // 8. CURSOR PAGINATION
  describe("Query.documents Cursor Pagination", () => {
    test("defaults first to 20 and requests take: 21", async () => {
      mockPrisma.document.count.mockResolvedValue(0);
      mockPrisma.document.findMany.mockResolvedValue([]);

      await resolvers.Query.documents(null, {}, ctx);
      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 21 })
      );
    });

    test("requests take: first + 1 when first = 5", async () => {
      mockPrisma.document.count.mockResolvedValue(0);
      mockPrisma.document.findMany.mockResolvedValue([]);

      await resolvers.Query.documents(null, { first: 5 }, ctx);
      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 6 })
      );
    });

    test("detects hasNextPage = true when extra item is fetched", async () => {
      mockPrisma.document.count.mockResolvedValue(6);
      const docs = Array.from({ length: 6 }, (_, i) => ({ id: `doc-${i + 1}` }));
      mockPrisma.document.findMany.mockResolvedValue(docs);

      const result = await resolvers.Query.documents(null, { first: 5 }, ctx);
      expect(result.edges.length).toBe(5);
      expect(result.pageInfo.hasNextPage).toBe(true);
      expect(result.totalCount).toBe(6);
    });

    test("detects hasNextPage = false when no extra item exists", async () => {
      mockPrisma.document.count.mockResolvedValue(3);
      const docs = [{ id: "doc-1" }, { id: "doc-2" }, { id: "doc-3" }];
      mockPrisma.document.findMany.mockResolvedValue(docs);

      const result = await resolvers.Query.documents(null, { first: 5 }, ctx);
      expect(result.edges.length).toBe(3);
      expect(result.pageInfo.hasNextPage).toBe(false);
    });

    test("handles valid after cursor with findUnique check and cursor/skip in findMany", async () => {
      const validCursor = encodeCursor("doc-2");
      mockPrisma.document.findUnique.mockResolvedValue({ id: "doc-2" });
      mockPrisma.document.count.mockResolvedValue(10);
      mockPrisma.document.findMany.mockResolvedValue([{ id: "doc-3" }]);

      await resolvers.Query.documents(null, { first: 5, after: validCursor }, ctx);

      expect(mockPrisma.document.findUnique).toHaveBeenCalledWith({ where: { id: "doc-2" } });
      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: "doc-2" },
          skip: 1,
        })
      );
    });

    test("rejects malformed cursor with error", async () => {
      expect(
        resolvers.Query.documents(null, { after: "invalid-cursor!" }, ctx)
      ).rejects.toThrow("Invalid cursor");
    });

    test("rejects cursor referencing non-existent document", async () => {
      const validBase64 = encodeCursor("missing-doc");
      mockPrisma.document.findUnique.mockResolvedValue(null);

      expect(
        resolvers.Query.documents(null, { after: validBase64 }, ctx)
      ).rejects.toThrow("Invalid cursor");
    });

    test("rejects first <= 0", async () => {
      expect(resolvers.Query.documents(null, { first: 0 }, ctx)).rejects.toThrow("first must be greater than 0");
      expect(resolvers.Query.documents(null, { first: -1 }, ctx)).rejects.toThrow("first must be greater than 0");
    });

    test("rejects first > 100", async () => {
      expect(resolvers.Query.documents(null, { first: 101 }, ctx)).rejects.toThrow("first cannot be greater than 100");
    });

    test("totalCount evaluates Prisma count with identical where condition", async () => {
      mockPrisma.document.count.mockResolvedValue(42);
      mockPrisma.document.findMany.mockResolvedValue([]);

      const result = await resolvers.Query.documents(null, { collectionId: "col-1", isArchived: true }, ctx);
      expect(mockPrisma.document.count).toHaveBeenCalledWith({
        where: { collectionId: "col-1", isArchived: true },
      });
      expect(result.totalCount).toBe(42);
    });

    test("generates startCursor and endCursor correctly", async () => {
      mockPrisma.document.count.mockResolvedValue(2);
      const docs = [{ id: "doc-A" }, { id: "doc-B" }];
      mockPrisma.document.findMany.mockResolvedValue(docs);

      const result = await resolvers.Query.documents(null, {}, ctx);
      expect(result.pageInfo.startCursor).toBe(encodeCursor("doc-A"));
      expect(result.pageInfo.endCursor).toBe(encodeCursor("doc-B"));
    });
  });
});
