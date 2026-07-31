import { Injectable } from '@nestjs/common';

@Injectable()
export class CostTracker {
  private readonly entries: Array<{ stage: string; units: number; at: string }> = [];

  record(stage: string, units: number): void {
    this.entries.push({ stage, units, at: new Date().toISOString() });
  }

  summary(): { stage: string; units: number }[] {
    const totals = new Map<string, number>();
    for (const entry of this.entries) {
      totals.set(entry.stage, (totals.get(entry.stage) ?? 0) + entry.units);
    }
    return [...totals.entries()].map(([stage, units]) => ({ stage, units }));
  }
}
