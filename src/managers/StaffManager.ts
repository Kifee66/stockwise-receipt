import { StorageService } from "@/storage/StorageService";
import { type Staff, type UUID, type AppRole } from "@/types/business";
import { staffSchema } from "@/types/business";

function nowISO() { return new Date().toISOString(); }
function uuid(): UUID { return (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)) as UUID; }

const rolePermissions: Record<AppRole, string[]> = {
  admin: ["manage_products", "process_sales", "view_reports", "manage_staff", "manage_settings"],
  manager: ["manage_products", "process_sales", "view_reports", "manage_settings"],
  cashier: ["process_sales"],
  viewer: ["view_reports"],
};

export class StaffManager {
  constructor(private storage: StorageService) {}

  async addStaff(input: Omit<Staff, "id" | "created_at"> & { id?: UUID }) {
    const staff: Staff = {
      id: input.id ?? uuid(),
      name: input.name,
      email: input.email,
      role: input.role,
      created_at: nowISO(),
    };
    const parse = staffSchema.safeParse(staff);
    if (!parse.success) return { success: false, error: parse.error.message } as const;
    return this.storage.save<Staff>("staff", staff);
  }

  async setRole(staffId: UUID, role: AppRole) {
    const res = await this.storage.findById<Staff>("staff", staffId);
    if (!res.success || !res.data) return { success: false, error: "Staff not found" } as const;
    res.data.role = role;
    return this.storage.save<Staff>("staff", res.data);
  }

  async hasPermission(staffId: UUID, permission: string) {
    const res = await this.storage.findById<Staff>("staff", staffId);
    if (!res.success || !res.data) return { success: false, data: false } as const;
    const perms = rolePermissions[res.data.role] ?? [];
    return { success: true, data: perms.includes(permission) } as const;
  }

  async list() { return this.storage.getAll<Staff>("staff"); }
}
