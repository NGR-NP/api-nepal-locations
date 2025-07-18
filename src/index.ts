import { Hono } from "hono";
import type { Context } from "hono";

// Minimal D1Database type for this file
interface D1Database {
  prepare(query: string): {
    all(): Promise<{ results: any[] }>;
    bind(...params: any[]): { all(): Promise<{ results: any[] }> };
  };
}

// Cloudflare KV type
interface KVNamespace {
  get(
    key: string,
    type?: "text" | "json" | "arrayBuffer" | "stream"
  ): Promise<any>;
  put(
    key: string,
    value: string,
    options?: { expiration?: number; expirationTtl?: number }
  ): Promise<void>;
}

// Language type
type Lang = "en" | "np";
type columnName = "name_en" | "name_np";
type columnNameSearch = "name_en_search" | "name_np_search";
const nameLang = {
  en: "en",
  np: "np",
} as Record<Lang, Lang>;

const arrLang = Object.values(nameLang);
type Env = {
  DB: D1Database;
  RATE_LIMIT_KV: KVNamespace;
};

// Variables for Hono context
interface Variables {
  lang: Lang;
  name: string;
}
const nameColumn = {
  en: "name_en",
  np: "name_np",
} as Record<Lang, columnName>;
const arrNameColumn = Object.values(nameColumn);

const searchNameColumn = {
  en: "name_en_search",
  np: "name_np_search",
} as Record<Lang, columnNameSearch>;
const arrSearchNameColumn = Object.values(searchNameColumn);
// Resource types
type Province = { id: number; name: string };
type District = { id: number; name: string };
type Municipality = { id: number; name: string };
type Ward = { id: number; name: string };

const app = new Hono<{ Bindings: Env }>();

// Health check route
app.get("/", (c) => c.json({ message: "Nepal Location API is running!" }));

// Create a sub-app for the language group
const langApp = new Hono<{ Bindings: Env; Variables: Variables }>();

// Rate limiting middleware (60 requests per minute per IP)
const RATE_LIMIT = 60;
const WINDOW = 60; // seconds
langApp.use("*", async (c, next) => {
  const kv = c.env.RATE_LIMIT_KV;
  const ip =
    c.req.header("cf-connecting-ip") ||
    c.req.header("x-forwarded-for") ||
    "unknown";
  const key = `rl:${ip}`;
  const now = Math.floor(Date.now() / 1000);
  const data = (await kv.get(key, "json")) as {
    count: number;
    reset: number;
  } | null;
  if (data && data.reset > now) {
    if (data.count >= RATE_LIMIT) {
      return c.json({ error: "Rate limit exceeded", reset: data.reset }, 429);
    }
    await kv.put(
      key,
      JSON.stringify({ count: data.count + 1, reset: data.reset }),
      { expirationTtl: WINDOW }
    );
  } else {
    await kv.put(key, JSON.stringify({ count: 1, reset: now + WINDOW }), {
      expirationTtl: WINDOW,
    });
  }
  await next();
});

// Middleware to validate lang and set nameColumn
langApp.use("*", async (c, next) => {
  const lang = c.req.param("lang") as Lang;
  if (!arrLang.includes(lang)) {
    return c.json({ error: "Invalid language" }, 400);
  }
  c.set("lang", lang);
  c.set("name", lang === nameLang.en ? nameColumn.en : nameColumn.np);
  await next();
});

// Helper: parse and validate integer query param
function parseIntParam(
  value: string | undefined,
  name: string,
  c: Context
): number | undefined {
  if (value === undefined) return undefined;
  if (!/^[0-9]+$/.test(value)) {
    c.json({ error: `${name} must be an integer` }, 400);
    throw new Error("invalid_param");
  }
  return Number(value);
}

// Helper: parse and validate limit/offset, with optional max limit
function parseLimitOffset(c: Context, maxLimit = 50) {
  const limit = parseInt(c.req.query("limit") || "20", 10);
  const offset = parseInt(c.req.query("offset") || "0", 10);
  return {
    limit: isNaN(limit) || limit < 1 ? 20 : Math.min(limit, maxLimit),
    offset: isNaN(offset) || offset < 0 ? 0 : offset,
  };
}

// /provinces with search
langApp.get("/provinces", async (c) => {
  try {
    const db = c.env.DB;
    const nameColumn = c.get("name") as columnName;
    const lang = c.get("lang");
    const search = c.req.query("s");
    if (search && search.length > 30) {
      return c.json(
        { error: "Search string too long (max 30 characters)" },
        400
      );
    }
    // If searching, limit results to max 20 (default 10)
    const { limit, offset } = search
      ? parseLimitOffset(c, 20)
      : parseLimitOffset(c);
    let sql = `SELECT id, ${nameColumn} as name FROM provinces`;
    let params: any[] = [];
    if (search) {
      const searchColumn =
        lang === nameLang.en ? searchNameColumn.en : searchNameColumn.np;
      sql += ` WHERE ${searchColumn} LIKE ?`;
      params.push(`%${search.toLowerCase()}%`);
    }
    sql += " LIMIT ? OFFSET ?";
    params.push(search ? limit || 10 : limit, offset);
    const { results } = await db
      .prepare(sql)
      .bind(...params)
      .all();
    return c.json({ count: results.length, data: results as Province[] });
  } catch (err) {
    console.error("Error in /en/provinces:", err);
    if ((err as Error).message === "invalid_param") return;
    return c.json({ error: "Internal server error" }, 500);
  }
});

const province_id = { q: "of-p", col: "province_id" };

// /districts?province_id=1 with search
langApp.get("/districts", async (c) => {
  try {
    const db = c.env.DB;
    const nameColumn = c.get("name") as columnName;
    const lang = c.get("lang");
    const search = c.req.query("s");
    if (search && search.length > 30) {
      return c.json(
        { error: "Search string too long (max 30 characters)" },
        400
      );
    }
    const provinceId = parseIntParam(
      c.req.query(province_id.q),
      province_id.col,
      c
    );
    const { limit, offset } = search
      ? parseLimitOffset(c, 20)
      : parseLimitOffset(c);
    let sql = `SELECT id, ${nameColumn} as name FROM districts`;
    let params: any[] = [];
    let where: string[] = [];
    if (provinceId !== undefined) {
      where.push("province_id = ?");
      params.push(provinceId);
    }
    if (search) {
      const searchColumn =
        lang === nameLang.en ? searchNameColumn.en : searchNameColumn.np;
      where.push(`${searchColumn} LIKE ?`);
      params.push(`%${search.toLowerCase()}%`);
    }
    if (where.length > 0) {
      sql += " WHERE " + where.join(" AND ");
    }
    sql += " LIMIT ? OFFSET ?";
    params.push(search ? limit || 10 : limit, offset);
    const { results } = await db
      .prepare(sql)
      .bind(...params)
      .all();
    return c.json({ count: results.length, data: results as District[] });
  } catch (err) {
    if ((err as Error).message === "invalid_param") return;
    return c.json({ error: "Internal server error" }, 500);
  }
});

const district_id = { q: "of-d", col: "district_id" };

// /municipalities?district_id=1 with search
langApp.get("/municipalities", async (c) => {
  try {
    const db = c.env.DB;
    const nameColumn = c.get("name") as columnName;
    const lang = c.get("lang");
    const search = c.req.query("s");
    if (search && search.length > 30) {
      return c.json(
        { error: "Search string too long (max 30 characters)" },
        400
      );
    }
    const districtId = parseIntParam(
      c.req.query(district_id.q),
      district_id.col,
      c
    );
    const { limit, offset } = search
      ? parseLimitOffset(c, 20)
      : parseLimitOffset(c);
    let sql = `SELECT id, ${nameColumn} as name FROM municipalities`;
    let params: any[] = [];
    let where: string[] = [];
    if (districtId !== undefined) {
      where.push("district_id = ?");
      params.push(districtId);
    }
    if (search) {
      const searchColumn =
        lang === nameLang.en ? searchNameColumn.en : searchNameColumn.np;
      where.push(`${searchColumn} LIKE ?`);
      params.push(`%${search.toLowerCase()}%`);
    }
    if (where.length > 0) {
      sql += " WHERE " + where.join(" AND ");
    }
    sql += " LIMIT ? OFFSET ?";
    params.push(search ? limit || 10 : limit, offset);
    const { results } = await db
      .prepare(sql)
      .bind(...params)
      .all();
    return c.json({ count: results.length, data: results as Municipality[] });
  } catch (err) {
    if ((err as Error).message === "invalid_param") return;
    return c.json({ error: "Internal server error" }, 500);
  }
});

const municipality_id = { q: "of-m", col: "municipality_id" };

// /wards?municipality_id=1 with search (search on name only)
langApp.get("/wards", async (c) => {
  try {
    const db = c.env.DB;
    const offset = c.req.query("skip");
    const municipalityId = parseIntParam(
      c.req.query(municipality_id.q),
      municipality_id.col,
      c
    );

    //
    let sql = `SELECT id, name as name FROM wards`;
    let params: any[] = [];
    let where: string[] = [];

    if (municipalityId !== undefined) {
      where.push("municipality_id = ?");
      params.push(municipalityId);
    }
    if (offset) {
      const offsetInt = parseInt(offset);
      if (isNaN(offsetInt) || offsetInt < 0) {
        return c.json({ error: "Invalid offset" }, 400);
      }
    }
    sql += " LIMIT ? OFFSET ?";

    params.push(10, offset ? parseInt(offset) : 1);
    if (where.length > 0) {
      sql += " WHERE " + where.join(" AND ");
    }
    const { results } = await db
      .prepare(sql)
      .bind(...params)
      .all();
    return c.json({ count: results.length, data: results as Ward[] });
  } catch (err) {
    if ((err as Error).message === "invalid_param") return;
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Add a route to get all wards for a given municipality_id (no lang, just name)
app.get("/ward/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  if (!/^[1-9][0-9]*$/.test(id)) {
    return c.json({ error: "Invalid municipality id" }, 400);
  }
  try {
    const sql = "SELECT id, name FROM wards WHERE municipality_id = ?";
    const { results } = await db.prepare(sql).bind(Number(id)).all();
    // Transform name from comma-separated string to array of numbers
    const transformed = (results as { id: number; name: string }[]).map(
      (row) => ({
        id: row.id,
        name: row.name
          .split(",")
          .map((s) => Number(s.trim()))
          .filter((n) => !isNaN(n)),
      })
    );
    return c.json(transformed);
  } catch (err) {
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Mount the langApp at /:lang
app.route("/:lang", langApp);

export default app;
