// server/sessions.ts
// This file was used for E2B session management and is no longer needed.
// It is intentionally left empty/stubbed.
export const sessionManager = {
    getOrCreateSandbox: async () => { throw new Error("E2B sessions disabled"); },
    cleanup: async () => { },
    killSession: async () => { }
};
