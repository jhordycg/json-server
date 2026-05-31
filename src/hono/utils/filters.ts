import { dirname } from "@std/path/dirname";
import { fromFileUrl as fileURLToPath } from "@std/path/from-file-url";
import { join } from "@std/path/join";

import { Eta } from "eta";

import type { Handler } from "@hono/hono/types";
import { parseWhere } from "../../parse-where.ts";
import { isItem } from "../../service.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

const isProduction = process.env["NODE_ENV"] === "production";

export type AppOptions = {
  logger?: boolean;
  static?: string[];
};

export const eta = new Eta({
  views: join(__dirname, "../views"),
  cache: isProduction,
});

const RESERVED_QUERY_KEYS = new Set([
  "_sort",
  "_page",
  "_per_page",
  "_embed",
  "_where",
]);

export function parseListParams(queryParams: Record<string, string[]>) {
  const params = new URLSearchParams(
    Object.entries(queryParams)
      .flatMap(([key, values]) => values.map((value) => [key, value])),
  );

  const filterParams = new URLSearchParams();
  for (const [key, value] of params.entries()) {
    if (!RESERVED_QUERY_KEYS.has(key)) {
      filterParams.append(key, value);
    }
  }

  let where = parseWhere(filterParams.toString());
  const rawWhere = params.get("_where");
  if (typeof rawWhere === "string") {
    try {
      const parsed = JSON.parse(rawWhere);
      if (typeof parsed === "object" && parsed !== null) {
        where = parsed;
      }
    } catch {
      // Ignore invalid JSON and fallback to parsed query params
    }
  }

  const pageRaw = params.get("_page");
  const perPageRaw = params.get("_per_page");
  const page = pageRaw === null ? undefined : Number.parseInt(pageRaw, 10);
  const perPage = perPageRaw === null
    ? undefined
    : Number.parseInt(perPageRaw, 10);

  return {
    where,
    sort: params.get("_sort") ?? undefined,
    page: Number.isNaN(page) ? undefined : page,
    perPage: Number.isNaN(perPage) ? undefined : perPage,
    embed: params.get("_embed")?.[0],
  };
}

export function withBodyHandler(
  action: (name: string, body: Record<string, unknown>) => Promise<unknown>,
): Handler {
  return async (ctx) => {
    const name = ctx.req.param("name") ?? "";
    const payload = await ctx.req.json();
    if (!isItem(payload)) {
      return ctx.json({ error: "Body must be a JSON object" }, 400);
    }
    return ctx.json({ data: await action(name, payload) });
  };
}

export function withIdAndBodyHandler(
  action: (
    name: string,
    id: string,
    body: Record<string, unknown>,
  ) => Promise<unknown>,
): Handler {
  return async (ctx) => {
    const name = ctx.req.param("name") ?? "";
    const id = ctx.req.param("id") ?? "";
    const payload = await ctx.req.json();

    if (!isItem(payload)) {
      return ctx.json({ error: "Body must be a JSON object" }, 400);
    }
    return ctx.json({ data: await action(name, id, payload) });
  };
}
