import { StorageService } from "@/storage/StorageService";
import { type AppCounter } from "@/types/business";

function nowISO() { 
  return new Date().toISOString(); 
}

export class CounterManager {
  constructor(private storage: StorageService) {}

  async increment(counterId: string, delta = 1): Promise<{ success: true; data: number } | { success: false; error: string }> {
    const existing = await this.storage.findById<AppCounter>("counters", counterId);
    
    let newValue: number;
    if (existing.success && existing.data) {
      newValue = existing.data.value + delta;
    } else {
      newValue = delta;
    }

    const counter: AppCounter = {
      id: counterId,
      value: newValue,
      last_updated: nowISO(),
    };

    const saved = await this.storage.save<AppCounter>("counters", counter);
    if (!saved.success) return { success: false, error: saved.error || "Failed to save counter" };
    
    return { success: true, data: newValue } as const;
  }

  async getValue(counterId: string): Promise<number> {
    const existing = await this.storage.findById<AppCounter>("counters", counterId);
    return existing.success && existing.data ? existing.data.value : 0;
  }

  async setValue(counterId: string, value: number): Promise<{ success: true; data: number } | { success: false; error: string }> {
    const counter: AppCounter = {
      id: counterId,
      value,
      last_updated: nowISO(),
    };

    const saved = await this.storage.save<AppCounter>("counters", counter);
    if (!saved.success) return { success: false, error: saved.error || "Failed to save counter" };
    
    return { success: true, data: value } as const;
  }

  async getAllCounters() {
    return this.storage.getAll<AppCounter>("counters");
  }
}