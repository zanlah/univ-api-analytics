import Database from "better-sqlite3";
import path from "node:path";

export interface RequestLog {
  method: string;
  path: string;
  status: number;
  responseTime: number;
  timestamp: string;
  ip?: string;
  userAgent?: string;
  tags?: Record<string, string | null>;
}

export interface AnalyticsConfig {
  dbPath?: string;
  retentionDays?: number;
}

export class AnalyticsStorage {
  private db: Database.Database;
  private insertStmt: Database.Statement;
  private retentionDays: number;

  constructor(config: AnalyticsConfig = {}) {
    const dbPath = config.dbPath ?? path.join(process.cwd(), "analytics.db");
    this.retentionDays = config.retentionDays ?? 30;
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.migrate();

    this.insertStmt = this.db.prepare(`
      INSERT INTO requests (method, path, status, response_time, timestamp, ip, user_agent, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.cleanup();
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        status INTEGER NOT NULL,
        response_time REAL NOT NULL,
        timestamp TEXT NOT NULL,
        ip TEXT,
        user_agent TEXT,
        tags TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_requests_timestamp ON requests(timestamp);
      CREATE INDEX IF NOT EXISTS idx_requests_path ON requests(path);
    `);

    // Add tags column if upgrading from older schema
    try {
      this.db.exec(`ALTER TABLE requests ADD COLUMN tags TEXT`);
    } catch {
      // Column already exists
    }
  }

  private cleanup() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.retentionDays);
    this.db
      .prepare("DELETE FROM requests WHERE timestamp < ?")
      .run(cutoff.toISOString());
  }

  log(entry: RequestLog) {
    const tags = entry.tags && Object.keys(entry.tags).length > 0
      ? JSON.stringify(entry.tags)
      : null;

    this.insertStmt.run(
      entry.method,
      entry.path,
      entry.status,
      entry.responseTime,
      entry.timestamp,
      entry.ip ?? null,
      entry.userAgent ?? null,
      tags
    );
  }

  getTagKeys(): string[] {
    const rows = this.db
      .prepare(
        `SELECT DISTINCT tags FROM requests
         WHERE tags IS NOT NULL
         ORDER BY timestamp DESC LIMIT 500`
      )
      .all() as any[];

    const keys = new Set<string>();
    for (const row of rows) {
      try {
        const parsed = JSON.parse(row.tags);
        for (const k of Object.keys(parsed)) keys.add(k);
      } catch {}
    }
    return [...keys].sort();
  }

  getInsightByTag(tagKey: string, hours = 24) {
    const since = new Date(Date.now() - hours * 3600_000).toISOString();

    const rows = this.db
      .prepare(
        `SELECT
          json_extract(tags, '$.' || ?) as tagValue,
          COUNT(*) as count,
          ROUND(AVG(response_time), 1) as avgTime,
          ROUND(MAX(response_time), 1) as maxTime,
          SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) as errors
        FROM requests
        WHERE timestamp >= ? AND tags IS NOT NULL AND json_extract(tags, '$.' || ?) IS NOT NULL
        GROUP BY tagValue
        ORDER BY count DESC`
      )
      .all(tagKey, since, tagKey) as any[];

    return rows;
  }

  getTagTimeseries(tagKey: string, hours = 24, bucketMinutes = 60) {
    const since = new Date(Date.now() - hours * 3600_000).toISOString();

    const rows = this.db
      .prepare(
        `SELECT
          json_extract(tags, '$.' || ?) as tagValue,
          strftime('%Y-%m-%dT%H:', timestamp) ||
            printf('%02d', (CAST(strftime('%M', timestamp) AS INTEGER) / ?) * ?) || ':00' as bucket,
          COUNT(*) as count
        FROM requests
        WHERE timestamp >= ? AND tags IS NOT NULL AND json_extract(tags, '$.' || ?) IS NOT NULL
        GROUP BY tagValue, bucket
        ORDER BY bucket`
      )
      .all(tagKey, bucketMinutes, bucketMinutes, since, tagKey) as any[];

    return rows;
  }

  getOverview(hours = 24) {
    const since = new Date(Date.now() - hours * 3600_000).toISOString();

    const totals = this.db
      .prepare(
        `SELECT
          COUNT(*) as totalRequests,
          ROUND(AVG(response_time), 1) as avgResponseTime,
          ROUND(MIN(response_time), 1) as minResponseTime,
          ROUND(MAX(response_time), 1) as maxResponseTime,
          SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) as errorCount
        FROM requests WHERE timestamp >= ?`
      )
      .get(since) as any;

    const byStatus = this.db
      .prepare(
        `SELECT
          CASE
            WHEN status >= 200 AND status < 300 THEN '2xx'
            WHEN status >= 300 AND status < 400 THEN '3xx'
            WHEN status >= 400 AND status < 500 THEN '4xx'
            WHEN status >= 500 THEN '5xx'
          END as statusGroup,
          COUNT(*) as count
        FROM requests WHERE timestamp >= ?
        GROUP BY statusGroup ORDER BY statusGroup`
      )
      .all(since) as any[];

    const topEndpoints = this.db
      .prepare(
        `SELECT
          method, path,
          COUNT(*) as count,
          ROUND(AVG(response_time), 1) as avgTime,
          ROUND(MAX(response_time), 1) as maxTime
        FROM requests WHERE timestamp >= ?
        GROUP BY method, path
        ORDER BY count DESC LIMIT 20`
      )
      .all(since) as any[];

    const slowEndpoints = this.db
      .prepare(
        `SELECT
          method, path,
          COUNT(*) as count,
          ROUND(AVG(response_time), 1) as avgTime,
          ROUND(MAX(response_time), 1) as maxTime
        FROM requests WHERE timestamp >= ?
        GROUP BY method, path
        ORDER BY avgTime DESC LIMIT 10`
      )
      .all(since) as any[];

    return { totals, byStatus, topEndpoints, slowEndpoints, hours };
  }

  getTimeseries(hours = 24, bucketMinutes = 60) {
    const since = new Date(Date.now() - hours * 3600_000).toISOString();

    const rows = this.db
      .prepare(
        `SELECT
          strftime('%Y-%m-%dT%H:', timestamp) ||
            printf('%02d', (CAST(strftime('%M', timestamp) AS INTEGER) / ?) * ?) || ':00' as bucket,
          COUNT(*) as count,
          ROUND(AVG(response_time), 1) as avgTime,
          SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) as errors
        FROM requests WHERE timestamp >= ?
        GROUP BY bucket ORDER BY bucket`
      )
      .all(bucketMinutes, bucketMinutes, since) as any[];

    return rows;
  }

  getRecentErrors(limit = 50) {
    return this.db
      .prepare(
        `SELECT method, path, status, response_time, timestamp, ip, user_agent, tags
        FROM requests WHERE status >= 400
        ORDER BY timestamp DESC LIMIT ?`
      )
      .all(limit) as any[];
  }

  close() {
    this.db.close();
  }
}
