import { StorageService } from "@/storage/StorageService";
import { type AuditLog, type UUID } from "@/types/business";

function uuid(): UUID { 
  return (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)) as UUID; 
}

function nowISO() { 
  return new Date().toISOString(); 
}

export class AuditManager {
  constructor(private storage: StorageService) {}

  async logAction(params: {
    action: string;
    entity_type: string;
    entity_id?: UUID;
    staff_id?: UUID;
    reason?: string;
    metadata?: Record<string, any>;
  }) {
    const log: AuditLog = {
      id: uuid(),
      action: params.action,
      entity_type: params.entity_type,
      entity_id: params.entity_id ?? null,
      staff_id: params.staff_id ?? null,
      reason: params.reason ?? null,
      timestamp: nowISO(),
      metadata: params.metadata ?? null,
    };

    return this.storage.save<AuditLog>("audit_logs", log);
  }

  async getLogsByEntity(entity_type: string, entity_id: UUID) {
    const all = await this.storage.getAll<AuditLog>("audit_logs");
    if (!all.success || !all.data) return { success: true, data: [] } as const;
    
    const filtered = all.data.filter(log => 
      log.entity_type === entity_type && log.entity_id === entity_id
    );
    
    return { success: true, data: filtered } as const;
  }

  async getLogsByAction(action: string) {
    return this.storage.findByIndex<AuditLog>("audit_logs", "action", action);
  }

  async getLogsByDateRange(fromISO: string, toISO: string) {
    return this.storage.queryDateRange<AuditLog>("audit_logs", fromISO, toISO);
  }

  async getRecentLogs(limit = 50) {
    const all = await this.storage.getAll<AuditLog>("audit_logs");
    if (!all.success || !all.data) return { success: true, data: [] } as const;
    
    const sorted = all.data
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
    
    return { success: true, data: sorted } as const;
  }
}