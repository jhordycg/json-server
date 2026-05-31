import { Hono } from "@hono/hono";
import { assertInstanceOf } from "@std/assert/instance-of";
import { createServer } from "./main.ts";

Deno.test("Create a new Hono instance", async () => {
  const app = await createServer("fixtures/db.json");
  assertInstanceOf(app, Hono);
});

Deno.test("Create a new Hono instance (JSON5)", async () => {
  const app = await createServer("fixtures/db.json5");
  assertInstanceOf(app, Hono);
});
