package com.rappi.farmer.infrastructure.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.stereotype.Component;

@Getter
@Setter
@Component
public class SessionContext {
    private Long currentUserId;
}
