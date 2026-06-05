import { Hono } from '@hono/hono'
import { createFactory, createMiddleware } from '@hono/hono/factory'
import type { HonoOptions } from '@hono/hono/hono-base'
import type { Handler } from '@hono/hono/types'
import { parse } from '@std/path/parse'
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

function findAllHandler(): Handler {
  return (ctx) => {
    const resource = parse(ctx.req.path).name
    const service = ctx.var.service

    const options = parseListParams(ctx.req.queries())
    const data = service.find(resource, options)

    return ctx.json(data)
  }
}

function findByIdHandler(): Handler {
  return (ctx) => {
    const resource = parse(ctx.req.path).name
    const service = ctx.var.service

    const id = ctx.req.param('id')
    const data = service.findById(resource, id, ctx.req.queries())

    return ctx.json(data)
  }
}

function createHandler(): Handler {
  return async (ctx) => {
    const resource = parse(ctx.req.path).name
    const service = ctx.var.service

    const action = service.create.bind(service)

    const payload = await ctx.req.json()
    if (!isItem(payload)) {
      return ctx.json({ error: 'Body must be a JSON object' }, 400)
    }
    return ctx.json({ data: await action(resource, payload) })
  }
}

function replaceHandler(): Handler {
  return async (ctx) => {
    const resource = parse(ctx.req.path).name
    const service = ctx.var.service

    const action = service.update.bind(service)
    const payload = await ctx.req.json()

    if (!isItem(payload)) {
      return ctx.json({ error: 'Body must be a JSON object' }, 400)
    }
    return ctx.json({ data: await action(resource, payload) })
  }
}

function replaceOneHandler(): Handler {
  return async (ctx) => {
    const resource = parse(ctx.req.path).name
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

function updateHandler(): Handler {
  return async (ctx) => {
    const resource = parse(ctx.req.path).name
    const service = ctx.var.service

    const action = service.patch.bind(service)
    const payload = await ctx.req.json()

    if (!isItem(payload)) {
      return ctx.json({ error: 'Body must be a JSON object' }, 400)
    }
    return ctx.json({ data: await action(resource, payload) })
  }
}

function updateOneHandler(): Handler {
  return async (ctx) => {
    const resource = parse(ctx.req.path).name
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

function deleteOneHandler(): Handler {
  return async (ctx) => {
    const resource = parse(ctx.req.path).name
    const service = ctx.var.service
    const id = ctx.req.param('id') ?? ''
    const dependent = ctx.req.query('_dependent')

    const data = await service.destroyById(resource, id, dependent)

    return ctx.json(data)
  }
}

const crudFactory = createFactory<Env>({
  initApp(app) {
    app.get('/', findAllHandler())
    app.get('/:id', findByIdHandler())

    app.post('/', createHandler())

    app.put('/', replaceHandler())
    app.put('/:id', replaceOneHandler())

    app.patch('/', updateHandler())
    app.patch('/:id', updateOneHandler())

    app.delete('/:id', deleteOneHandler())

    return app
  },
})

export function crudLowDB(db: Low<Data>) {
  return createMiddleware<Env>((ctx, next) => {
    ctx.set('service', new Service(db))
    return next()
  })
}

export function loadHomePage(db: Low<Data>) {
  return eta.renderString(template, db)
}

export async function createApp(dbFile: string, options?: HonoOptions<Env>) {
  const db = await setupDb(dbFile)
  const app = new Hono(options)

  app.use(crudLowDB(db))
  app.get('/', (ctx) => ctx.html(loadHomePage(db)))

  const api = app.basePath('api')

  for (const key of Object.keys(db.data)) {
    api.route(key, crudFactory.createApp())
  }

  return app
}
