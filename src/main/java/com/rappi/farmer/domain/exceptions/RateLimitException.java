package com.rappi.farmer.domain.exceptions;

public class RateLimitException extends RuntimeException {
    private final long retryAfterSeconds;

    public RateLimitException(long retryAfterSeconds) {
        super("Rate limit de Groq superado — reintenta en " + retryAfterSeconds + "s");
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public long getRetryAfterSeconds() { return retryAfterSeconds; }
}
