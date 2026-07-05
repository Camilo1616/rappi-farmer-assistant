package com.rappi.assistant;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class RappiAssistantApplication {

    public static void main(String[] args) {
        SpringApplication.run(RappiAssistantApplication.class, args);
    }
}
