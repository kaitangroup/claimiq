import express from "express";
import session from "express-session";
import { createServer } from "http";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";

const app = express();
const httpServer = createServer(app);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Session store setup.
// connect-sqlite3 is CJS-only. We use a type-safe dynamic shim that works in
// both ESM dev (tsx) and the esbuild CJS bundle (production).
//
// In the CJS bundle `require` is a native global; in ESM (tsx dev) we create
// one via createRequire — but only when import.meta.url is defined.
async function createSessionStore() {
  let requireFn: NodeRequire;
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore — import.meta.url is undefined after esbuild CJS bundling
  if (typeof require !== "undefined") {
    // CJS context (production bundle) — require is already a global
    requireFn = require as NodeRequire;
  } else {
    // ESM context (tsx dev server) — create a local require
    const { createRequire } = await import("module");
    requireFn = createRequire(import.meta.url);
  }
  const SQLiteStoreFactory = requireFn("connect-sqlite3");
  return SQLiteStoreFactory(session);
}

(async () => {
  const SQLiteStore = await createSessionStore();

  app.use(session({
    store: new SQLiteStore({ db: "sessions.db", dir: "." }),
    secret: process.env.SESSION_SECRET || "claimiq-dev-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  }));

  registerRoutes(httpServer, app);

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    await setupVite(httpServer, app);
  }

  const port = Number(process.env.PORT || 5001);
  httpServer.listen(port, "0.0.0.0", () => {
    console.log(`ClaimIQ running on port ${port}`);
  });
})();
