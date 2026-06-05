import { timingSafeEqual } from "node:crypto";
/**
 * Resolve dashboard credentials from explicit options or environment variables.
 * Returns `null` when no credentials are configured (dashboard stays open).
 */
export function resolveAuth(options = {}) {
    const user = options.authUser ?? process.env.ANALYTICS_AUTH_USER;
    const password = options.authPassword ?? process.env.ANALYTICS_AUTH_PASSWORD;
    if (user && password)
        return { user, password };
    return null;
}
function safeEqual(a, b) {
    const ab = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ab.length !== bb.length) {
        // Compare against self so the work done is independent of input length.
        timingSafeEqual(ab, ab);
        return false;
    }
    return timingSafeEqual(ab, bb);
}
/** Validate a `Authorization: Basic ...` header against the configured credentials. */
export function checkBasicAuth(authHeader, creds) {
    if (!authHeader || !authHeader.startsWith("Basic "))
        return false;
    let decoded;
    try {
        decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf8");
    }
    catch {
        return false;
    }
    const idx = decoded.indexOf(":");
    if (idx === -1)
        return false;
    const user = decoded.slice(0, idx);
    const password = decoded.slice(idx + 1);
    // Evaluate both comparisons (no short-circuit) to avoid leaking which part failed.
    const userOk = safeEqual(user, creds.user);
    const passOk = safeEqual(password, creds.password);
    return userOk && passOk;
}
export const WWW_AUTHENTICATE = 'Basic realm="API Analytics", charset="UTF-8"';
