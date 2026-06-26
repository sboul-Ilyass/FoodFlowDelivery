import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  adminListUsers,
  adminCreateUser,
  adminUpdateUser,
  adminDeleteUser,
} from "@/lib/admin.functions";
import { useAuth, roleHome } from "@/lib/useAuth";
import { toast } from "sonner";
import { Plus, Pencil, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: AdminUsers,
});

type Role = "MERCHANT" | "COURIER" | "ADMIN" | "CUSTOMER";

function AdminUsers() {
  const auth = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listUsers  = useServerFn(adminListUsers);
  const createUser = useServerFn(adminCreateUser);
  const updateUser = useServerFn(adminUpdateUser);
  const deleteUser = useServerFn(adminDeleteUser);

  useEffect(() => {
    if (!auth.loading && auth.role !== "ADMIN") navigate({ to: roleHome(auth.role) });
  }, [auth.loading, auth.role, navigate]);

  const { data: users } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listUsers(),
  });

  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<null | { id: string; name: string; email: string; role: Role }>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-users"] });

  const ROLE_BADGE: Record<string, string> = {
    ADMIN:    "bg-violet-100 text-violet-700",
    MERCHANT: "bg-orange-100 text-orange-700",
    COURIER:  "bg-blue-100 text-blue-700",
    CUSTOMER: "bg-emerald-100 text-emerald-700",
  };

  return (
    <AppShell title="Users">
      <div className="space-y-5 max-w-5xl">

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Users className="h-4 w-4" />
            {users?.length ?? 0} account{users?.length !== 1 ? "s" : ""}
          </div>
          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> New user</Button>
            </DialogTrigger>
            {/* key forces state reset each time dialog opens */}
            <CreateUserDialog
              key={openCreate ? "open" : "closed"}
              onCreate={async (payload) => {
                await createUser({ data: payload });
                toast.success("User created");
                setOpenCreate(false);
                refresh();
              }}
            />
          </Dialog>
        </div>

        <div className="rounded-xl border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground text-left">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {(users ?? []).map((u) => (
                <tr key={u.id} className="border-t hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3">
                    {u.role ? (
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_BADGE[u.role] ?? "bg-muted text-muted-foreground"}`}>
                        {u.role}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditing({ id: u.id, name: u.name, email: u.email, role: (u.role as Role) ?? "MERCHANT" })}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">Delete</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete "{u.name}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This permanently removes the account and all their orders.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={async () => {
                              try {
                                await deleteUser({ data: { id: u.id } });
                                toast.success("User deleted");
                                refresh();
                              } catch (e: any) {
                                toast.error(e.message ?? "Failed");
                              }
                            }}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </td>
                </tr>
              ))}
              {users?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-14 text-center text-muted-foreground">
                    No users yet. Create your first one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && (
          <EditUserDialog
            initial={editing}
            onSave={async (payload) => {
              try {
                await updateUser({ data: payload });
                toast.success("Updated");
                setEditing(null);
                refresh();
              } catch (e: any) {
                toast.error(e.message ?? "Failed");
              }
            }}
          />
        )}
      </Dialog>
    </AppShell>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function CreateUserDialog({
  onCreate,
}: {
  onCreate: (p: { name: string; email: string; password: string; role: Role }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("MERCHANT");
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    const e: typeof fieldErrors = {};
    if (!name.trim()) e.name = "required";
    if (!email.trim()) e.email = "required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "invalid format";
    if (!password) e.password = "required";
    else if (password.length < 6) e.password = "min 6 characters";
    if (Object.keys(e).length) { setFieldErrors(e); return; }
    setFieldErrors({});
    setServerError(null);
    setLoading(true);
    try {
      await onCreate({ name: name.trim(), email: email.trim(), password, role });
    } catch (err: any) {
      setServerError(err?.message ?? "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Create user</DialogTitle></DialogHeader>
      <div className="space-y-3 py-1">
        {serverError && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
            {serverError}
          </div>
        )}
        <Field label="Name" error={fieldErrors.name}>
          <Input value={name} onChange={(e) => { setName(e.target.value); setFieldErrors((p) => ({ ...p, name: undefined })); }} />
        </Field>
        <Field label="Email" error={fieldErrors.email}>
          <Input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setFieldErrors((p) => ({ ...p, email: undefined })); setServerError(null); }} />
        </Field>
        <Field label="Password" error={fieldErrors.password}>
          <Input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setFieldErrors((p) => ({ ...p, password: undefined })); }} />
        </Field>
        <Field label="Role">
          <Select value={role} onValueChange={(v) => setRole(v as Role)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="CUSTOMER">Customer</SelectItem>
              <SelectItem value="MERCHANT">Merchant</SelectItem>
              <SelectItem value="COURIER">Courier</SelectItem>
              <SelectItem value="ADMIN">Administrator</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
      <DialogFooter>
        <Button onClick={handleCreate} disabled={loading}>
          {loading ? "Creating…" : "Create"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function EditUserDialog({
  initial,
  onSave,
}: {
  initial: { id: string; name: string; email: string; role: Role };
  onSave: (p: { id: string; name: string; role: Role; password?: string }) => void;
}) {
  const [name, setName] = useState(initial.name);
  const [role, setRole] = useState<Role>(initial.role);
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ name?: string; password?: string }>({});

  const handleSave = () => {
    const e: typeof errors = {};
    if (!name.trim()) e.name = "required";
    if (password && password.length < 6) e.password = "min 6 characters";
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    onSave({ id: initial.id, name: name.trim(), role, password: password || undefined });
  };

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Edit user</DialogTitle></DialogHeader>
      <div className="space-y-3 py-1">
        <Field label="Name" error={errors.name}>
          <Input value={name} onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: undefined })); }} />
        </Field>
        <Field label="Email">
          <Input value={initial.email} disabled />
        </Field>
        <Field label="Role">
          <Select value={role} onValueChange={(v) => setRole(v as Role)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="CUSTOMER">Customer</SelectItem>
              <SelectItem value="MERCHANT">Merchant</SelectItem>
              <SelectItem value="COURIER">Courier</SelectItem>
              <SelectItem value="ADMIN">Administrator</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="New password (optional)" error={errors.password}>
          <Input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: undefined })); }} placeholder="Leave blank to keep" />
        </Field>
      </div>
      <DialogFooter>
        <Button onClick={handleSave}>Save</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {error && <span className="text-xs text-destructive font-medium">{error}</span>}
      </div>
      {children}
    </div>
  );
}
