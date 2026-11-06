import { execFileSync } from "node:child_process";

const title = process.env.PR_TITLE ?? "";

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function parseVersion(tag) {
  const match = tag.match(/^v(\d+)\.(\d+)\.(\d+)\+(\d+)$/);
  if (!match) {
    return null;
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    build: Number(match[4]),
  };
}

const versions = git("tag", "--list", "v*")
  .split("\n")
  .map(parseVersion)
  .filter(Boolean);

const latest = versions.reduce((current, candidate) => {
  if (!current) return candidate;

  const currentCore = [current.major, current.minor, current.patch];
  const candidateCore = [candidate.major, candidate.minor, candidate.patch];
  const hasHigherCore = candidateCore.some(
    (value, index) =>
      value > currentCore[index] &&
      candidateCore
        .slice(0, index)
        .every((part, partIndex) => part === currentCore[partIndex]),
  );
  const hasSameCore = candidateCore.every(
    (value, index) => value === currentCore[index],
  );

  return hasHigherCore || (hasSameCore && candidate.build > current.build)
    ? candidate
    : current;
}, null);

const next = latest ?? { major: 1, minor: 0, patch: 0, build: 0 };
const isBreaking =
  /(?:^|\s)(?:BREAKING CHANGE|BREAKING-CHANGE)(?:\s|:)/i.test(title) ||
  /^[a-z]+(?:\([^)]*\))?!:/i.test(title);
const isFeature = /^feat(?:\([^)]*\))?:/i.test(title);

if (latest) {
  if (isBreaking) {
    next.major += 1;
    next.minor = 0;
    next.patch = 0;
  } else if (isFeature) {
    next.minor += 1;
    next.patch = 0;
  } else {
    next.patch += 1;
  }
}

const build = Math.max(0, ...versions.map((version) => version.build)) + 1;
process.stdout.write(`${next.major}.${next.minor}.${next.patch}+${build}\n`);
