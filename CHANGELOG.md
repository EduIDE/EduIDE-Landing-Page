# Changelog

All notable changes are documented in this file.
The section of a version becomes the notes of its GitHub Release.

## [Unreleased]

## [1.4.0] - 2026-11-16

### Features

- Persistence is now set per app (`ephemeral` in the app config, falling back to `useEphemeralStorage`), and every app tile, the launch screen and the progress screen show a "Temporary" or "Saved" badge so users know whether their files are kept ([#66](https://github.com/EduIDE/EduIDE-Landing-Page/pull/66))
- Go logo for Go apps ([#66](https://github.com/EduIDE/EduIDE-Landing-Page/pull/66))
- A reloaded tab of an ended session now explains that the session ended and offers a one-click "Resume my session" (same workspace, same volume), or a fresh start after an ephemeral session ([#46](https://github.com/EduIDE/EduIDE-Landing-Page/pull/46))
- A 553 answer now says the previous session is still shutting down ([#46](https://github.com/EduIDE/EduIDE-Landing-Page/pull/46))

### Fixes

- Logging out no longer fails with Keycloak's "Invalid redirect uri" ([#64](https://github.com/EduIDE/EduIDE-Landing-Page/pull/64))
- A launch that returns no session URL is retried instead of redirecting to an empty address ("'https:' is not a valid URL") ([#68](https://github.com/EduIDE/EduIDE-Landing-Page/pull/68))

### Upgrade notes

- Template launches no longer become persistent implicitly. The old rule (persistent whenever a build system is chosen) is gone, so apps that must keep their files, such as the TUM `-standalone` apps, need `ephemeral: false` in the chart. Pass `ephemeral` per app through the EduIDE-Helm chart in the same chart release that bumps `versions.landingPage` to 1.4.0.
- The new "session ended" page relies on EduIDE-Helm redirecting ended-session requests to `/session-ended`.
