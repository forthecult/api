/**
 * Circuit breaker for database connections to prevent cascading failures
 * and provide graceful degradation during downstream issues.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Failures exceeded threshold, requests fail fast
 * - HALF_OPEN: Testing if service recovered
 */

import { logger } from "./logger";

export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit */
  failureThreshold: number;
  /** Half-open request count for testing */
  halfOpenMaxRequests: number;
  /** Time in ms to wait before attempting reset (HALF_OPEN) */
  resetTimeoutMs: number;
}

export interface CircuitBreakerStats {
  failures: number;
  lastFailureTime: null | number;
  lastSuccessTime: null | number;
  state: CircuitState;
  successes: number;
}

export type CircuitState = "CLOSED" | "HALF_OPEN" | "OPEN";

const defaultConfig: CircuitBreakerConfig = {
  failureThreshold: 5,
  halfOpenMaxRequests: 3,
  resetTimeoutMs: 30000, // 30 seconds
};

export class DBCircuitBreaker {
  private config: CircuitBreakerConfig;
  private failures = 0;
  private halfOpenRequests = 0;
  private lastFailureTime: null | number = null;
  private lastSuccessTime: null | number = null;
  private state: CircuitState = "CLOSED";
  private successes = 0;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Execute a database operation with circuit breaker protection.
   * Automatically tracks failures/successes and transitions states.
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      if (this.shouldAttemptReset()) {
        this.transitionTo("HALF_OPEN");
      } else {
        throw new Error(
          `Circuit breaker OPEN for DB (failed ${this.failures} times, cooldown active)`,
        );
      }
    }

    if (this.state === "HALF_OPEN") {
      if (this.halfOpenRequests >= this.config.halfOpenMaxRequests) {
        throw new Error("Circuit breaker HALF_OPEN: max test requests reached");
      }
      this.halfOpenRequests++;
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Get current circuit state and statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      state: this.state,
      successes: this.successes,
    };
  }

  /**
   * Check if circuit is currently open (failing fast)
   */
  isOpen(): boolean {
    if (this.state === "OPEN" && !this.shouldAttemptReset()) {
      return true;
    }
    return false;
  }

  /**
   * Manually reset circuit to CLOSED state
   */
  reset(): void {
    this.transitionTo("CLOSED");
    this.failures = 0;
    this.successes = 0;
    this.halfOpenRequests = 0;
    logger.info("[CircuitBreaker] Manually reset to CLOSED");
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.config.failureThreshold) {
      this.transitionTo("OPEN");
    }
  }

  private onSuccess(): void {
    this.successes++;
    this.lastSuccessTime = Date.now();

    if (this.state === "HALF_OPEN") {
      // In HALF_OPEN, need consecutive successes to close
      // For simplicity, any success in HALF_OPEN closes the circuit
      this.transitionTo("CLOSED");
      this.failures = 0;
      this.halfOpenRequests = 0;
    } else {
      // Gradually reduce failure count on success in CLOSED state
      this.failures = Math.max(0, this.failures - 1);
    }
  }

  private shouldAttemptReset(): boolean {
    if (this.lastFailureTime === null) return true;
    return Date.now() - this.lastFailureTime >= this.config.resetTimeoutMs;
  }

  private transitionTo(newState: CircuitState): void {
    if (this.state !== newState) {
      logger.info(`[CircuitBreaker] ${this.state} -> ${newState}`);
      this.state = newState;

      if (newState === "HALF_OPEN") {
        this.halfOpenRequests = 0;
      }
    }
  }
}

// Global circuit breaker instance for DB operations
export const dbCircuitBreaker = new DBCircuitBreaker({
  failureThreshold: parseInt(
    process.env.DB_CIRCUIT_FAILURE_THRESHOLD || "5",
    10,
  ),
  halfOpenMaxRequests: parseInt(
    process.env.DB_CIRCUIT_HALF_OPEN_MAX || "3",
    10,
  ),
  resetTimeoutMs: parseInt(
    process.env.DB_CIRCUIT_RESET_TIMEOUT_MS || "30000",
    10,
  ),
});

/**
 * Health check function for monitoring
 */
export function getDbCircuitHealth(): {
  healthy: boolean;
  state: CircuitState;
} {
  const stats = dbCircuitBreaker.getStats();
  return {
    healthy: stats.state === "CLOSED",
    state: stats.state,
  };
}

/**
 * Wrapper function to execute DB operations with circuit breaker
 * Usage:
 *   const result = await withCircuitBreaker(() => db.query.users.findFirst());
 */
export async function withCircuitBreaker<T>(
  operation: () => Promise<T>,
  options?: Partial<CircuitBreakerConfig>,
): Promise<T> {
  const breaker = options ? new DBCircuitBreaker(options) : dbCircuitBreaker;
  return breaker.execute(operation);
}
