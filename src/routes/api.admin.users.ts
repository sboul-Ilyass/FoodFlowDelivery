// This REST endpoint is no longer used.
// User management is now handled exclusively through TanStack server functions
// in src/lib/admin.functions.ts (adminCreateUser, adminUpdateUser, adminDeleteUser).
// This file can be safely deleted.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/users")({});
