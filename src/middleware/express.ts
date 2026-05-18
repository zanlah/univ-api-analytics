import { AnalyticsStorage, type AnalyticsConfig } from "../storage.js";
import { renderDashboard } from "../dashboard/template.js";

type Req = { method: string; url: string; originalUrl?: string; ip?: string; headers: Record<string, any>; query?: Record<string, any> };
type Res = { statusCode: number; on: (event: string, cb: () => void) => void; send: (body: string) => any; json: (body: any) => any; setHeader: (name: string, value: string) => void };
type Next = () => void;

export interface ExpressAnalyticsOptions extends AnalyticsConfig {
  dashboardPath?: string;
  exclude?: string[];
  extract?: Record<string, (req: Req, res: Res) => string | null>;
}

export function analytics(options: ExpressAnalyticsOptions = {}) {
  const dashboardPath = options.dashboardPath ?? "/analytics";
  const userExclude = options.exclude ?? [];
  const extractors = options.extract ?? {};
  const storage = new AnalyticsStorage(options);

  return function analyticsMiddleware(req: Req, res: Res, next: Next) {
    const fullPath = req.originalUrl ?? req.url;
    const urlPath = fullPath.split("?")[0];

    // Dashboard routes
    if (urlPath === dashboardPath) {
      res.setHeader("Content-Type", "text/html");
      res.send(renderDashboard(dashboardPath));
      return;
    }
    if (urlPath === `${dashboardPath}/api/overview`) {
      const hours = Number(req.query?.hours ?? 24);
      res.json(storage.getOverview(hours));
      return;
    }
    if (urlPath === `${dashboardPath}/api/timeseries`) {
      const hours = Number(req.query?.hours ?? 24);
      const bucket = hours <= 6 ? 5 : hours <= 24 ? 15 : hours <= 168 ? 60 : 360;
      res.json(storage.getTimeseries(hours, bucket));
      return;
    }
    if (urlPath === `${dashboardPath}/api/errors`) {
      res.json(storage.getRecentErrors());
      return;
    }
    if (urlPath === `${dashboardPath}/api/recent-requests`) {
      const hours = Number(req.query?.hours ?? 1);
      const limit = Number(req.query?.limit ?? 200);
      res.json(storage.getRecentRequests(hours, limit));
      return;
    }
    if (urlPath === `${dashboardPath}/api/tags`) {
      res.json(storage.getTagKeys());
      return;
    }
    if (urlPath === `${dashboardPath}/api/insights`) {
      const tag = req.query?.tag as string;
      if (!tag) { res.json({ error: "tag parameter required" }); return; }
      const hours = Number(req.query?.hours ?? 24);
      res.json(storage.getInsightByTag(tag, hours));
      return;
    }
    if (urlPath === `${dashboardPath}/api/tag-timeseries`) {
      const tag = req.query?.tag as string;
      if (!tag) { res.json({ error: "tag parameter required" }); return; }
      const hours = Number(req.query?.hours ?? 24);
      const bucket = hours <= 6 ? 5 : hours <= 24 ? 15 : hours <= 168 ? 60 : 360;
      res.json(storage.getTagTimeseries(tag, hours, bucket));
      return;
    }

    if (userExclude.some((p) => urlPath === p || urlPath.startsWith(p + "/"))) {
      next();
      return;
    }

    const start = performance.now();

    res.on("finish", () => {
      const responseTime = Math.round((performance.now() - start) * 100) / 100;

      let tags: Record<string, string | null> | undefined;
      if (Object.keys(extractors).length > 0) {
        tags = {};
        for (const [key, fn] of Object.entries(extractors)) {
          try {
            tags[key] = fn(req, res);
          } catch {
            tags[key] = null;
          }
        }
      }

      storage.log({
        method: req.method,
        path: urlPath,
        status: res.statusCode,
        responseTime,
        timestamp: new Date().toISOString(),
        ip: req.headers["x-forwarded-for"] as string ?? req.ip,
        userAgent: req.headers["user-agent"] as string,
        tags,
      });
    });

    next();
  };
}
