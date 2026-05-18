import { AnalyticsStorage } from "../storage.js";
import { renderDashboard } from "../dashboard/template.js";
export function analytics(options = {}) {
    const dashboardPath = options.dashboardPath ?? "/analytics";
    const userExclude = options.exclude ?? [];
    const extractors = options.extract ?? {};
    const storage = new AnalyticsStorage(options);
    return function analyticsMiddleware(req, res, next) {
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
        if (urlPath === `${dashboardPath}/api/tags`) {
            res.json(storage.getTagKeys());
            return;
        }
        if (urlPath === `${dashboardPath}/api/insights`) {
            const tag = req.query?.tag;
            if (!tag) {
                res.json({ error: "tag parameter required" });
                return;
            }
            const hours = Number(req.query?.hours ?? 24);
            res.json(storage.getInsightByTag(tag, hours));
            return;
        }
        if (urlPath === `${dashboardPath}/api/tag-timeseries`) {
            const tag = req.query?.tag;
            if (!tag) {
                res.json({ error: "tag parameter required" });
                return;
            }
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
            let tags;
            if (Object.keys(extractors).length > 0) {
                tags = {};
                for (const [key, fn] of Object.entries(extractors)) {
                    try {
                        tags[key] = fn(req, res);
                    }
                    catch {
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
                ip: req.headers["x-forwarded-for"] ?? req.ip,
                userAgent: req.headers["user-agent"],
                tags,
            });
        });
        next();
    };
}
