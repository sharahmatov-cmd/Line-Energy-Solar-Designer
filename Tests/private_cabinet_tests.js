const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const http = require("node:http");
const vm = require("node:vm");
const { createCabinet } = require("../Private/server.js");

test("private cabinet protects and preserves complete proposals", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "line-energy-private-test-"));
  const password = crypto.randomBytes(20).toString("hex");
  let cabinet, base, cookie = "", csrf = "";
  const start = async (extra = {}) => {
    cabinet = createCabinet({ dataDir: dir, setupToken: "test-setup-token", ...extra });
    await new Promise((resolve, reject) => {
      cabinet.server.once("error", reject);
      cabinet.server.listen(0, "127.0.0.1", resolve);
    });
    base = `http://127.0.0.1:${cabinet.server.address().port}`;
  };
  const stop = async () => {
    await new Promise((resolve) => cabinet.server.close(resolve));
    cabinet.db.close();
  };
  const request = (route, method = "GET", body, extra = {}) => new Promise((resolve, reject) => {
    const req = http.request(base + route, {
      method,
      headers: { Cookie: cookie, Origin: base, "Content-Type": "application/json", "X-CSRF-Token": csrf, ...extra },
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve({ status: response.statusCode, ok: response.statusCode >= 200 && response.statusCode < 300,
          headers: new Headers(Object.fromEntries(Object.entries(response.headers).map(([key, value]) => [key, String(value)]))),
          json: async () => JSON.parse(text), text: async () => text,
        });
      });
    });
    req.on("error", reject);
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
  const login = async () => {
    const response = await request("/api/login", "POST", { username: "owner", password });
    assert.equal(response.status, 200);
    cookie = response.headers.get("set-cookie").split(";")[0];
    csrf = (await (await request("/api/session")).json()).csrf;
  };
  try {
    await start();
    await t.test("all calculator assets and archive require a session", async () => {
      for (const route of ["/api/archive", "/app.js", "/data.js", "/assets/report/cover-solar-house.png", "/_cabinet/archive.js"]) {
        assert.equal((await request(route)).status, 401, route);
      }
      const home = await request("/");
      assert.equal(home.status, 303);
      assert.equal(home.headers.get("location"), "/login");
      assert.equal((await request("/login")).status, 200);
      assert.equal((await request("/", "GET", undefined, { Host: "attacker.invalid" })).status, 400);
    });
    await t.test("single-owner setup hashes the password and closes registration", async () => {
      assert.equal((await request("/api/setup", "POST", { token: "wrong", username: "owner", password })).status, 403);
      assert.equal((await request("/api/setup", "POST", { token: "test-setup-token", username: "owner", password: "short" })).status, 400);
      const response = await request("/api/setup", "POST", { token: "test-setup-token", username: "owner", password });
      assert.equal(response.status, 200);
      const setCookie = response.headers.get("set-cookie");
      assert.match(setCookie, /HttpOnly/);
      assert.match(setCookie, /SameSite=Strict/);
      cookie = setCookie.split(";")[0];
      csrf = (await (await request("/api/session")).json()).csrf;
      assert.ok(csrf);
      const owner = cabinet.db.prepare("SELECT * FROM account").get();
      assert.notEqual(owner.hash, password);
      assert.equal(owner.hash.length, 128);
      assert.equal(cabinet.setupLink(), null);
      assert.equal((await request("/api/setup", "POST", { token: "test-setup-token", username: "other", password })).status, 403);
      const html = await (await request("/")).text();
      assert.ok(html.includes('/_cabinet/archive.js'));
      assert.ok(html.indexOf('/_cabinet/archive.js') < html.indexOf('src="app.js"'));
      assert.equal((await request("/Private/server.js")).status, 404);
      assert.equal((await request("/assets/%2e%2e/%2e%2e/Private/server.js")).status, 404);
    });
    const proposal = {
      id: "proposal-integration-1", number: "LE-20261015-007", snapshotVersion: 1,
      address: "Test address", contact: "Test contact",
      controls: { batteryQty: { value: "3" }, inverter: { value: "0918KHP-6.2KW-HL" }, objectContact: { value: "Test contact" } },
      roof: { slopes: [{ panels: [{ x: 1.5, y: 2, stringId: 1 }], rails: [{ y: 1 }] }] },
      estimateState: { overrides: { battery: { qty: 3, unitPrice: 12345 } }, customRows: [{ id: "custom-1", unit: "m", qty: 8 }] },
      reportFormat: "engineeringIncluded",
    };
    await t.test("CSRF, validation, revision conflicts and complete project persistence", async () => {
      assert.equal((await request("/api/archive", "PUT", { revision: 0, proposals: [proposal] }, { "X-CSRF-Token": "wrong" })).status, 403);
      assert.equal((await request("/api/archive", "PUT", { revision: 0, proposals: [proposal] }, { Origin: "https://attacker.invalid" })).status, 403);
      assert.equal((await request("/api/archive", "PUT", { revision: 0, proposals: [{ id: "broken" }] })).status, 400);
      const write = await request("/api/archive", "PUT", { revision: 0, proposals: [proposal] });
      assert.equal(write.status, 200);
      assert.equal((await write.json()).revision, 1);
      assert.equal((await request("/api/archive", "PUT", { revision: 0, proposals: [] })).status, 409);
      const saved = await (await request("/api/archive")).json();
      assert.deepEqual(saved.proposals, [proposal]);
      const sessionToken = cabinet.db.prepare("SELECT token FROM sessions").get().token;
      assert.notEqual(sessionToken, cookie.split("=")[1]);
      // Exercise the actual browser archive adapter against the HTTP API.
      const element = () => ({ textContent: "", append() {}, addEventListener() {} });
      const client = vm.createContext({
        window: {}, structuredClone, confirm: () => false, alert() {},
        document: { createElement: element, querySelector: element },
        fetch: (url, options) => request(url, options.method, options.body ? JSON.parse(options.body) : undefined, options.headers),
      });
      vm.runInContext(fs.readFileSync(path.join(__dirname, "../Private/archive.js"), "utf8"), client);
      const adapter = client.window.LINE_ENERGY_PRIVATE_ARCHIVE;
      await adapter.ready;
      assert.deepEqual(adapter.read(), [proposal]);
      const changed = structuredClone(proposal);
      changed.controls.batteryQty.value = "4";
      await adapter.write([changed]);
      assert.equal(adapter.read()[0].controls.batteryQty.value, "4");
      const concurrent = await (await request("/api/archive")).json();
      assert.equal((await request("/api/archive", "PUT", { revision: concurrent.revision, proposals: [proposal] })).status, 200);
      await assert.rejects(adapter.write([changed]), /JSON/);
      assert.equal(adapter.exportItems()[0].controls.batteryQty.value, "4", "Failed writes must remain exportable");
      assert.deepEqual((await (await request("/api/archive")).json()).proposals, [proposal], "Stale client must not overwrite another tab");
      await adapter.refresh();
      await adapter.write([proposal]);
      const next = await (await request("/api/proposal-number", "POST")).json();
      assert.match(next.number, /^LE-\d{8}-\d+$/);
      assert.equal((await request("/api/logout", "POST")).status, 200);
      assert.equal((await request("/api/archive")).status, 401);
    });
    await t.test("password login and archive survive a server restart", async () => {
      await stop(); await start();
      assert.equal(cabinet.setupLink(), null);
      assert.equal((await request("/api/login", "POST", { username: "owner", password: "incorrect" })).status, 401);
      await login();
      assert.deepEqual((await (await request("/api/archive")).json()).proposals, [proposal]);
      cabinet.db.prepare("UPDATE sessions SET expires=0").run();
      assert.equal((await request("/api/archive")).status, 401);
    });
    await t.test("failed login attempts are limited", async () => {
      for (let i = 0; i < 5; i++) {
        assert.equal((await request("/api/login", "POST", { username: "owner", password: "incorrect" })).status, 401);
      }
      assert.equal((await request("/api/login", "POST", { username: "owner", password })).status, 429);
    });
    await t.test("HTTPS deployment uses Secure cookies and disables initial setup", async () => {
      await stop(); await start({ publicOrigin: "https://cabinet.example.ru" });
      const headers = { Host: "cabinet.example.ru", Origin: "https://cabinet.example.ru" };
      const response = await request("/api/login", "POST", { username: "owner", password }, headers);
      assert.equal(response.status, 200);
      assert.match(response.headers.get("set-cookie"), /; Secure/);
      assert.equal((await request("/api/setup", "POST", {}, headers)).status, 403);
    });
  } finally {
    if (cabinet?.server.listening) await stop();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
