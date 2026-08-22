import { GraphQLError } from "graphql";

export function validateSlug(slug: string): boolean {
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  return slugRegex.test(slug);
}

export function validateCollectionInput(name: string, slug: string): void {
  if (!name || name.trim().length === 0) {
    throw new GraphQLError("Collection name cannot be empty");
  }

  if (!validateSlug(slug)) {
    throw new GraphQLError(
      "Invalid slug format. Slug must contain only lowercase letters, numbers, and single hyphens, without leading or trailing hyphens."
    );
  }
}

export function validateDocumentInput(title: string, content: string): void {
  if (!title || title.trim().length === 0) {
    throw new GraphQLError("Document title cannot be empty");
  }

  if (!content || content.trim().length === 0) {
    throw new GraphQLError("Document content cannot be empty");
  }
}

export function validateUpdateDocumentInput(
  title?: string,
  content?: string
): void {
  if (title !== undefined && (!title || title.trim().length === 0)) {
    throw new GraphQLError("Document title cannot be empty");
  }

  if (content !== undefined && (!content || content.trim().length === 0)) {
    throw new GraphQLError("Document content cannot be empty");
  }
}
