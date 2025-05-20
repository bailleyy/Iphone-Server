const { createClient } = require("redis");
const Color = require("cli-color");

class Database {
    constructor(Server) {
        this.Type = "redis";
        this.Server = Server
        this.connectionAttempts = 0;
        this.maxRetries = 5;
        this.retryDelay = 5000

        this.Redis = createClient({
            url: process.env.REDIS_URL || null,
            socket: {
                reconnectStrategy: (attempts) => {
                    this.connectionAttempts = attempts;
                    const maxDelay = 30000;
                    const baseDelay = Math.min(attempts * this.retryDelay, maxDelay);
                    const jitter = Math.floor(Math.random() * 1000);
                    const delay = baseDelay + jitter;

                    console.log(Color.red(`[REDIS]: Redis connection lost. Attempting reconnect (${attempts}/${this.maxRetries}) in ${delay}ms`));
                    return attempts <= this.maxRetries ? delay : false;
                },
                keepAlive: 10000,
                connectTimeout: 15000,
                noDelay: true,
                tls: false
            },
            pingInterval: 10000,
            disableOfflineQueue: false,
            database: 0
        });
    }

    async #CheckHealth() {
        try {
            await this.Redis.ping();
            return true;
        } catch (error) {
            console.error(Color.red(`[REDIS]: Connection health check failed: ${error.message}`));
            return false;
        }
    }

    #HealthChecks() {
        this.healthCheckInterval = setInterval(async () => {
            if (!await this.#CheckHealth()) {
                console.log(Color.yellow("[REDIS]: Attempting to reconnect..."));
                await this.Redis.close().catch(() => { });
                await this.Redis.connect().catch(e => {
                    console.error(Color.red(`[REDIS]: Reconnect failed: ${e.message}`));
                });
            }
        }, 30000);
    }

    async Connect() {
        try {
            this.#HealthChecks();

            await this.Redis.connect();
            this.Server.Redis = this.Redis;
            console.log(Color.greenBright("[REDIS]: Successfully connected to the Redis database."))
        } catch (error) {
            console.error(Color.red(`[REDIS]: Initial connection failed: `, error));
            throw error;
        }
    }

    async Close() {
        try {
            if (this.Redis.isOpen) {
                await this.Redis.quit();
            }
        } catch (error) {
            console.error(Color.red(`[REDIS]: Error closing Redis connection: ${error.message}`));
            throw error;
        }
    }

}

module.exports = Database;