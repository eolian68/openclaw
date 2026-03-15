/**
 * env.patch: Merge key-value pairs into ~/.openclaw/.env (or OPENCLAW_STATE_DIR/.env).
 *
 * Used by the model-config UI to persist DASHSCOPE_API_KEY and DASHSCOPE_BASE_URL.
 * Keys must match [A-Z_][A-Z0-9_]* (standard env var pattern).
 */
import fs from "node:fs";
import path from "node:path";
import { resolveConfigDir } from "../../utils.js";
import type { GatewayRequestHandlers } from "./types.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";

const ENV_KEY_RE = /^[A-Z_][A-Z0-9_]*$/;

function parseEnvFile(content: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq > 0) {
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (ENV_KEY_RE.test(key)) {
        result.set(key, value);
      }
    }
  }
  return result;
}

function formatEnvLine(key: string, value: string): string {
  if (/[ \t\n\r"']/.test(value)) {
    return `${key}="${String(value).replace(/"/g, '\\"')}"`;
  }
  return `${key}=${value}`;
}

export const envHandlers: GatewayRequestHandlers = {
  "env.patch": async ({ params, respond }) => {
    const vars = (params as { vars?: Record<string, string> }).vars;
    if (!vars || typeof vars !== "object" || Array.isArray(vars)) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "env.patch: vars (object) required"),
      );
      return;
    }
    const configDir = resolveConfigDir(process.env);
    const envPath = path.join(configDir, ".env");
    const invalidKeys = Object.keys(vars).filter((k) => !ENV_KEY_RE.test(k));
    if (invalidKeys.length > 0) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `env.patch: invalid key(s), must match [A-Z_][A-Z0-9_]*: ${invalidKeys.join(", ")}`,
        ),
      );
      return;
    }
    let existing = new Map<string, string>();
    if (fs.existsSync(envPath)) {
      try {
        const raw = fs.readFileSync(envPath, "utf8");
        existing = parseEnvFile(raw);
      } catch (err) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.UNAVAILABLE, `env.patch: failed to read .env: ${String(err)}`),
        );
        return;
      }
    }
    for (const [key, value] of Object.entries(vars)) {
      if (typeof value !== "string") {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, `env.patch: vars.${key} must be string`),
        );
        return;
      }
      existing.set(key, value);
    }
    try {
      await fs.promises.mkdir(configDir, { recursive: true });
      const lines = Array.from(existing.entries()).map(([k, v]) => formatEnvLine(k, v));
      await fs.promises.writeFile(envPath, lines.join("\n") + "\n", "utf8");
      respond(true, { ok: true, path: envPath }, undefined);
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, `env.patch: failed to write .env: ${String(err)}`),
      );
    }
  },
};
