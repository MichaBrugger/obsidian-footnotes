// Runs from `npm version <patch|minor|major|x.y.z>` (see the "version"
// script in package.json): copies the new package.json version into
// manifest.json and records its minAppVersion in versions.json, so the
// three files can never drift apart. npm then commits and tags; the
// repo-level .npmrc drops npm's default "v" tag prefix because Obsidian
// requires the release tag to exactly equal the manifest version.
import { readFileSync, writeFileSync } from "node:fs";

const targetVersion = process.env.npm_package_version;
if (!targetVersion) {
    console.error("run this via `npm version <new version>`");
    process.exit(1);
}

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
manifest.version = targetVersion;
writeFileSync("manifest.json", JSON.stringify(manifest, null, 2) + "\n");

const versions = JSON.parse(readFileSync("versions.json", "utf8"));
versions[targetVersion] = manifest.minAppVersion;
writeFileSync("versions.json", JSON.stringify(versions, null, 2) + "\n");
