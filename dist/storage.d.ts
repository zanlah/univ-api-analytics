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
export declare class AnalyticsStorage {
    private db;
    private insertStmt;
    private retentionDays;
    constructor(config?: AnalyticsConfig);
    private migrate;
    private cleanup;
    log(entry: RequestLog): void;
    getTagKeys(): string[];
    getInsightByTag(tagKey: string, hours?: number): any[];
    getTagTimeseries(tagKey: string, hours?: number, bucketMinutes?: number): any[];
    getOverview(hours?: number): {
        totals: any;
        byStatus: any[];
        topEndpoints: any[];
        slowEndpoints: any[];
        hours: number;
    };
    getTimeseries(hours?: number, bucketMinutes?: number): any[];
    getRecentErrors(limit?: number): any[];
    close(): void;
}
