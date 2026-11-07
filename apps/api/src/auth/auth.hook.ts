import type { onRequestAsyncHookHandler } from 'fastify';
import { parseBearer } from './bearer.js';
import type { TokenVerifier } from './token-verifier.js';

/** onRequest hook: requires a valid bearer token on every route in the scope it is added to. */
export function createAuthHook(verifier: TokenVerifier): onRequestAsyncHookHandler {
  return async (req, reply) => {
    const token = parseBearer(req.headers.authorization);
    if (!token) return reply.code(401).send({ message: 'Authentication required' });
    try {
      await verifier.verify(token);
    } catch (err) {
      req.log.info({ err: String(err) }, 'token rejected');
      return reply.code(401).send({ message: 'Invalid or expired token' });
    }
  };
}
