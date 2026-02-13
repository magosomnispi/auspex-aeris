import { DatabaseManager } from './database.js';
import { LiveAircraft } from './types.js';
declare let currentAircraft: LiveAircraft[];
export declare class Poller {
    private db;
    private isRunning;
    constructor(dbManager: DatabaseManager);
    poll(): Promise<void>;
    start(): void;
    stop(): void;
    getStatus(): {
        is_running: boolean;
        last_poll: number;
        errors: number;
        servitor_url: string;
        aircraft_count: number;
    };
    getCurrentAircraft(): LiveAircraft[];
}
export { currentAircraft };
//# sourceMappingURL=poller.d.ts.map