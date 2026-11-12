// MJ-104: in-window version ticker. Build number and short SHA are baked at
// build time by next.config.ts `env` (NEXT_BUILD_*); absent ones drop out
// instead of rendering placeholders.
const parts = ["v0.1.0"];

const buildNumber = process.env.NEXT_BUILD_NUMBER;
const gitSha = process.env.NEXT_BUILD_GIT_SHA;

if (typeof buildNumber === "string" && buildNumber) {
  parts.push(`B${buildNumber}`);
}
if (typeof gitSha === "string" && gitSha) {
  parts.push(gitSha);
}

export const VERSION_TICKER = parts.join(" · ");
