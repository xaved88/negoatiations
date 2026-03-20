/**
 * BotManager — tracks and cancels pending bot action timers.
 *
 * Each bot action is identified by a string key (e.g. `bid-<botId>`,
 * `accept-<botId>`, `auction-<botId>`). Scheduling a key that already
 * has a pending timer cancels the old one first, so each bot only ever
 * has one active timer per action type at a time.
 */
export class BotManager {
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  /**
   * Schedule `action` to run after `delayMs` milliseconds under the given key.
   * Any previously scheduled action under the same key is cancelled first.
   */
  schedule(key: string, delayMs: number, action: () => void): void {
    this.cancel(key);
    const timer = setTimeout(() => {
      this.timers.delete(key);
      action();
    }, delayMs);
    this.timers.set(key, timer);
  }

  /**
   * Cancel a pending action by key. No-op if the key isn't scheduled.
   */
  cancel(key: string): void {
    const timer = this.timers.get(key);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }

  /**
   * Cancel all pending bot actions. Call this when a room is disposed or
   * a game ends to avoid stale callbacks firing into dead state.
   */
  cancelAll(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  /** Number of currently pending timers — useful in tests. */
  get pendingCount(): number {
    return this.timers.size;
  }
}
