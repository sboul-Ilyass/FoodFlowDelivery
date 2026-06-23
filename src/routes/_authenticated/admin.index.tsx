import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, StatCard, StatusBadge } from "@/components/AppShell";
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
  Users,
  Store,
  Truck,
  ClipboardList,
  Clock,
  CheckCircle2,
  Plus,
  Pencil,
} from "lucide-react";
import {
  adminListUsers,
  adminCreateUser,
  adminUpdateUser,
  adminDeleteUser,
  adminAssignCourier,
  adminListCouriers,
} from "@/lib/admin.functions";
import { useAuth, roleHome } from "@/lib/useAuth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
});

type Role = "MERCHANT" | "COURIER" | "ADMIN";

function AdminDashboard() {
  const auth = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Redirect non-admins to their own home
  useEffect(() => {
    if (!auth.loading && auth.role !== "ADMIN") {
      navigate({ to: roleHome(auth.role) });
    }
  }, [auth.loading, auth.role, navigate]);

  const listUsers = useServerFn(adminListUsers);
  const listCouriers = useServerFn(adminListCouriers);
  const assignCourier = useServerFn(adminAssignCourier);
  const createUser = useServerFn(adminCreateUser);
  const updateUser = useServerFn(adminUpdateUser);
  const deleteUser = useServerFn(adminDeleteUser);

  // Queries
  const { data: users } = useQuery({ queryKey: ["admin-users"], queryFn: () => listUsers() });
  const { data: orders } = useQuery({
    queryKey: ["all-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id,due_time,status,assigned_courier_id,merchant_id,customers(name,address),created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: couriers } = useQuery({
    queryKey: ["couriers"],
    queryFn: () => listCouriers(),
  });

  // Stable sorted key so ID reordering doesn't create duplicate cache entries
  const merchantIds = Array.from(new Set((orders ?? []).map((o: any) => o.merchant_id))).filter(Boolean);
  const courierIds = Array.from(new Set((orders ?? []).map((o: any) => o.assigned_courier_id).filter(Boolean)));
  const allIds = Array.from(new Set([...merchantIds, ...courierIds])).sort();

  const { data: profiles } = useQuery({
    queryKey: ["profiles-for-orders", allIds.join(",")],
    enabled: allIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,name,email")
        .in("id", allIds);
      if (error) throw error;
      return data;
    },
  });

  const nameOf = (id?: string | null) =>
    (profiles ?? []).find((p) => p.id === id)?.name ?? (id ? id.slice(0, 8) : "—");

  // State
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<null | {
    id: string;
    name: string;
    email: string;
    role: Role;
  }>(null);

  const refreshUsers = () => qc.invalidateQueries({ queryKey: ["admin-users"] });
  const refreshOrders = () => {
    qc.invalidateQueries({ queryKey: ["all-orders"] });
    qc.invalidateQueries({ queryKey: ["profiles-for-orders"] });
  };

  const assign = async (orderId: string, courierId: string | null) => {
    try {
      await assignCourier({ data: { orderId, courierId } });
      toast.success("Updated");
      refreshOrders();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
  };

  const deleteOrder = async (id: string) => {
    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Order cancelled");
      refreshOrders();
    }
  };

  // Stats calculation
  const merchants = users?.filter((u) => u.role === "MERCHANT").length ?? 0;
  const couriersCount = users?.filter((u) => u.role === "COURIER").length ?? 0;
  const totalOrders = orders?.length ?? 0;
  const pending = orders?.filter((o) => o.status === "PENDING").length ?? 0;
  const completed = orders?.filter((o) => o.status === "COMPLETED").length ?? 0;

  return (
    <AppShell title="Administrator Dashboard">
      <div className="space-y-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard label="Total Users" value={users?.length ?? 0} icon={Users} tone="primary" />
          <StatCard label="Merchants" value={merchants} icon={Store} />
          <StatCard label="Couriers" value={couriersCount} icon={Truck} />
          <StatCard label="Total Orders" value={totalOrders} icon={ClipboardList} tone="primary" />
          <StatCard label="Pending" value={pending} icon={Clock} tone="warning" />
          <StatCard label="Completed" value={completed} icon={CheckCircle2} tone="success" />
        </div>

        {/* Users Section */}
        <section className="bg-card border rounded-lg p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold tracking-tight">Manage Users</h2>
            <Dialog open={openCreate} onOpenChange={setOpenCreate}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" /> New user</Button>
              </DialogTrigger>
              <CreateUserDialog
                onCreate={async (payload) => {
                  try {
                    await createUser({ data: payload });
                    toast.success("User created");
                    setOpenCreate(false);
                    refreshUsers();
                  } catch (e: any) {
                    toast.error(e.message ?? "Failed");
                  }
                }}
              />
            </Dialog>
          </div>

          <div className="border rounded-md overflow-x-auto">
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
                                  await deleteUser({ data: { id: u.id } });
                                  toast.success("User deleted");
                                  refreshUsers();
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
        </section>

        {/* Orders Section */}
        <section className="bg-card border rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-bold tracking-tight">Manage Orders</h2>
          <div className="border rounded-md overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground text-left">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Merchant</th>
                  <th className="px-4 py-3">Destination</th>
                  <th className="px-4 py-3">Due Time</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Courier</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {(orders ?? []).map((o: any) => (
                  <tr key={o.id} className="border-t">
                    <td className="px-4 py-3 font-mono text-xs">{o.id.slice(0, 8)}</td>
                    <td className="px-4 py-3">{nameOf(o.merchant_id)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{o.customers?.name}</div>
                      <div className="text-xs text-muted-foreground">{o.customers?.address}</div>
                    </td>
                    <td className="px-4 py-3">{new Date(o.due_time).toLocaleString()}</td>
                    <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                    <td className="px-4 py-3 min-w-[200px]">
                      <Select
                        value={o.assigned_courier_id ?? "none"}
                        onValueChange={(v) => assign(o.id, v === "none" ? null : v)}
                        disabled={o.status === "COMPLETED"}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Unassigned</SelectItem>
                          {(couriers ?? []).map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="text-destructive">Cancel</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Cancel order?</AlertDialogTitle>
                            <AlertDialogDescription>This will permanently cancel and delete this order.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Go Back</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteOrder(o.id)}>Cancel Order</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </td>
                  </tr>
                ))}
                {orders?.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No orders</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Edit User Dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && (
          <EditUserDialog
            initial={editing}
            onSave={async (payload) => {
              try {
                await updateUser({ data: payload });
                toast.success("Updated");
                setEditing(null);
                refreshUsers();
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
    if (!name.trim()) newErrors.name = "required";
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
    if (!name.trim()) newErrors.name = "required";
    if (password && password.length < 6) newErrors.password = "must be at least 6 characters";

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
