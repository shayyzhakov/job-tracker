import type { ClientRegistry } from '../src/oauth/client-registry.js';

/** In-memory stand-in for the Cognito app client registry. */
export class FakeClientRegistry implements ClientRegistry {
  clients: { clientId: string; redirectUris: string[]; displayName: string }[] = [];
  private seq = 0;

  async create({ displayName, redirectUris }: { displayName: string; redirectUris: string[] }) {
    const clientId = `client-${++this.seq}`;
    this.clients.push({ clientId, displayName, redirectUris });
    return { clientId };
  }
  async list() {
    return this.clients.map((c) => ({ clientId: c.clientId }));
  }
  async remove(clientId: string) {
    this.clients = this.clients.filter((c) => c.clientId !== clientId);
  }
}
