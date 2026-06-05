export interface AuthOptions {
    /** Dashboard username. Falls back to `ANALYTICS_AUTH_USER` env var. */
    authUser?: string;
    /** Dashboard password. Falls back to `ANALYTICS_AUTH_PASSWORD` env var. */
    authPassword?: string;
}
export interface Credentials {
    user: string;
    password: string;
}
/**
 * Resolve dashboard credentials from explicit options or environment variables.
 * Returns `null` when no credentials are configured (dashboard stays open).
 */
export declare function resolveAuth(options?: AuthOptions): Credentials | null;
/** Validate a `Authorization: Basic ...` header against the configured credentials. */
export declare function checkBasicAuth(authHeader: string | null | undefined, creds: Credentials): boolean;
export declare const WWW_AUTHENTICATE = "Basic realm=\"API Analytics\", charset=\"UTF-8\"";
