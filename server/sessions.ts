import { Sandbox } from '@e2b/sdk';

class SessionManager {
    private sessions: Map<string, { sandbox: Sandbox, lastActive: number }> = new Map();
    private CLEANUP_INTERVAL = 10 * 60 * 1000; // Check every 10 minutes
    private SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes of inactivity

    constructor() {
        setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL);
    }

    async getOrCreateSandbox(session_id: string, apiKey: string): Promise<Sandbox> {
        const session = this.sessions.get(session_id);
        
        if (session) {
            session.lastActive = Date.now();
            return session.sandbox;
        }

        const sandbox = await Sandbox.create({ apiKey });
        this.sessions.set(session_id, { sandbox, lastActive: Date.now() });
        return sandbox;
    }

    async cleanup() {
        const now = Date.now();
        for (const [id, session] of this.sessions.entries()) {
            if (now - session.lastActive > this.SESSION_TIMEOUT) {
                console.log(`[Sessions] Cleaning up session ${id}`);
                await session.sandbox.kill();
                this.sessions.delete(id);
            }
        }
    }

    async killSession(session_id: string) {
        const session = this.sessions.get(session_id);
        if (session) {
            await session.sandbox.kill();
            this.sessions.delete(session_id);
        }
    }
}

export const sessionManager = new SessionManager();
