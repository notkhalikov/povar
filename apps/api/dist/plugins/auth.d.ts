import type { FastifyInstance } from 'fastify';
export interface JwtPayload {
    sub: number;
    role: string;
    telegramId: number;
}
declare module '@fastify/jwt' {
    interface FastifyJWT {
        payload: JwtPayload;
        user: JwtPayload;
    }
}
declare module 'fastify' {
    interface FastifyInstance {
        authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    }
}
declare const _default: (app: FastifyInstance) => Promise<void>;
export default _default;
//# sourceMappingURL=auth.d.ts.map