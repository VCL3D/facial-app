// Client-Side Logger - V51
// Sends logs to backend for debugging and diagnostics

class ClientLogger {
    constructor() {
        this.sessionId = null;
        this.enabled = true;
        this.buffer = []; // Buffer logs if session not initialized
        this.maxBufferSize = 50;
        this.sendQueue = [];
        this.isSending = false;
    }

    /**
     * Initialize logger with session ID
     */
    init(sessionId) {
        this.sessionId = sessionId;
        console.log(`📋 ClientLogger initialized for session: ${sessionId}`);

        // Flush buffered logs
        if (this.buffer.length > 0) {
            console.log(`📋 Flushing ${this.buffer.length} buffered logs`);
            this.buffer.forEach(log => this._sendLog(log.level, log.message, log.context));
            this.buffer = [];
        }
    }

    /**
     * Log info message
     */
    info(message, context = {}) {
        this._log('info', message, context);
    }

    /**
     * Log warning message
     */
    warn(message, context = {}) {
        this._log('warn', message, context);
    }

    /**
     * Log error message
     */
    error(message, context = {}) {
        this._log('error', message, context);
    }

    /**
     * Log event (info level with event name)
     */
    event(eventName, context = {}) {
        this._log('info', `Event: ${eventName}`, context);
    }

    /**
     * Internal logging method
     */
    _log(level, message, context) {
        if (!this.enabled) return;

        // Also log to browser console for debugging
        const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
        console[consoleMethod](`[${level.toUpperCase()}] ${message}`, context);

        // Send to backend
        if (this.sessionId) {
            this._sendLog(level, message, context);
        } else {
            // Buffer logs until session is initialized
            this.buffer.push({ level, message, context });
            if (this.buffer.length > this.maxBufferSize) {
                this.buffer.shift(); // Remove oldest log
            }
        }
    }

    /**
     * Send log to backend
     */
    async _sendLog(level, message, context) {
        const logEntry = {
            session_id: this.sessionId,
            level: level,
            message: message,
            context: context,
            timestamp: new Date().toISOString()
        };

        // Add to send queue
        this.sendQueue.push(logEntry);

        // Process queue
        if (!this.isSending) {
            this._processSendQueue();
        }
    }

    /**
     * Process send queue (batch sends to reduce requests)
     */
    async _processSendQueue() {
        if (this.isSending || this.sendQueue.length === 0) return;

        this.isSending = true;

        while (this.sendQueue.length > 0) {
            const logEntry = this.sendQueue.shift();

            try {
                await fetch('/api/log/client', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(logEntry)
                });
            } catch (err) {
                // Failed to send - log to console only
                console.error('Failed to send log to backend:', err);
                // Don't retry - would create infinite loop on network failure
            }

            // Small delay between sends to avoid overwhelming server
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        this.isSending = false;
    }

    /**
     * Disable logging (for production or if user opts out)
     */
    disable() {
        this.enabled = false;
    }

    /**
     * Enable logging
     */
    enable() {
        this.enabled = true;
    }
}

// Create global logger instance
window.clientLogger = new ClientLogger();

console.log('✅ ClientLogger ready (V51)');
