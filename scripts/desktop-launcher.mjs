import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  readdirSync,
  copyFileSync,
} from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
const workspace = createHash("sha256").update(root).digest("hex").slice(0, 16);
const data = path.join(root, "data");
const lockFile = path.join(data, "desktop-launcher.lock");
const stampFile = path.join(data, "desktop-build.json");
const dependencyStamp = path.join(data, "desktop-dependencies.sha256");
const noBrowser = process.env.XINGCE_NO_BROWSER === "1"; // Smoke-check option; normal double-click opens browser.
let ownedLock = false;
let child;
let stopping = false;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function openBrowser(url) {
  if (noBrowser) return;
  const browser = spawn("rundll32.exe", ["url.dll,FileProtocolHandler", url], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  browser.on("error", () => console.log(`浏览器未能自动打开，请访问：${url}`));
  browser.unref();
}

async function isOurServer(url) {
  try {
    const r = await fetch(url + "/api/health", {
      signal: AbortSignal.timeout(500),
    });
    if (!r.ok) return false;
    const body = await r.json();
    return body.app === "xingce-ai-lab" && body.workspace === workspace;
  } catch {
    return false;
  }
}

async function existingServer() {
  for (let port = 3000; port <= 3010; port++) {
    const url = `http://127.0.0.1:${port}`;
    if (await isOurServer(url)) return url;
  }
}

function alive(pid) {
  if (!Number.isInteger(pid) || pid < 1) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function npmCli() {
  const candidates = [
    path.join(
      path.dirname(process.execPath),
      "node_modules/npm/bin/npm-cli.js",
    ),
  ];
  const result = spawnSync("where.exe", ["npm.cmd"], {
    encoding: "utf8",
    windowsHide: true,
  });
  for (const file of (result.stdout ?? "")
    .trim()
    .split(/\r?\n/)
    .filter(Boolean))
    candidates.push(
      path.join(path.dirname(file), "node_modules/npm/bin/npm-cli.js"),
    );
  const cli = candidates.find(existsSync);
  if (!cli)
    throw new Error(
      "没有找到 npm。请安装包含 npm 的 Node.js 24 LTS，然后重新双击启动。",
    );
  return cli;
}

function runNpm(cli, ...args) {
  return new Promise((resolve, reject) => {
    child = spawn(process.execPath, [cli, ...args], {
      cwd: root,
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(
              `npm ${args.join(" ")} 未完成（退出码 ${code}）。请查看上方错误；不会清空已有题库。`,
            ),
          ),
    );
  });
}

function sourceFingerprint() {
  const hash = createHash("sha256");
  function add(file) {
    if (!existsSync(file)) return;
    hash.update(path.relative(root, file));
    hash.update(readFileSync(file));
  }
  function walk(dir) {
    for (const item of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const file = path.join(dir, item.name);
      if (item.isDirectory()) walk(file);
      else if (item.isFile()) add(file);
    }
  }
  walk(path.join(root, "src"));
  walk(path.join(root, "prisma"));
  for (const name of [
    "package-lock.json",
    "next.config.ts",
    "tsconfig.json",
    ".env",
  ])
    add(path.join(root, name));
  return hash.digest("hex");
}

async function freePort() {
  for (let port = 3000; port <= 3010; port++) {
    const free = await new Promise((resolve) => {
      const server = createServer();
      server.once("error", () => resolve(false));
      server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)));
    });
    if (free) return port;
  }
  throw new Error("3000—3010 端口均被占用。请关闭不需要的本地服务后重试。");
}

async function main() {
  console.log("\n行测思维实验室 · 开始学习\n");
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 22 || (major === 22 && minor < 13))
    throw new Error("需要 Node.js 22.13 以上版本，建议安装 Node.js 24 LTS。");
  mkdirSync(data, { recursive: true });
  const existing = await existingServer();
  if (existing) {
    console.log(`前台已在运行，直接打开：${existing}`);
    openBrowser(existing);
    return;
  }
  try {
    writeFileSync(lockFile, JSON.stringify({ pid: process.pid }), {
      flag: "wx",
    });
    ownedLock = true;
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    let lock;
    try {
      lock = JSON.parse(readFileSync(lockFile, "utf8"));
    } catch {
      throw new Error("启动状态文件读取失败，请稍后重试。");
    }
    if (alive(lock.pid)) {
      console.log("另一启动窗口正在准备前台，请稍候……");
      for (let i = 0; i < 240; i++) {
        const url = await existingServer();
        if (url) {
          openBrowser(url);
          console.log(`已打开：${url}`);
          return;
        }
        if (!alive(lock.pid))
          throw new Error("另一启动窗口已退出，请重新双击启动。");
        await delay(1000);
      }
      throw new Error("前台仍在准备中，请查看第一个启动窗口的进度。");
    }
    unlinkSync(lockFile);
    writeFileSync(lockFile, JSON.stringify({ pid: process.pid }), {
      flag: "wx",
    });
    ownedLock = true;
  }
  const cli = npmCli();
  const dependencies = createHash("sha256")
    .update(readFileSync("package-lock.json"))
    .digest("hex");
  if (
    !existsSync("node_modules/next/package.json") ||
    !existsSync("node_modules/prisma/package.json") ||
    (existsSync(dependencyStamp) &&
      readFileSync(dependencyStamp, "utf8") !== dependencies)
  ) {
    console.log("首次运行或依赖已更新，正在安装，请保持联网……");
    await runNpm(cli, "ci", "--no-audit", "--no-fund");
  }
  writeFileSync(dependencyStamp, dependencies);
  if (!existsSync(".env")) copyFileSync(".env.example", ".env");
  console.log("检查本地数据库（保留已有资料和学习记录）……");
  await runNpm(cli, "run", "setup");
  let stamp;
  try {
    stamp = JSON.parse(readFileSync(stampFile, "utf8"));
  } catch {
    /* First launch. */
  }
  if (
    !existsSync(".next/BUILD_ID") ||
    stamp?.fingerprint !== sourceFingerprint() ||
    stamp?.node !== process.versions.node
  ) {
    console.log("首次启动或程序已更新，正在准备前台页面……");
    await runNpm(cli, "run", "build");
    writeFileSync(
      stampFile,
      JSON.stringify({
        fingerprint: sourceFingerprint(),
        node: process.versions.node,
      }),
    );
  }
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  child = spawn(
    process.execPath,
    [
      path.join(root, "node_modules/next/dist/bin/next"),
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    { cwd: root, stdio: "inherit", windowsHide: true },
  );
  const server = child;
  const exited = new Promise((resolve) => {
    server.once("exit", (code) => resolve(code));
    server.once("error", (error) => {
      console.error(error.message);
      resolve(1);
    });
  });
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null)
      throw new Error("前台服务未能启动，请查看上方错误。");
    if (await isOurServer(url)) {
      console.log(
        `\n前台已就绪：${url}\n浏览器将自动打开。使用期间请保留此窗口（可最小化）。\n退出时在此窗口按 Ctrl+C；关闭网页不会删除学习记录。\n`,
      );
      openBrowser(url);
      const code = await exited;
      if (code && !stopping)
        throw new Error(`前台已退出（${code}）。可重新双击启动。`);
      return;
    }
    await delay(500);
  }
  throw new Error("服务未能在一分钟内就绪，请查看上方日志后重试。");
}

for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    stopping = true;
    child?.kill();
  });
try {
  await main();
} catch (error) {
  console.error("\n启动失败：" + error.message);
  process.exitCode = 1;
} finally {
  if (child && child.exitCode === null) child.kill();
  if (ownedLock) {
    try {
      unlinkSync(lockFile);
    } catch {
      /* Already cleaned. */
    }
  }
}
