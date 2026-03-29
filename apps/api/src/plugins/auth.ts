import fp from 'fastify-plugin'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import fjwt from '@fastify/jwt'

export interface JwtPayload {
  sub: number
  role: string
  telegramId: number
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload
    user: JwtPayload
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

export default fp(async (app: FastifyInstance) => {
  await app.register(fjwt, {
    secret: process.env.JWT_SECRET!,
  })

  app.decorate(
    'authenticate',
    async (req: FastifyRequest, reply: FastifyReply) => {
      await req.jwtVerify()
    },
  )
})
