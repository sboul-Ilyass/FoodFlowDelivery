import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { adminListUsers } from "@/lib/admin.functions";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: AdminUsers,
});

type Role = "MERCHANT" | "COURIER" | "ADMIN";

function AdminUsers() {
  const qc = useQueryClient();
  const listUsers = useServerFn(adminListUsers);

  const { data: users } = useQuery({ queryKey: ["admin-users"], queryFn: () => listUsers() });

  const executeUserMutation = async (method: "POST" | "PUT" | "DELETE", payload: any) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const res = await fetch("/api/admin/users", {
      method,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || "Request failed");
    }
    return await res.json();
  };

  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<null | {
    id: string;
    name: string;
    email: string;
    role: Role;
  }>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-users"] });

  return (
    <AppShell title="Manage Users">
      <div className="flex justify-end mb-4">
        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> New user</Button>
          </DialogTrigger>
          <CreateUserDialog
            onCreate={async (payload) => {
              try {
                await executeUserMutation("POST", payload);
                toast.success("User created");
                setOpenCreate(false);
                refresh();
              } catch (e: any) {
                toast.error(e.message ?? "Failed");
              }
            }}
          />
        </Dialog>
      </div>

      <div className="bg-card border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground text-left">
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
              <tr key={u.id} className="border-t">
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3">{u.role ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setEditing({
                        id: u.id,
                        name: u.name,
                        email: u.email,
                        role: (u.role as Role) ?? "MERCHANT",
                      })
                    }
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="text-destructive">Delete</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete user?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This permanently removes the account and their orders.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={async () => {
                            try {
                              await executeUserMutation("DELETE", { id: u.id });
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
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No users</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && (
          <EditUserDialog
            initial={editing}
            onSave={async (payload) => {
              try {
                await executeUserMutation("PUT", payload);
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

function CreateUserDialog({
  onCreate,
}: {
  onCreate: (p: { name: string; email: string; password: string; role: Role }) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("MERCHANT");
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});

  const handleCreate = () => {
    const newErrors: typeof errors = {};
    if (!name.trim()) {
      newErrors.name = "required";
    }
    if (!email.trim()) {
      newErrors.email = "required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "wrong format";
    }
    if (!password) {
      newErrors.password = "required";
    } else if (password.length < 6) {
      newErrors.password = "must be at least 6 characters";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    onCreate({ name: name.trim(), email: email.trim(), password, role });
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Create user</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <Field label="Name" error={errors.name}>
          <Input value={name} onChange={(e) => {
            setName(e.target.value);
            if (errors.name) setErrors(prev => ({ ...prev, name: undefined }));
          }} />
        </Field>
        <Field label="Email" error={errors.email}>
          <Input type="email" value={email} onChange={(e) => {
            setEmail(e.target.value);
            if (errors.email) setErrors(prev => ({ ...prev, email: undefined }));
          }} />
        </Field>
        <Field label="Password" error={errors.password}>
          <Input type="password" value={password} onChange={(e) => {
            setPassword(e.target.value);
            if (errors.password) setErrors(prev => ({ ...prev, password: undefined }));
          }} />
        </Field>
        <Field label="Role">
          <Select value={role} onValueChange={(v) => setRole(v as Role)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="MERCHANT">Merchant</SelectItem>
              <SelectItem value="COURIER">Courier</SelectItem>
              <SelectItem value="ADMIN">Administrator</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
      <DialogFooter>
        <Button onClick={handleCreate}>Create</Button>
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
    const newErrors: typeof errors = {};
    if (!name.trim()) {
      newErrors.name = "required";
    }
    if (password && password.length < 6) {
      newErrors.password = "must be at least 6 characters";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    onSave({ id: initial.id, name: name.trim(), role, password: password || undefined });
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Edit user</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <Field label="Name" error={errors.name}>
          <Input value={name} onChange={(e) => {
            setName(e.target.value);
            if (errors.name) setErrors(prev => ({ ...prev, name: undefined }));
          }} />
        </Field>
        <Field label="Email">
          <Input value={initial.email} disabled />
        </Field>
        <Field label="Role">
          <Select value={role} onValueChange={(v) => setRole(v as Role)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="MERCHANT">Merchant</SelectItem>
              <SelectItem value="COURIER">Courier</SelectItem>
              <SelectItem value="ADMIN">Administrator</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="New password (optional)" error={errors.password}>
          <Input type="password" value={password} onChange={(e) => {
            setPassword(e.target.value);
            if (errors.password) setErrors(prev => ({ ...prev, password: undefined }));
          }} placeholder="Leave blank to keep" />
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
      <div className="flex justify-between items-center">
        <Label>{label}</Label>
        {error && <span className="text-xs text-destructive font-medium">{error}</span>}
      </div>
      {children}
    </div>
  );
}
