import type { Channel } from "@/types/net";
import type { MessageHandler, PeerHandler, Transport } from "@/net/transport";

interface Endpoint {
  id: string;
  handlers: Map<string, MessageHandler[]>;
  joins: PeerHandler[];
  leaves: PeerHandler[];
  alive: boolean;
}

/**
 * In-memory network used by tests: every endpoint sees every other one,
 * messages arrive after a fixed latency through setTimeout.
 */
export class MemoryHub {
  private readonly endpoints = new Map<string, Endpoint>();
  private counter = 0;

  constructor(private readonly latencyMs = 20) {}

  connect(): Transport {
    this.counter += 1;
    const self: Endpoint = { id: `peer-${this.counter}`, handlers: new Map(), joins: [], leaves: [], alive: true };
    const others = [...this.endpoints.values()];
    this.endpoints.set(self.id, self);
    this.later(() => {
      for (const other of others) {
        if (!other.alive || !self.alive) continue;
        other.joins.forEach((h) => h(self.id));
        self.joins.forEach((h) => h(other.id));
      }
    });
    return {
      selfId: self.id,
      send: (channel: Channel, data: unknown, target?: string) => {
        if (!self.alive) return;
        const copy: unknown = JSON.parse(JSON.stringify(data));
        for (const other of this.endpoints.values()) {
          if (other === self || (target && other.id !== target)) continue;
          this.later(() => {
            if (other.alive && self.alive) other.handlers.get(channel)?.forEach((h) => h(copy, self.id));
          });
        }
      },
      on: (channel, handler) => self.handlers.set(channel, [...(self.handlers.get(channel) ?? []), handler]),
      onPeerJoin: (handler) => self.joins.push(handler),
      onPeerLeave: (handler) => self.leaves.push(handler),
      onError: () => undefined,
      peers: () => [...this.endpoints.values()].filter((e) => e !== self && e.alive).map((e) => e.id),
      ping: async () => this.latencyMs * 2,
      leave: () => this.drop(self.id),
    };
  }

  /** Simulates a short network drop: everyone sees the peer leave, then come back after `ms`. */
  blip(id: string, ms: number): void {
    const endpoint = this.endpoints.get(id);
    if (!endpoint || !endpoint.alive) return;
    endpoint.alive = false;
    this.later(() => {
      for (const other of this.endpoints.values()) if (other.alive) other.leaves.forEach((h) => h(id));
    });
    setTimeout(() => {
      endpoint.alive = true;
      for (const other of this.endpoints.values()) {
        if (other === endpoint || !other.alive) continue;
        other.joins.forEach((h) => h(id));
        endpoint.joins.forEach((h) => h(other.id));
      }
    }, ms);
  }

  /** Simulates a peer vanishing (closed tab, lost network). */
  drop(id: string): void {
    const endpoint = this.endpoints.get(id);
    if (!endpoint || !endpoint.alive) return;
    endpoint.alive = false;
    this.later(() => {
      for (const other of this.endpoints.values()) if (other.alive) other.leaves.forEach((h) => h(id));
    });
  }

  private later(fn: () => void): void {
    setTimeout(fn, this.latencyMs);
  }
}
