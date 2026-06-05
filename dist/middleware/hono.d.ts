import type { Context, MiddlewareHandler, Hono } from "hono";
import { type AnalyticsConfig } from "../storage.js";
import { type AuthOptions } from "../auth.js";
export interface HonoAnalyticsOptions extends AnalyticsConfig, AuthOptions {
    dashboardPath?: string;
    exclude?: string[];
    extract?: Record<string, (c: Context) => string | null>;
}
export declare function analytics(options?: HonoAnalyticsOptions): {
    middleware: MiddlewareHandler;
    mount: (app: Hono<any>) => void;
};
