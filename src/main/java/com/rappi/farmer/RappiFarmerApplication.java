package com.rappi.farmer;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class RappiFarmerApplication {

    public static void main(String[] args) {
        SpringApplication.run(RappiFarmerApplication.class, args);
    }
}
