# RKA OS Project Rules

- **Initialization Check**: Every time you start a new conversation or take over this project, you MUST read `.agents/CONTEXT.md` to understand the architecture and `.agents/ROADMAP.md` to understand the current goals.
- **Check & Deploy Policy**: Always verify changes by running `npx tsc --noEmit && npm run build` locally to catch errors. Once verified, always commit and push the changes so that they deploy to Vercel. The user relies on the live Vercel preview to verify UI changes, so every finished task should be pushed immediately.
- **CRITICAL - Changelog Maintenance**: WHENEVER you deploy new features, bug fixes, or UI tweaks, you MUST update the `src/components/ui/VersionHistoryModal.tsx` file with the latest date, exact deploy time, version number, and an accurate list of changes. **DO NOT FORGET THIS STEP.** It is a mandatory requirement before pushing code.
