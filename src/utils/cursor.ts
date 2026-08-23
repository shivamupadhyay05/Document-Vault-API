import { GraphQLError } from "graphql";

export function encodeCursor(id: string): string {
  return Buffer.from(id, "utf-8").toString("base64");
}

export function decodeCursor(cursor: string): string {
  try {
    const decoded = Buffer.from(cursor, "base64").toString("utf-8");
    if (!decoded || decoded.trim().length === 0) {
      throw new Error("Invalid cursor");
    }
    return decoded;
  } catch {
    throw new GraphQLError("Invalid cursor");
  }
}
