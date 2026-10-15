const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { promisify } = require("node:util");
const { DatabaseSync } = require("node:sqlite");

const scrypt = promisify(crypto.scrypt);
const webRoot = path.resolve(__dirname, "../Web");
const sessionHours = 12;
const cookieName = "le_cabinet";
const randomToken = () => crypto.randomBytes(32).toString("base64url");
const digest = (value) => crypto.createHash("sha256").update(value).digest("hex");
const equal = (a, b) => {
  const first = Buffer.from(String(a)), second = Buffer.from(String(b));
  return first.length === second.length && crypto.timingSafeEqual(first, second);
};
const passwordHash = async (password, salt) => (await scrypt(password, salt, 64, {
  N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024,
})).toString("hex");

function validateArchive(items) {
  if (!Array.isArray(items) || items.length > 2000) throw new Error("Invalid archive");
  const ids = new Set();
  for (const item of items) {
    if (!item || typeof item !== "object" || !/^[\w-]{1,120}$/.test(item.id || "") || ids.has(item.id)) {
      throw new Error("Invalid project ID");
    }
    ids.add(item.id);
    if (!item.controls || typeof item.controls !== "object" || !item.roof || !item.estimateState) {
      throw new Error("Incomplete project");
    }
  }
  const stack = [[items, 0]];
  let count = 0;
  while (stack.length) {
    const [value, depth] = stack.pop();
    if (++count > 500000 || depth > 64) throw new Error("Archive is too complex");
    if (!value || typeof value !== "object") continue;
    for (const [key, child] of Object.entries(value)) {
      if (["__proto__", "prototype", "constructor"].includes(key)) throw new Error("Invalid project field");
      stack.push([child, depth + 1]);
    }
  }
}

function createCabinet(options = {}) {
  const localDataDir = process.platform === "win32"
    ? path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "LineEnergyCabinet")
    : path.join(os.homedir(), ".local", "share", "line-energy-cabinet");
  const dataDir = path.resolve(options.dataDir || process.env.CABINET_DATA_DIR || localDataDir);
  const publicOrigin = options.publicOrigin || process.env.CABINET_ORIGIN || "";
  if (publicOrigin && (new URL(publicOrigin).protocol !== "https:" || new URL(publicOrigin).origin !== publicOrigin)) {
    throw new Error("CABINET_ORIGIN must be an HTTPS origin without a path");
  }
  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const dbPath = path.join(dataDir, "cabinet.sqlite");
  const db = new DatabaseSync(dbPath);
  fs.chmodSync(dbPath, 0o600);
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS account (id INTEGER PRIMARY KEY CHECK(id=1), username TEXT NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, csrf TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS archive (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, body TEXT NOT NULL);
    INSERT OR IGNORE INTO archive VALUES (1, 0, '[]');
    CREATE TABLE IF NOT EXISTS counters (day TEXT PRIMARY KEY, seq INTEGER NOT NULL);`);
  const account = () => db.prepare("SELECT * FROM account WHERE id=1").get();
  let setupToken = account() || publicOrigin ? "" : (options.setupToken || randomToken());
  const attempts = new Map();

  const server = http.createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'self'; object-src 'none'");
    if (publicOrigin) res.setHeader("Strict-Transport-Security", "max-age=31536000");
    const send = (status, body) => {
      res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(body));
    };
    const fail = (status, message) => send(status, { error: message });
    const redirect = (location) => { res.writeHead(303, { Location: location }); res.end(); };
    const origin = publicOrigin || `http://127.0.0.1:${server.address().port}`;
    // Reject unexpected Host headers, including DNS-rebinding attempts against localhost.
    if (req.headers.host !== new URL(origin).host) return fail(400, "Недопустимый адрес кабинета.");
    let url;
    try { url = new URL(req.url, origin); } catch (_) { return fail(400, "Некорректный запрос."); }
    const readBody = async () => {
      if (!String(req.headers["content-type"] || "").startsWith("application/json")) throw new Error("JSON required");
      let length = 0;
      const chunks = [];
      for await (const chunk of req) {
        length += chunk.length;
        if (length > 16 * 1024 * 1024) throw new Error("Request too large");
        chunks.push(chunk);
      }
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    };
    const cookie = /(?:^|;\s*)le_cabinet=([A-Za-z0-9_-]{43})(?:;|$)/.exec(req.headers.cookie || "")?.[1];
    db.prepare("DELETE FROM sessions WHERE expires <= ?").run(Date.now());
    const session = cookie ? db.prepare("SELECT * FROM sessions WHERE token=?").get(digest(cookie)) : null;
    const setCookie = (token, maxAge) => res.setHeader("Set-Cookie", `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${publicOrigin ? "; Secure" : ""}`);
    const signedIn = () => {
      const token = randomToken(), csrf = randomToken();
      db.prepare("INSERT INTO sessions VALUES (?, ?, ?)").run(digest(token), csrf, Date.now() + sessionHours * 3600000);
      setCookie(token, sessionHours * 3600);
      send(200, { ok: true });
    };
    const mutation = !["GET", "HEAD"].includes(req.method);
    if (mutation && req.headers.origin !== origin) return fail(403, "Запрос с другого сайта запрещён.");
    try {
      if (url.pathname === "/api/setup" && req.method === "POST") {
        if (!setupToken || account() || publicOrigin) return fail(403, "Создание учётной записи закрыто.");
        const body = await readBody();
        if (!equal(body.token || "", setupToken)) return fail(403, "Недействительная ссылка настройки.");
        const username = String(body.username || "").trim(), password = String(body.password || "");
        if (!/^[A-Za-z0-9_.@-]{3,80}$/.test(username) || password.length < 12 || password.length > 200) {
          return fail(400, "Логин: 3–80 латинских символов. Пароль: от 12 до 200 символов.");
        }
        const salt = randomToken(), hash = await passwordHash(password, salt);
        // Recheck after hashing: simultaneous requests must not replace the owner.
        if (account()) return fail(409, "Учётная запись уже создана.");
        db.prepare("INSERT INTO account VALUES (1, ?, ?, ?)").run(username, salt, hash);
        setupToken = "";
        return signedIn();
      }
      if (url.pathname === "/api/login" && req.method === "POST") {
        const key = req.socket.remoteAddress;
        const now = Date.now();
        for (const [ip, entry] of attempts) if (entry.until < now) attempts.delete(ip);
        const entry = attempts.get(key) || { count: 0, until: now + 15 * 60000 };
        if (entry.count >= 5) { res.setHeader("Retry-After", "900"); return fail(429, "Слишком много попыток. Повторите вход через 15 минут."); }
        entry.count++; attempts.set(key, entry);
        const body = await readBody(), owner = account();
        const password = String(body.password || "");
        if (password.length > 200) return fail(401, "Неверный логин или пароль.");
        const hash = await passwordHash(password, owner?.salt || "unconfigured-account");
        if (!owner || !equal(hash, owner.hash) || !equal(String(body.username || "").trim(), owner.username)) {
          return fail(401, "Неверный логин или пароль.");
        }
        attempts.delete(key);
        return signedIn();
      }
      if (url.pathname.startsWith("/api/")) {
        if (!session) return fail(401, "Войдите в кабинет. Несохранённый расчёт остаётся на странице.");
        if (mutation && !equal(req.headers["x-csrf-token"] || "", session.csrf)) return fail(403, "Не удалось проверить запрос. Обновите вход.");
        if (url.pathname === "/api/session" && req.method === "GET") {
          return send(200, { username: account().username, csrf: session.csrf });
        }
        if (url.pathname === "/api/logout" && req.method === "POST") {
          db.prepare("DELETE FROM sessions WHERE token=?").run(session.token);
          setCookie("", 0); return send(200, { ok: true });
        }
        if (url.pathname === "/api/archive" && req.method === "GET") {
          const row = db.prepare("SELECT * FROM archive WHERE id=1").get();
          return send(200, { revision: row.revision, proposals: JSON.parse(row.body) });
        }
        if (url.pathname === "/api/archive" && req.method === "PUT") {
          const body = await readBody();
          validateArchive(body.proposals);
          const row = db.prepare("SELECT revision FROM archive WHERE id=1").get();
          if (body.revision !== row.revision) return fail(409, "Архив изменён в другом окне. Экспортируйте текущий архив JSON перед обновлением страницы, затем импортируйте его для объединения.");
          db.exec("BEGIN IMMEDIATE");
          try {
            db.prepare("UPDATE archive SET body=?, revision=revision+1 WHERE id=1").run(JSON.stringify(body.proposals));
            for (const proposal of body.proposals) {
              const number = /^LE-(\d{8})-(\d{1,9})$/.exec(proposal.number || "");
              if (number) db.prepare("INSERT INTO counters VALUES (?, ?) ON CONFLICT(day) DO UPDATE SET seq=max(seq, excluded.seq)").run(number[1], Number(number[2]));
            }
            db.exec("COMMIT");
          } catch (error) { db.exec("ROLLBACK"); throw error; }
          return send(200, { revision: row.revision + 1 });
        }
        if (url.pathname === "/api/proposal-number" && req.method === "POST") {
          const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).replaceAll("-", "");
          const row = db.prepare("INSERT INTO counters VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET seq=seq+1 RETURNING seq").get(day);
          return send(200, { number: `LE-${day}-${String(row.seq).padStart(3, "0")}` });
        }
        return fail(404, "Не найдено.");
      }
      if (!["GET", "HEAD"].includes(req.method)) return fail(405, "Метод не поддерживается.");
      let file;
      if (url.pathname === "/login" || url.pathname === "/setup") {
        if (url.pathname === "/setup" && (!setupToken || publicOrigin)) return redirect("/login");
        if (session) return redirect("/");
        file = path.join(__dirname, "login.html");
      } else if (["/_cabinet/auth.js", "/_cabinet/cabinet.css"].includes(url.pathname)) {
        file = path.join(__dirname, path.basename(url.pathname));
      } else {
        if (!session) return url.pathname === "/" || url.pathname === "/index.html" ? redirect("/login") : fail(401, "Войдите в кабинет.");
        if (url.pathname === "/_cabinet/archive.js") file = path.join(__dirname, "archive.js");
        else {
          const relative = decodeURIComponent(url.pathname).replace(/^\//, "") || "index.html";
          if (!["index.html", "styles.css", "data.js", "backupRuntime.js", "generatorCharging.js", "app.js"].includes(relative)
            && !relative.startsWith("assets/")) return fail(404, "Не найдено.");
          file = path.resolve(webRoot, relative);
          if (!file.startsWith(webRoot + path.sep)) return fail(404, "Не найдено.");
        }
      }
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return fail(404, "Не найдено.");
      const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp" };
      let content = fs.readFileSync(file);
      if (path.basename(file) === "index.html") {
        content = Buffer.from(content.toString("utf8")
          .replace("</head>", '<link rel="stylesheet" href="/_cabinet/cabinet.css"></head>')
          .replace('<script src="app.js"></script>', '<script src="/_cabinet/archive.js"></script><script src="app.js"></script>'));
      }
      res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
      res.end(req.method === "HEAD" ? undefined : content);
    } catch (error) {
      if (!res.headersSent) fail(400, "Не удалось обработать запрос. Проверьте данные и размер архива.");
    }
  });
  return { server, db, setupLink: () => setupToken ? `http://127.0.0.1:${server.address().port}/setup?token=${setupToken}` : null };
}

if (require.main === module) {
  const cabinet = createCabinet();
  const host = process.env.CABINET_HOST || "127.0.0.1";
  const port = Number(process.env.CABINET_PORT || 8787);
  cabinet.server.listen(port, host, () => {
    console.log(`Line-Energy cabinet: ${process.env.CABINET_ORIGIN || `http://127.0.0.1:${port}`}`);
    if (cabinet.setupLink()) console.log(`Create your private account: ${cabinet.setupLink()}`);
  });
  const close = () => cabinet.server.close(() => { cabinet.db.close(); process.exit(0); });
  process.on("SIGINT", close);
  process.on("SIGTERM", close);
}
module.exports = { createCabinet, validateArchive };
