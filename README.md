# univ-api-analytics

Drop-in API analytics middleware for **Hono** and **Express** with a built-in dashboard. Zero config, self-hosted, no external services.

- SQLite-backed (via better-sqlite3) — no extra infrastructure
- Dark-themed dashboard with charts (Chart.js)
- Custom tag extraction (group insights by user, API key, resource, etc.)
- Auto-cleanup with configurable retention
- Works with Hono v4+ and Express v4+

![Dashboard](https://raw.githubusercontent.com/zanlah/univ-api-analytics/main/docs/dashboard.png)

## Install

```bash
# From GitHub
npm install github:zanlah/univ-api-analytics
```

## Quick Start

### Hono

```ts
import { Hono } from "hono";
import { honoAnalytics } from "univ-api-analytics/hono";

const app = new Hono();

const { middleware, mount } = honoAnalytics({
  dashboardPath: "/analytics",
});

app.use("*", middleware);
mount(app);

// Dashboard available at /analytics
```

### Express

```ts
import express from "express";
import { expressAnalytics } from "univ-api-analytics/express";

const app = express();

app.use(expressAnalytics({
  dashboardPath: "/analytics",
}));

// Dashboard available at /analytics
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `dashboardPath` | `string` | `"/analytics"` | URL path for the dashboard |
| `dbPath` | `string` | `"./analytics.db"` | SQLite database file path |
| `retentionDays` | `number` | `30` | Days to keep request logs |
| `exclude` | `string[]` | `[]` | URL paths to skip logging |
| `extract` | `Record<string, Function>` | `{}` | Custom tag extractors |

## Custom Tags

Extract custom dimensions from requests and view grouped insights on the dashboard:

### Hono

```ts
const { middleware, mount } = honoAnalytics({
  dashboardPath: "/analytics",
  extract: {
    userId: (c) => c.req.header("X-User-Id"),
    resource: (c) => new URL(c.req.url).pathname.split("/")[1] || "root",
  },
});
```

### Express

```ts
app.use(expressAnalytics({
  dashboardPath: "/analytics",
  extract: {
    userId: (req) => req.headers["x-user-id"] || null,
    resource: (req) => req.url.split("/")[1] || "root",
  },
}));
```

Tags appear in the **Custom Insights** section of the dashboard with bar charts, timelines, and grouped tables.

## Dashboard Features

- **Stats cards**: total requests, avg/max response time, error count, error rate
- **Request timeline**: requests and errors over time
- **Status codes**: doughnut chart breakdown
- **Custom Insights**: per-tag bar charts, timelines, and detailed tables
- **Top endpoints**: most-hit routes with request counts
- **Slowest endpoints**: routes ranked by average response time
- **Recent errors**: last 50 error responses with details
- **Time ranges**: 1h, 6h, 24h, 7d, 30d
- **Auto-refresh**: every 30 seconds

## Dashboard API

The dashboard exposes JSON endpoints for programmatic access:

| Endpoint | Description |
|----------|-------------|
| `GET {dashboardPath}/api/overview?hours=24` | Stats, status codes, top/slow endpoints |
| `GET {dashboardPath}/api/timeseries?hours=24` | Request counts over time buckets |
| `GET {dashboardPath}/api/errors` | Recent error responses |
| `GET {dashboardPath}/api/tags` | Available tag keys |
| `GET {dashboardPath}/api/insights?tag=userId&hours=24` | Grouped stats by tag value |
| `GET {dashboardPath}/api/tag-timeseries?tag=userId&hours=24` | Tag value counts over time |

## Direct Storage Access

For advanced use cases you can use the storage layer directly:

```ts
import { AnalyticsStorage } from "univ-api-analytics";

const storage = new AnalyticsStorage({ dbPath: "./my-analytics.db" });

storage.log({
  method: "GET",
  path: "/api/users",
  status: 200,
  responseTime: 42.5,
  timestamp: new Date().toISOString(),
  tags: { userId: "123" },
});

const overview = storage.getOverview(24);
```

## License

MIT
