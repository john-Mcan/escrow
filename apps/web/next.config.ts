import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
import { updateInitialEnv } from "@next/env";
import type { NextConfig } from "next";

// Un único `.env` en la raíz del monorepo, compartido por Foundry y Next.js. Las variables ya definidas
// (entorno del hosting o `apps/web/.env.local`) tienen prioridad. `updateInitialEnv` evita que Next las descarte
// al recargar su propio entorno en los workers de build.
const rootEnvFile = path.resolve(__dirname, "../../.env");
if (existsSync(rootEnvFile)) {
  const rootEnv = Object.fromEntries(
    Object.entries(parseEnv(readFileSync(rootEnvFile, "utf8"))).filter(([key]) => process.env[key] === undefined),
  );
  Object.assign(process.env, rootEnv);
  updateInitialEnv(rootEnv);
}

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  transpilePackages: ["@escrow/shared"],
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  webpack(config) {
    // Dependencias opcionales de WalletConnect/MetaMask SDK que no aplican en web.
    config.externals.push("pino-pretty", "lokijs", "encoding");
    config.resolve.fallback = { ...config.resolve.fallback, "@react-native-async-storage/async-storage": false };
    return config;
  },
};

export default nextConfig;
