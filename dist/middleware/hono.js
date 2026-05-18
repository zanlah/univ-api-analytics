import { AnalyticsStorage } from "../storage.js";
import { renderDashboard } from "../dashboard/template.js";
export function analytics(options = {}) {
    const dashboardPath = options.dashboardPath ?? "/analytics";
    const userExclude = options.exclude ?? [];
    const extractors = options.extract ?? {};
    const storage = new AnalyticsStorage(options);
    let resolvedDashboardPrefix = "";
    const middleware = async (c, next) => {
        const urlPath = new URL(c.req.url).pathname;
        if ((resolvedDashboardPrefix && urlPath.startsWith(resolvedDashboardPrefix)) ||
            userExclude.some((p) => urlPath === p || urlPath.startsWith(p + "/"))) {
            await next();
            return;
        }
        const start = performance.now();
        await next();
        const responseTime = Math.round((performance.now() - start) * 100) / 100;
        let tags;
        if (Object.keys(extractors).length > 0) {
            tags = {};
            for (const [key, fn] of Object.entries(extractors)) {
                try {
                    tags[key] = fn(c);
                }
                catch {
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
    function mount(app) {
        app.get(dashboardPath, (c) => {
            const actualPath = new URL(c.req.url).pathname;
            if (!resolvedDashboardPrefix) {
                resolvedDashboardPrefix = actualPath;
            }
            return c.html(renderDashboard(actualPath));
        });
        app.get(`${dashboardPath}/api/overview`, (c) => {
            const hours = Number(c.req.query("hours") ?? 24);
            return c.json(storage.getOverview(hours));
        });
        app.get(`${dashboardPath}/api/timeseries`, (c) => {
            const hours = Number(c.req.query("hours") ?? 24);
            const bucket = hours <= 6 ? 5 : hours <= 24 ? 15 : hours <= 168 ? 60 : 360;
            return c.json(storage.getTimeseries(hours, bucket));
        });
        app.get(`${dashboardPath}/api/errors`, (c) => {
            return c.json(storage.getRecentErrors());
        });
        app.get(`${dashboardPath}/api/recent-requests`, (c) => {
            const hours = Number(c.req.query("hours") ?? 1);
            const limit = Number(c.req.query("limit") ?? 200);
            return c.json(storage.getRecentRequests(hours, limit));
        });
        app.get(`${dashboardPath}/api/tags`, (c) => {
            return c.json(storage.getTagKeys());
        });
        app.get(`${dashboardPath}/api/insights`, (c) => {
            const tag = c.req.query("tag");
            if (!tag)
                return c.json({ error: "tag parameter required" }, 400);
            const hours = Number(c.req.query("hours") ?? 24);
            return c.json(storage.getInsightByTag(tag, hours));
        });
        app.get(`${dashboardPath}/api/tag-timeseries`, (c) => {
            const tag = c.req.query("tag");
            if (!tag)
                return c.json({ error: "tag parameter required" }, 400);
            const hours = Number(c.req.query("hours") ?? 24);
            const bucket = hours <= 6 ? 5 : hours <= 24 ? 15 : hours <= 168 ? 60 : 360;
            return c.json(storage.getTagTimeseries(tag, hours, bucket));
        });
    }
    return { middleware, mount };
}
