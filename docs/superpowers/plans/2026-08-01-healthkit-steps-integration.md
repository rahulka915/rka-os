# HealthKit Steps Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove HealthKit step-count access works end-to-end on this app — package installed, permission requested, today's step count queryable — with a `__DEV__`-only debug display, no persistence and no real feature UI yet.

**Architecture:** Add `@kingstinct/react-native-healthkit` (a Nitro-modules-based HealthKit bridge, chosen over the older `react-native-health` for New Architecture compatibility — this app already depends on `react-native-nitro-modules`) plus its official Expo config plugin. A new `src/services/health.ts` wraps the library's `requestAuthorization`/`queryStatisticsForQuantity` calls behind two small functions. `SettingsScreen.tsx`'s existing `__DEV__`-only `DevToolsSection` gets a new block to call them and show the result.

**Tech Stack:** `@kingstinct/react-native-healthkit` (Nitro Modules-based iOS HealthKit bridge), `react-native-nitro-modules` (already a dependency, `^0.36.5`), Expo config plugins, React Native + Expo (RN 0.86, Expo ~57).

## Global Constraints

- Step count only — no workouts, sleep, or other HealthKit metrics (spec: "Scope").
- No persistence — `getTodayStepCount()` queries HealthKit live every call, nothing written to the app's SQLite database (spec: "Scope").
- No real feature UI — the only UI surface is the `__DEV__`-only block in `SettingsScreen.tsx`'s `DevToolsSection` (spec: "Scope", "Out of Scope").
- iOS only — both functions short-circuit on non-iOS platforms (`Platform.OS !== 'ios'`) (spec: "Out of Scope").
- Requires a new native build after implementation — this is native code, Metro/JS-only reloads will not pick it up (spec: "Native Build Requirement").

---

## File Structure

- **Modify** `apps/mobile/package.json` — add `@kingstinct/react-native-healthkit` (and confirm `react-native-nitro-modules` stays present).
- **Modify** `apps/mobile/app.json` — register the `@kingstinct/react-native-healthkit` Expo config plugin.
- **Create** `apps/mobile/src/services/health.ts` — `requestHealthPermissions()`, `getTodayStepCount()`.
- **Modify** `apps/mobile/src/screens/SettingsScreen.tsx` — add a debug block to `DevToolsSection`.

---

### Task 1: Install the package and register the Expo config plugin

**Files:**
- Modify: `apps/mobile/package.json`
- Modify: `apps/mobile/app.json`

**Interfaces:**
- Produces: the `@kingstinct/react-native-healthkit` package available for import, and its native HealthKit entitlement/Info.plist wiring applied at the next `expo prebuild`/native build — consumed by Task 2 (`src/services/health.ts`'s imports).

Per this repo's SDK Gotchas (`apps/mobile/CLAUDE.md`), `npm install --legacy-peer-deps` is required for all package installs here. `react-native-nitro-modules` is already a dependency (`package.json`, `"react-native-nitro-modules": "^0.36.5"`) — the install command re-adds it too, which is a safe no-op (npm will just confirm the existing version satisfies it, or bump within range).

- [ ] **Step 1: Install the package**

Run from `apps/mobile/`:

```bash
npm install @kingstinct/react-native-healthkit react-native-nitro-modules --legacy-peer-deps
```

Expected: `package.json`'s `dependencies` gains `"@kingstinct/react-native-healthkit": "^<version>"`, and `package-lock.json` updates. Verify with:

```bash
grep '"@kingstinct/react-native-healthkit"' package.json
```

Expected: one line showing the added dependency.

- [ ] **Step 2: Register the Expo config plugin**

In `apps/mobile/app.json`, add a new entry to the `expo.plugins` array, immediately after the `"expo-background-task"` entry (before the `"expo-calendar"` block):

```json
      "expo-background-task",
      [
        "@kingstinct/react-native-healthkit",
        {
          "NSHealthShareUsageDescription": "RKA OS reads your health data (steps, workouts, sleep) to give you a complete picture of your day.",
          "NSHealthUpdateUsageDescription": "RKA OS writes workout and medication data to Apple Health."
        }
      ],
      [
        "expo-calendar",
```

This passes the project's existing usage-description strings (already present verbatim in `expo.ios.infoPlist`) explicitly to the plugin, so its own default copy never overrides them.

- [ ] **Step 3: Validate app.json is well-formed JSON**

Run: `cd apps/mobile && node -e "JSON.parse(require('fs').readFileSync('app.json', 'utf8')); console.log('valid')"`
Expected: `valid`

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/package.json apps/mobile/package-lock.json apps/mobile/app.json
git commit -m "feat(mobile): add @kingstinct/react-native-healthkit and its Expo config plugin

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: `src/services/health.ts`

**Files:**
- Create: `apps/mobile/src/services/health.ts`

**Interfaces:**
- Consumes: `isHealthDataAvailable`, `requestAuthorization`, `queryStatisticsForQuantity` (`@kingstinct/react-native-healthkit`, Task 1).
- Produces: `requestHealthPermissions(): Promise<boolean>`, `getTodayStepCount(): Promise<number>` — consumed by Task 3 (`SettingsScreen.tsx`'s debug block).

`queryStatisticsForQuantity(identifier, statistics, options)` is the library's HealthKit statistics-query wrapper (verified against the library's published TypeScript source): it takes the quantity type identifier string, an array of `StatisticsOptions` (`'cumulativeSum' | 'discreteAverage' | ...`), and an options object with an optional `filter: { date?: { startDate?, endDate? } }`. It resolves a `QueryStatisticsResponse` with an optional `sumQuantity?: { unit: string; quantity: number }` — using `'cumulativeSum'` and reading `sumQuantity` is HealthKit's correct way to get a total (avoids double-counting samples from multiple sources like a paired Apple Watch, which manually summing raw samples would risk).

- [ ] **Step 1: Write the service**

```typescript
import { Platform } from 'react-native';
import { isHealthDataAvailable, requestAuthorization, queryStatisticsForQuantity } from '@kingstinct/react-native-healthkit';

const STEP_COUNT_IDENTIFIER = 'HKQuantityTypeIdentifierStepCount' as const;

export async function requestHealthPermissions(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  const available = await isHealthDataAvailable();
  if (!available) return false;
  return requestAuthorization({ toRead: [STEP_COUNT_IDENTIFIER] });
}

export async function getTodayStepCount(): Promise<number> {
  if (Platform.OS !== 'ios') return 0;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const result = await queryStatisticsForQuantity(STEP_COUNT_IDENTIFIER, ['cumulativeSum'], {
    filter: { date: { startDate: startOfDay, endDate: new Date() } },
  });
  return result.sumQuantity?.quantity ?? 0;
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/mobile && node --stack-size=8000 node_modules/typescript/lib/tsc.js --noEmit 2>&1 | grep -i "services/health"`
Expected: no output. (If TypeScript can't resolve `@kingstinct/react-native-healthkit`'s exports, re-check Task 1 Step 1 installed successfully and that `node_modules/@kingstinct/react-native-healthkit` exists.)

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/services/health.ts
git commit -m "feat(mobile): add HealthKit step-count service (requestHealthPermissions, getTodayStepCount)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Debug block in `SettingsScreen.tsx`'s `DevToolsSection`

**Files:**
- Modify: `apps/mobile/src/screens/SettingsScreen.tsx` (current relevant section: `DevToolsSection` function, lines 103-132, and its `devStyles` `StyleSheet.create` block, lines 330-410)

**Interfaces:**
- Consumes: `requestHealthPermissions(): Promise<boolean>`, `getTodayStepCount(): Promise<number>` (Task 2, `src/services/health.ts`).
- Produces: no new exports — this is the plan's final UI wiring.

Note: `apps/mobile/CLAUDE.md`'s "Ronin 3D Companion" section says the dev bench lives on `ProfileScreen.tsx` — that's stale; it was moved to `SettingsScreen.tsx`'s `DevToolsSection` (see that file's own comment at lines 30-32: "moved here from ProfileScreen"). This task targets the actual current location.

- [ ] **Step 1: Add the import**

In `apps/mobile/src/screens/SettingsScreen.tsx`, add after the existing `import { HeroEnvironmentWorkbench } from '../components/hero/environment';` line:

```typescript
import { requestHealthPermissions, getTodayStepCount } from '../services/health';
```

- [ ] **Step 2: Add a `HealthKitDebugBlock` component**

Add this new function directly above `function DevToolsSection() {` (i.e., after the closing `}` of the `Ronin3DBench` function, before `DevToolsSection`):

```typescript
function HealthKitDebugBlock() {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [status, setStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');
  const [stepCount, setStepCount] = useState<number | null>(null);

  const handleRequestPermissions = async () => {
    setStatus('requesting');
    const granted = await requestHealthPermissions();
    setStatus(granted ? 'granted' : 'denied');
    if (granted) {
      const steps = await getTodayStepCount();
      setStepCount(steps);
    }
  };

  const handleRefresh = async () => {
    const steps = await getTodayStepCount();
    setStepCount(steps);
  };

  return (
    <View style={devStyles.healthBlock}>
      <Text style={[devStyles.benchTitle, { color: palette.textSecondary }]}>HealthKit steps (dev only)</Text>
      <Text style={[devStyles.benchStatus, { color: palette.textSecondary }]}>
        status: {status}{stepCount !== null ? ` · today: ${stepCount} steps` : ''}
      </Text>
      <View style={devStyles.healthButtonRow}>
        <Pressable
          onPress={handleRequestPermissions}
          style={[devStyles.moodChip, { backgroundColor: palette.fill }]}
        >
          <Text style={[devStyles.moodChipLabel, { color: palette.textSecondary }]}>Request permissions</Text>
        </Pressable>
        {status === 'granted' && (
          <Pressable
            onPress={handleRefresh}
            style={[devStyles.moodChip, { backgroundColor: palette.fill }]}
          >
            <Text style={[devStyles.moodChipLabel, { color: palette.textSecondary }]}>Refresh</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
```

- [ ] **Step 3: Mount it in `DevToolsSection`**

In the `DevToolsSection` function's JSX, add `<HealthKitDebugBlock />` right after `<Ronin3DBench mood={mood} onMoodChange={setMood} />`:

```typescript
      <Ronin3DBench mood={mood} onMoodChange={setMood} />
      <HealthKitDebugBlock />
      <View style={devStyles.previewSection}>
```

- [ ] **Step 4: Add the new style**

In the `devStyles` `StyleSheet.create` block (starts at line 330), add after the existing `bench: { ... },` entry:

```typescript
  healthBlock: {
    width: '100%',
    marginTop: 8,
    gap: 10,
  },
  healthButtonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
```

- [ ] **Step 5: Type-check**

Run: `cd apps/mobile && node --stack-size=8000 node_modules/typescript/lib/tsc.js --noEmit 2>&1 | grep -i "SettingsScreen"`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/screens/SettingsScreen.tsx
git commit -m "feat(mobile): add HealthKit steps debug block to Settings dev tools

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Manual verification pass

**Files:** none (verification only).

- [ ] **Step 1: Full type-check**

Run: `cd apps/mobile && node --stack-size=8000 node_modules/typescript/lib/tsc.js --noEmit 2>&1 | grep -v "^App\.web\|^src/webApp"`
Expected: zero errors (the `webApp/` filter excludes this repo's known-unrelated, pre-existing `.web.tsx`-resolution false positives).

- [ ] **Step 2: Run the existing test suite**

Run: `cd apps/mobile && npm test 2>&1 | tail -10`
Expected: all existing tests still pass (this plan adds no new pure-logic functions, so no new tests were written — verification here is purely "nothing broke").

- [ ] **Step 3: New native build required — this cannot be verified without one**

`@kingstinct/react-native-healthkit` is native code (Swift, plus the HealthKit entitlement). The current installed dev-client build on-device does not have this compiled in — Metro/JS reload will not add it. Confirm with the user before proceeding, then run the same EAS cloud build flow used previously for this project:

```bash
cd apps/mobile && eas build --profile development --platform ios --non-interactive
```

Expected: build succeeds and prints an install link (`https://expo.dev/accounts/.../builds/...`), same as prior builds this session. Note: this is a long-running (~10+ minute), resource-consuming cloud build — do not run without the user's go-ahead, since it was flagged as a "risky/heavy action requiring confirmation" earlier in this project's history.

- [ ] **Step 4: On-device walkthrough (after installing the new build)**

Open the app, navigate to Settings (via Home's settings icon), scroll to the `__DEV__`-only "DEV TOOLS" section, and verify:
- A new "HealthKit steps (dev only)" block appears below the Ronin 3D bench, showing "status: idle".
- Tapping "Request permissions" triggers iOS's native HealthKit permission sheet (first time only); after granting, status updates to "granted" and a step count appears (e.g. "status: granted · today: 4213 steps").
- Denying the permission sheet instead shows "status: denied" and no step count.
- Tapping "Refresh" (visible once granted) re-queries and updates the step count without needing to re-request permission.
- No crash — per the library's own documentation, requesting data for a permission that was never requested via `requestAuthorization` first would crash the app; confirm this debug block's flow (always request before reading) avoids that.

Expected: all of the above behave as described. Note and fix anything found.

- [ ] **Step 5: Final commit (if Step 4 required fixes)**

```bash
git add -A
git commit -m "fix(mobile): address manual verification findings for HealthKit steps integration

Co-Authored-By: Claude <noreply@anthropic.com>"
```

(Skip this step if Step 4 found nothing to fix.)
