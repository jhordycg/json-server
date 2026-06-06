import { createFactory, createMiddleware, type Factory } from '@hono/hono/factory'
import type { Handler, MiddlewareHandler } from '@hono/hono/types'
import type { Low } from 'lowdb'
import { type Data, isItem, Service } from '../service.ts'
import { template } from './template.ts'
import { eta } from './utils/eta.ts'
import { parseListParams } from './utils/filters.ts'
import { setupDb } from './utils/setup-db.ts'

type Env = {
  Variables: {
    db: Low<Data>
    service: Service
  }
}

function findAllHandler(resource: string): Handler {
  return (ctx) => {
    const service = ctx.var.service

    const options = parseListParams(ctx.req.queries())
    const data = service.find(resource, options)

    return ctx.json(data)
  }
}

function findByIdHandler(resource: string): Handler {
  return (ctx) => {
    const service = ctx.var.service

    const id = ctx.req.param('id')
    const data = service.findById(resource, id, ctx.req.queries())

    return ctx.json(data)
  }
}

function createHandler(resource: string): Handler {
  return async (ctx) => {
    const service = ctx.var.service

    const action = service.create.bind(service)

    const payload = await ctx.req.json()
    if (!isItem(payload)) {
      return ctx.json({ error: 'Body must be a JSON object' }, 400)
    }
    return ctx.json({ data: await action(resource, payload) })
  }
}

function replaceHandler(resource: string): Handler {
  return async (ctx) => {
    const service = ctx.var.service

    const action = service.update.bind(service)
    const payload = await ctx.req.json()

    if (!isItem(payload)) {
      return ctx.json({ error: 'Body must be a JSON object' }, 400)
    }
    return ctx.json({ data: await action(resource, payload) })
  }
}

function replaceOneHandler(resource: string): Handler {
  return async (ctx) => {
    const service = ctx.var.service

    const action = service.updateById.bind(service)

    const id = ctx.req.param('id') ?? ''
    const payload = await ctx.req.json()

    if (!isItem(payload)) {
      return ctx.json({ error: 'Body must be a JSON object' }, 400)
    }
    return ctx.json({ data: await action(resource, id, payload) })
  }
}

function updateHandler(resource: string): Handler {
  return async (ctx) => {
    const service = ctx.var.service

    const action = service.patch.bind(service)
    const payload = await ctx.req.json()

    if (!isItem(payload)) {
      return ctx.json({ error: 'Body must be a JSON object' }, 400)
    }
    return ctx.json({ data: await action(resource, payload) })
  }
}

function updateOneHandler(resource: string): Handler {
  return async (ctx) => {
    const service = ctx.var.service

    const action = service.patchById.bind(service)

    const id = ctx.req.param('id') ?? ''
    const payload = await ctx.req.json()

    if (!isItem(payload)) {
      return ctx.json({ error: 'Body must be a JSON object' }, 400)
    }
    return ctx.json({ data: await action(resource, id, payload) })
  }
}

function deleteOneHandler(resource: string): Handler {
  return async (ctx) => {
    const service = ctx.var.service
    const id = ctx.req.param('id') ?? ''
    const dependent = ctx.req.query('_dependent')

    const data = await service.destroyById(resource, id, dependent)

    return ctx.json(data)
  }
}

export function crudLowDB(db: Low<Data>): MiddlewareHandler<Env> {
  return createMiddleware<Env>((ctx, next) => {
    ctx.set('service', new Service(db))
    return next()
  })
}

export function loadHomePage(db: Low<Data>): string {
  return eta.renderString(template, db)
}

export async function jsonServerFactory(
  dbFile: string,
): Promise<Factory<Env, string>> {
  const db = await setupDb(dbFile)

  return createFactory({
    initApp(app) {
      app.use(crudLowDB(db))
      app.get('/', (ctx) => ctx.html(loadHomePage(db)))

      for (const resource of Object.keys(db.data)) {
        app.basePath(`api/${resource}`)
          .post(createHandler(resource))
          .put(replaceHandler(resource))
          .patch(updateHandler(resource))
          .get(findAllHandler(resource))
          .basePath('/:id')
          .get(findByIdHandler(resource))
          .patch(updateOneHandler(resource))
          .put(replaceOneHandler(resource))
          .delete(deleteOneHandler(resource))
      }

      return app
    },
  })
}
