# Engineering Rules & Safety Guardrails
## Project: Windows System Cleaner (Codename: Cleaner)

---

## 1. Safety & Data Protection Invariants (CRITICAL)

The integrity of the user's operating system and personal data takes absolute priority over all other considerations. Every line of code that touches the filesystem must adhere to these rules:

1. **Strict Allowed Boundaries**:
   * The cleaner must ONLY target predetermined cache, temp, and dump directories.
   * Personal user folders (`Documents`, `Desktop`, `Pictures`, `Music`, `Videos`, `Downloads`) are strictly FORBIDDEN from bulk deletion.
   * System binary roots (`C:\Windows\System32`, `C:\Windows\SysWOW64`, `C:\Program Files`, `C:\Program Files (x86)`) must NEVER be targets of recursive unlinking.

2. **Containment Verification**:
   * Before unlinking any file or directory, the target path must be canonicalized (`path.resolve()`) and verified to strictly reside within an authorized root target:
     ```typescript
     function isSafeTarget(targetFile: string, allowedRoot: string): boolean {
       const resolvedTarget = path.resolve(targetFile);
       const resolvedRoot = path.resolve(allowedRoot);
       return resolvedTarget.startsWith(resolvedRoot) && resolvedTarget !== resolvedRoot;
     }
     ```
   * Never delete the target container directory itself if it is a system folder (e.g. `C:\Windows\Temp` must not be deleted, only its *contents*).

3. **No Symbolic Link Traversals**:
   * If a scanned directory entry is a symlink or junction (`dirent.isSymbolicLink()`), do NOT recurse into it. Only unlink the link itself or skip it.

4. **Resilient Error Trapping**:
   * Files actively in use by Windows or open applications will throw `EBUSY` or `EPERM`.
   * **Rule**: Catch these errors gracefully. Never crash the process or abort the rest of the queue. Increment `skippedFilesCount` and append to the execution audit log.

5. **No Registry Modifications in Phase 1**:
   * Registry cleaning provides negligible space recovery and carries severe risk. Registry writes or deletes are banned in this phase.

---

## 2. Code Quality & Architecture Standards

1. **TypeScript Strict Mode**:
   * `noImplicitAny: true`, `strictNullChecks: true`.
   * IPC channels must be typed via shared interface definitions in `src/shared/types.ts`.
2. **Context Isolation**:
   * Electron `contextIsolation: true` and `nodeIntegration: false` must always remain enabled.
   * Only communicate through `cleanerApi` in preload.
3. **No UI Freezing**:
   * Long-running I/O operations (scanning 100k files) must run asynchronously in non-blocking batches.
   * Progress events must be throttled/batched (e.g. emitting UI events every 50ms) to prevent IPC channel flooding.
4. **No Placeholder Data**:
   * File sizes, paths, and drive metrics must always query live Windows APIs. Never use mock numbers in production code.

---

## 3. Windows Shell Specifics

1. **Recycle Bin Handling**:
   * Use native PowerShell `Clear-RecycleBin -Force -ErrorAction SilentlyContinue` or Windows Shell API for emptying the trash bin across all drives.
2. **UAC / Administrator Rights**:
   * Identify which folders require elevation (`C:\Windows\Temp`, `SoftwareDistribution\Download`).
   * If elevation is required, request user permission explicitly or skip gracefully with a clear badge.
