// Re-exported from AuthContext so all existing imports keep working.
// The actual logic lives in src/contexts/AuthContext.tsx (single subscription).
export { useAuth, roleHome, type Role, type AuthState } from "@/contexts/AuthContext";
