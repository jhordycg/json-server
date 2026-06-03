import { Hono } from "@hono/hono";
import { cors } from "@hono/hono/cors";
import { serveStatic } from "@hono/hono/deno";
import type { Low } from "lowdb";
import rawTemplate from "../../views/index.html" with { type: "text" };
import { type Data, Service } from "../service.ts";
import { eta } from "./utils/eta.ts";
import {
  type AppOptions,
  parseListParams,
  withBodyHandler,
  withIdAndBodyHandler,
} from "./utils/filters.ts";
import { setupDb } from "./utils/setup-db.ts";

export function createApp(db: Low<Data>, options: AppOptions = {}): Hono {
  // Create service
  const service = new Service(db);

  // Create app
  const app = new Hono();

  const staticFiles = options.static ?? [];

  // Static files
  app.use("public/*", serveStatic({ path: staticFiles[0] }));

  // CORS
  app.use(cors({
    allowMethods: ["GET", "HEAD", "OPTIONS"],
    origin: (origin) => origin,
  }));

  app.notFound((ctx) => {
    return ctx.json({ error: "Not Found" }, 404);
  });

  // Body parser
  app.get("/", (ctx) => {
    return ctx.html(
      eta.renderString(rawTemplate, { data: db.data }) ??
        "Error rendering template",
    );
  });

  app.get("/:name", (ctx) => {
    const name = ctx.req.param("name") ?? "";
    const { where, sort, page, perPage, embed } = parseListParams(
      ctx.req.queries(),
    );

    const data = service.find(name, {
      where,
      sort,
      page,
      perPage,
      embed,
    });

    return ctx.json(data);
  });

  app.get("/:name/:id", (ctx) => {
    const name = ctx.req.param("name") ?? "";
    const id = ctx.req.param("id") ?? "";
    const data = service.findById(name, id, ctx.req.queries());
    return ctx.json(data);
  });

  app.post("/:name", withBodyHandler(service.create.bind(service)));

  app.put("/:name", withBodyHandler(service.update.bind(service)));

  app.put("/:name/:id", withIdAndBodyHandler(service.updateById.bind(service)));

  app.patch("/:name", withBodyHandler(service.patch.bind(service)));

  app.patch(
    "/:name/:id",
    withIdAndBodyHandler(service.patchById.bind(service)),
  );

  app.delete("/:name/:id", async (ctx) => {
    const name = ctx.req.param("name") ?? "";
    const id = ctx.req.param("id") ?? "";
    const dependent = ctx.req.query("_dependent");
    const data = await service.destroyById(name, id, dependent);
    return ctx.json(data);
  });

  return app;
}

export async function createServer(
  dbFile: string,
  options: AppOptions = {},
): Promise<Hono> {
  const db = await setupDb(dbFile);
  return createApp(db, options);
}
