import { type } from "arktype";

// Git-specific credential fields - mirrors the keys the landing page passes as
// GIT_URI / GIT_USER / GIT_MAIL / GIT_TOKEN env vars into the session container.
const gitSection = type({
    "gitUri?": "string",
    "gitUser?": "string",
    "gitMail?": "string",
    "gitToken?": "string",
});

// Top-level launch payload.
// "parameters" carries control fields (appDef, artemisUrl, artemisToken, user)
// plus any arbitrary extra key-value pairs that the landing page forwards as
// additional container env vars.
// All fields are optional so the schema stays forward- and backward-compatible.
export const launchPayloadSchema = type({
    "git?": gitSection,
    "parameters?": "Record<string, string>",
});

export type LaunchPayload = typeof launchPayloadSchema.infer;

// Field names that belong to the git section when parsing flat form submissions.
export const GIT_FIELD_NAMES = new Set(["gitUri", "gitUser", "gitMail", "gitToken"]);
