# RKA OS Project Rules

- **Check & Deploy Policy**: Always verify changes by running `npx tsc --noEmit && npm run build` locally to catch errors. Once verified, always commit and push the changes so that they deploy to Vercel. The user relies on the live Vercel preview to verify UI changes, so every finished task should be pushed immediately.
- **Changelog Maintenance**: Whenever you deploy new features, bug fixes, or UI tweaks, you MUST update the `src/components/ui/VersionHistoryModal.tsx` file with the latest date, time, version number, and an accurate list of changes.
