import type { Context, MiddlewareHandler, Hono } from "hono";
import { AnalyticsStorage, type AnalyticsConfig } from "../storage.js";
import { renderDashboard } from "../dashboard/template.js";

export interface HonoAnalyticsOptions extends AnalyticsConfig {
  dashboardPath?: string;
  exclude?: string[];
  extract?: Record<string, (c: Context) => string | null>;
}

export function analytics(options: HonoAnalyticsOptions = {}): {
  middleware: MiddlewareHandler;
  mount: (app: Hono<any>) => void;
} {
  const dashboardPath = options.dashboardPath ?? "/analytics";
  const userExclude = options.exclude ?? [];
  const extractors = options.extract ?? {};
  const storage = new AnalyticsStorage(options);

  let resolvedDashboardPrefix = "";

  const middleware: MiddlewareHandler = async (c, next) => {
    const urlPath = new URL(c.req.url).pathname;

    if (
      (resolvedDashboardPrefix && urlPath.startsWith(resolvedDashboardPrefix)) ||
      userExclude.some((p) => urlPath === p || urlPath.startsWith(p + "/"))
    ) {
      await next();
      return;
    }

    const start = performance.now();
    await next();
    const responseTime = Math.round((performance.now() - start) * 100) / 100;

    let tags: Record<string, string | null> | undefined;
    if (Object.keys(extractors).length > 0) {
      tags = {};
      for (const [key, fn] of Object.entries(extractors)) {
        try {
          tags[key] = fn(c);
        } catch {
          tags[key] = null;
        }
      }
    }

    storage.log({
      method: c.req.method,
      path: urlPath,
      status: c.res.status,
      responseTime,
      timestamp: new Date().toISOString(),
      ip: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
      userAgent: c.req.header("user-agent"),
      tags,
    });
  };

  function mount(app: Hono<any>) {
    app.get(dashboardPath, (c: Context) => {
      const actualPath = new URL(c.req.url).pathname;
      if (!resolvedDashboardPrefix) {
        resolvedDashboardPrefix = actualPath;
      }
      return c.html(renderDashboard(actualPath));
    });

    app.get(`${dashboardPath}/api/overview`, (c: Context) => {
      const hours = Number(c.req.query("hours") ?? 24);
      return c.json(storage.getOverview(hours));
    });

    app.get(`${dashboardPath}/api/timeseries`, (c: Context) => {
      const hours = Number(c.req.query("hours") ?? 24);
      const bucket = hours <= 6 ? 5 : hours <= 24 ? 15 : hours <= 168 ? 60 : 360;
      return c.json(storage.getTimeseries(hours, bucket));
    });

    app.get(`${dashboardPath}/api/errors`, (c: Context) => {
      return c.json(storage.getRecentErrors());
    });

    app.get(`${dashboardPath}/api/recent-requests`, (c: Context) => {
      const hours = Number(c.req.query("hours") ?? 1);
      const limit = Number(c.req.query("limit") ?? 200);
      return c.json(storage.getRecentRequests(hours, limit));
    });

    app.get(`${dashboardPath}/api/tags`, (c: Context) => {
      return c.json(storage.getTagKeys());
    });

    app.get(`${dashboardPath}/api/insights`, (c: Context) => {
      const tag = c.req.query("tag");
      if (!tag) return c.json({ error: "tag parameter required" }, 400);
      const hours = Number(c.req.query("hours") ?? 24);
      return c.json(storage.getInsightByTag(tag, hours));
    });

    app.get(`${dashboardPath}/api/tag-timeseries`, (c: Context) => {
      const tag = c.req.query("tag");
      if (!tag) return c.json({ error: "tag parameter required" }, 400);
      const hours = Number(c.req.query("hours") ?? 24);
      const bucket = hours <= 6 ? 5 : hours <= 24 ? 15 : hours <= 168 ? 60 : 360;
      return c.json(storage.getTagTimeseries(tag, hours, bucket));
    });
  }

  return { middleware, mount };
}
