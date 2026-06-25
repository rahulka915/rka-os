# Naming History & Project Context

## Current Status (As of June 24, 2026)

This project is officially called **RKA OS** (or `rka-os` in code).

### Identifiers Alignment
| Identifier | Value |
|-----------|-------|
| **Folder Name** | `rka-os` ✓ |
| **Package Name** | `rka-os` (package.json) ✓ |
| **GitHub Repository** | `https://github.com/rahulka915/rka-os.git` ✓ |
| **README Title** | `# RKA OS` ✓ |
| **App Description** | Personal Operating System (POS) PWA ✓ |

---

## Why "personal-os" Folder Name Existed

### Timeline
- **Original Development:** Project was initially developed under the working title "personal-os"
- **Folder Created:** `~/Downloads/Coding Projects/personal-os/`
- **Later Renamed:** The actual project was branded as "RKA OS" to reflect:
  - **RKA** = Rahul Krish Anand (creator initials)
  - **OS** = Operating System
- **Alignment Issue:** The folder name was never updated from `personal-os` despite package.json, GitHub, and documentation all referring to `rka-os`

### This Created Confusion
Team members (and you!) saw:
- Folder: `personal-os`
- Package: `rka-os`

And wondered: *"Are these two separate projects in different locations?"*

**Answer:** No. They are the same project. The folder was simply never renamed.

---

## Resolution (June 24, 2026)

### What Changed
Folder was renamed from `personal-os` → `rka-os` to achieve **complete alignment**:

```
Before:
~/Downloads/Coding Projects/personal-os/
  ├── package.json (name: "rka-os")  ⚠️ Mismatch!
  └── README.md (title: "RKA OS")

After:
~/Downloads/Coding Projects/rka-os/
  ├── package.json (name: "rka-os")  ✓ Aligned!
  └── README.md (title: "RKA OS")
```

### Why This Matters
1. **Consistency** - Folder name now matches all official identifiers
2. **No More Confusion** - Clear this is one project, not two
3. **Git Clarity** - Folder name matches GitHub repo name
4. **Future-Proof** - Any new team members won't be confused

---

## Key Distinctions

### What This Project IS
- **RKA OS** (rka-os) - Progressive Web App (PWA)
- Personal Operating System for task/habit/medication/workout management
- Built with React, Vite, Dexie.js (IndexedDB), Supabase
- Offline-first, local-first architecture
- Single Git repository: `github.com/rahulka915/rka-os`

### What This Project IS NOT
- ❌ NOT "personal-os" (that was just the folder name)
- ❌ NOT the same as `rahulos-agent-office` (different app, different folder: ~/RKA-HQ/)
- ❌ NOT a duplicate or copy (one instance only)

---

## Technical Details

**GitHub Repository:**
```
https://github.com/rahulka915/rka-os.git
```

**Current Version:** 0.0.5

**Key Technologies:**
- Frontend: React 19.2.6 + Vite
- Database: Dexie.js (IndexedDB) for local-first
- Backend: Supabase for sync/auth
- PWA: Installable to home screen

**Last Updated:** June 24, 2026

---

## For Future Reference

If you see references to "personal-os" in:
- Old documentation
- Meeting notes
- Comments
- Slack messages

**Know that it refers to this RKA OS project.** The folder has been renamed for consistency.

---

## Questions?

If there's any confusion about project organization:
1. Check the GitHub remote: `git remote -v`
2. Check the package name: `cat package.json | grep '"name"'`
3. Refer to README.md for the official project description
4. This file (NAMING_HISTORY.md) for historical context

---

**Last Updated:** June 24, 2026  
**Updated By:** Claude (Cowork Mode)  
**Reason:** Folder rename alignment + documentation
