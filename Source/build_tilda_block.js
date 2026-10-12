const fs = require("node:fs");
const path = require("node:path");

const web = path.resolve(__dirname, "../Web");
const read = (name) => fs.readFileSync(path.join(web, name), "utf8");
const html = read("index.html");
const body = html.match(/<body[^>]*>([\s\S]*?)\s*<script src="data\.js"><\/script>/)?.[1];
if (!body) throw new Error("Cannot find the calculator body in index.html");
const scripts = ["data.js", "backupRuntime.js", "generatorCharging.js", "app.js"].map(read).join("\n");
const block = `<!-- Line-Energy Solar Designer: start -->\n<style>\n${read("styles.css")}\n</style>\n${body}\n<script>\n${scripts}\n</script>\n<!-- Line-Energy Solar Designer: end -->\n`;
fs.writeFileSync(path.join(web, "tilda-calculator-block.html"), block);
console.log("Tilda calculator block updated");
