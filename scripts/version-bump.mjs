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

// A version with a "-" in it ("0.2.1-beta.1") is a BRAT beta: only
// manifest-beta.json changes, and the release workflow tags it as a
// pre-release. A plain version is a stable release: manifest.json and
// versions.json change, and manifest-beta.json takes the same version,
// because older BRAT builds install whatever version that file names on
// the default branch, so leaving it at the last beta would keep every BRAT
// tester on that beta after the release (Jason's report 2026-09-21).
const beta = JSON.parse(readFileSync("manifest-beta.json", "utf8"));
beta.version = targetVersion;
writeFileSync("manifest-beta.json", JSON.stringify(beta, null, 2) + "\n");
if (targetVersion.includes("-")) {
    console.log(`beta manifest set to ${targetVersion}; manifest.json and versions.json untouched`);
    process.exit(0);
}

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
manifest.version = targetVersion;
writeFileSync("manifest.json", JSON.stringify(manifest, null, 2) + "\n");

const versions = JSON.parse(readFileSync("versions.json", "utf8"));
versions[targetVersion] = manifest.minAppVersion;
writeFileSync("versions.json", JSON.stringify(versions, null, 2) + "\n");
