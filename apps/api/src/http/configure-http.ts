import type { INestApplication } from "@nestjs/common";
import type { Express } from "express";

/**
 * Express settings that depend on where the API runs.
 *
 * `trustProxyHops` — how many proxies of the hosting sit in front of the
 * API. Behind one, every request comes from the proxy's address, so the
 * rate limit on /auth/* would be one shared limit for all users (one
 * attacker could lock everyone out of logging in). Trusting exactly that
 * many hops takes the client's address from X-Forwarded-For; 0 (local, or
 * no proxy) ignores the header, so a forged one cannot reset the limit.
 */
export function configureHttp(app: INestApplication, options: { trustProxyHops: number }): void {
  if (options.trustProxyHops > 0) {
    const express = app.getHttpAdapter().getInstance() as Express;
    express.set("trust proxy", options.trustProxyHops);
  }
}
