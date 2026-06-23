---
name: deploy-with-changelog
description: Safely updates the changelog with local time and deploys the app to ensure version history is strictly maintained. Trigger this when ready to push code.
---

# Deploy with Changelog

When the user asks to deploy code, or when you have finished a task that involves UI tweaks, bug fixes, or new features, you MUST execute this deployment procedure to maintain a strict version history.

## Procedure

1. **Update the Changelog**:
   Open `src/components/ui/VersionHistoryModal.tsx`. Add a new `<section>` for the latest version.
   Ensure you include:
   - The new Version Number (e.g., v2.8.5).
   - The Local Time (use the user's provided local time metadata). DO NOT use UTC.
   - An accurate bulleted list of changes made.

2. **Verify Build**:
   Run `npx tsc --noEmit && npm run build` to verify there are no compilation errors.

3. **Deploy**:
   Run `git add . && git commit -m "feat/fix: <description>" && git push`.

Do NOT push code without updating the changelog.
