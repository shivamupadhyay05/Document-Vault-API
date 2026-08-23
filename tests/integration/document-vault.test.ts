import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { createSchema, createYoga } from "graphql-yoga";
import { readFileSync } from "fs";
import { join } from "path";
import { createContext, GraphQLContext } from "../../src/graphql/context";
import { resolvers } from "../../src/graphql/resolvers";
import { prisma } from "../../src/lib/prisma";

describe("PostgreSQL Integration Test - Document Vault API", () => {
  let server: ReturnType<typeof Bun.serve>;
  const PORT = 4000;
  const ENDPOINT = `http://localhost:${PORT}/graphql`;

  beforeAll(() => {
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

    server = Bun.serve({
      port: PORT,
      fetch: (req) => yoga.handle(req),
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    if (server) {
      server.stop(true);
    }
  });

  test("End-to-End Flow: createCollection -> createDocument -> documents -> updateDocument -> cleanup", async () => {
    let createdColId: string | null = null;
    let createdDocId: string | null = null;

    try {
      const uniqueSlug = `int-col-${Date.now()}`;

      // 1. Execute createCollection mutation
      const colRes = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `
            mutation CreateCol($input: CreateCollectionInput!) {
              createCollection(input: $input) {
                id
                name
                slug
                createdAt
              }
            }
          `,
          variables: {
            input: {
              name: "Integration Collection",
              slug: uniqueSlug,
            },
          },
        }),
      });

      expect(colRes.status).toBe(200);
      const colJson = await colRes.json();
      expect(colJson.errors).toBeUndefined();

      const collection = colJson.data.createCollection;
      expect(collection.id).toBeDefined();
      expect(collection.name).toBe("Integration Collection");
      expect(collection.slug).toBe(uniqueSlug);
      expect(collection.createdAt).toBeDefined();
      createdColId = collection.id;

      // 2. Execute createDocument mutation
      const docRes = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `
            mutation CreateDoc($input: CreateDocumentInput!) {
              createDocument(input: $input) {
                id
                title
                content
                tags
                collectionId
                isArchived
                createdAt
              }
            }
          `,
          variables: {
            input: {
              title: "Integration Spec Document",
              content: "End-to-end verification of PostgreSQL persistence",
              tags: ["integration", "postgres", "test"],
              collectionId: createdColId,
            },
          },
        }),
      });

      expect(docRes.status).toBe(200);
      const docJson = await docRes.json();
      expect(docJson.errors).toBeUndefined();

      const document = docJson.data.createDocument;
      expect(document.id).toBeDefined();
      expect(document.title).toBe("Integration Spec Document");
      expect(document.content).toBe("End-to-end verification of PostgreSQL persistence");
      expect(document.tags).toEqual(["integration", "postgres", "test"]);
      expect(document.collectionId).toBe(createdColId);
      expect(document.isArchived).toBe(false);
      expect(document.createdAt).toBeDefined();
      createdDocId = document.id;

      // 3. Execute documents query and verify returned fields from PostgreSQL
      const queryRes = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `
            query GetDocs($colId: ID!) {
              documents(collectionId: $colId) {
                totalCount
                edges {
                  node {
                    id
                    title
                    content
                    tags
                    collectionId
                    isArchived
                    createdAt
                  }
                }
              }
            }
          `,
          variables: { colId: createdColId },
        }),
      });

      expect(queryRes.status).toBe(200);
      const queryJson = await queryRes.json();
      expect(queryJson.errors).toBeUndefined();

      const connection = queryJson.data.documents;
      expect(connection.totalCount).toBe(1);
      expect(connection.edges.length).toBe(1);

      const queriedDoc = connection.edges[0].node;
      expect(queriedDoc.id).toBe(createdDocId);
      expect(queriedDoc.title).toBe("Integration Spec Document");
      expect(queriedDoc.content).toBe("End-to-end verification of PostgreSQL persistence");
      expect(queriedDoc.tags).toEqual(["integration", "postgres", "test"]);
      expect(queriedDoc.collectionId).toBe(createdColId);
      expect(queriedDoc.isArchived).toBe(false);
      expect(queriedDoc.createdAt).toBe(document.createdAt);

      // 4. Execute updateDocument mutation and verify persisted changes
      const updateRes = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `
            mutation UpdateDoc($id: ID!, $input: UpdateDocumentInput!) {
              updateDocument(id: $id, input: $input) {
                id
                title
                content
                tags
                isArchived
              }
            }
          `,
          variables: {
            id: createdDocId,
            input: {
              title: "Updated Integration Spec Title",
              tags: ["integration", "updated"],
              isArchived: true,
            },
          },
        }),
      });

      expect(updateRes.status).toBe(200);
      const updateJson = await updateRes.json();
      expect(updateJson.errors).toBeUndefined();

      const updatedDoc = updateJson.data.updateDocument;
      expect(updatedDoc.id).toBe(createdDocId);
      expect(updatedDoc.title).toBe("Updated Integration Spec Title");
      expect(updatedDoc.content).toBe("End-to-end verification of PostgreSQL persistence"); // unchanged
      expect(updatedDoc.tags).toEqual(["integration", "updated"]);
      expect(updatedDoc.isArchived).toBe(true);

      // Verify updated values directly in PostgreSQL via Prisma
      const dbDoc = await prisma.document.findUnique({
        where: { id: createdDocId },
      });
      expect(dbDoc).not.toBeNull();
      expect(dbDoc?.title).toBe("Updated Integration Spec Title");
      expect(dbDoc?.isArchived).toBe(true);
    } finally {
      // 5. Cleanup test records from PostgreSQL
      if (createdDocId) {
        await prisma.document.deleteMany({ where: { id: createdDocId } });
      }
      if (createdColId) {
        await prisma.collection.deleteMany({ where: { id: createdColId } });
      }
    }
  });
});
