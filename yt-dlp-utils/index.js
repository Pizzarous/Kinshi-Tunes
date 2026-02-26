/* eslint-disable node/no-sync */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import nodePath from "node:path";
import process from "node:process";
import got from "got";

const suffix = process.platform === "win32" ? ".exe" : process.platform === "darwin" ? "_macos" : "";
const filename = `yt-dlp${suffix}`;
const scriptsPath = nodePath.resolve(process.cwd(), "scripts");
const exePath = nodePath.resolve(scriptsPath, filename);

function args(url, options) {
    const optArgs = Object.entries(options)
        .flatMap(([key, val]) => {
            const flag = key.replaceAll(/[A-Z]/gu, ms => `-${ms.toLowerCase()}`);
            return [`--${typeof val === "boolean" && !val ? "no-" : ""}${flag}`, typeof val === "boolean" ? "" : val];
        })
        .filter(Boolean);

    return [url, ...optArgs];
}

function json(str) {
    try {
        return JSON.parse(str);
    } catch {
        return str;
    }
}

export async function downloadExecutable() {
    const releases = await got.get("https://api.github.com/repos/yt-dlp/yt-dlp/releases?per_page=1").json();
    const release = releases[0];
    const latestVersion = release.tag_name;

    let needsUpdate = false;

    if (!existsSync(exePath)) {
        console.info("[INFO] Yt-dlp couldn't be found, trying to download...");
        needsUpdate = true;
    } else {
        const currentVersion = await new Promise(resolve => {
            const proc = spawn(exePath, ["--version"], { windowsHide: true });
            let output = "";
            proc.stdout.on("data", chunk => (output += chunk.toString()));
            proc.on("close", () => resolve(output.trim()));
            proc.on("error", () => resolve(""));
        });

        if (currentVersion !== latestVersion) {
            console.info(`[INFO] Yt-dlp update available: ${currentVersion} → ${latestVersion}`);
            needsUpdate = true;
        } else {
            console.info(`[INFO] Yt-dlp is up to date (${currentVersion}).`);
        }
    }

    if (needsUpdate) {
        const asset = release.assets.find(ast => ast.name === filename);
        await new Promise((resolve, reject) => {
            got.get(asset.browser_download_url)
                .buffer()
                .then(x => {
                    mkdirSync(scriptsPath, { recursive: true });
                    writeFileSync(exePath, x, { mode: 0o777 });
                    return 0;
                })
                .then(resolve)
                .catch(reject);
        });
        console.info(`[INFO] Yt-dlp has been updated to ${latestVersion}.`);
    }
}

export const exec = (url, options = {}, spawnOptions = {}) =>
    spawn(exePath, args(url, options), {
        windowsHide: true,
        ...spawnOptions
    });

export default async function ytdl(url, options = {}, spawnOptions = {}) {
    const proc = exec(url, options, spawnOptions);
    let data = "";

    await new Promise((resolve, reject) => {
        proc.on("error", reject)
            .on("close", resolve)
            .stdout.on("data", chunk => (data += chunk));
    });
    return json(data);
}
