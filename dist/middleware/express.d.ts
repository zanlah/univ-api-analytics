import { type AnalyticsConfig } from "../storage.js";
import { type AuthOptions } from "../auth.js";
type Req = {
    method: string;
    url: string;
    originalUrl?: string;
    ip?: string;
    headers: Record<string, any>;
    query?: Record<string, any>;
};
type Res = {
    statusCode: number;
    on: (event: string, cb: () => void) => void;
    send: (body: string) => any;
    json: (body: any) => any;
    setHeader: (name: string, value: string) => void;
};
type Next = () => void;
export interface ExpressAnalyticsOptions extends AnalyticsConfig, AuthOptions {
    dashboardPath?: string;
    exclude?: string[];
    extract?: Record<string, (req: Req, res: Res) => string | null>;
}
export declare function analytics(options?: ExpressAnalyticsOptions): (req: Req, res: Res, next: Next) => void;
export {};
