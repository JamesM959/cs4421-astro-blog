import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
execFileSync(npm, ["run", "build:static"], {
	cwd: projectRoot,
	stdio: "inherit",
});

const expectedPages = ["index.html","about/index.html","login/index.html","portfolio/index.html","signup/index.html","watchlist/index.html","rss.xml",];

for (const page of expectedPages) {
	const outputPath = path.join(projectRoot, "dist", "client", page);
	assert.ok(existsSync(outputPath), `Static build did not emit dist/client/${page}`);
}
