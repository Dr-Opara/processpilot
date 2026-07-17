#!/usr/bin/env node
// Convenience wrapper so `npm run git:status` gives a consistent, scriptable
// summary of branch, tracking state, and working-tree cleanliness.

import { execFileSync } from "node:child_process";

function run(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

const branch = run(["rev-parse", "--abbrev-ref", "HEAD"]);
const status = run(["status", "--porcelain"]);
let tracking = "no upstream configured";
try {
  tracking = run(["status", "-sb"]).split("\n")[0].replace(/^## /, "");
} catch {
  // no upstream — keep default message
}

console.log(`Branch: ${branch}`);
console.log(`Tracking: ${tracking}`);
console.log(status ? `Working tree: dirty\n${status}` : "Working tree: clean");
