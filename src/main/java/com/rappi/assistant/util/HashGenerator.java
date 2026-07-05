package com.rappi.assistant.util;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

public class HashGenerator {
    public static void main(String[] args) {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        String[] passwords = {"123456", "rappi123", "farmer123"};
        for (String pwd : passwords) {
            System.out.println(pwd + " → " + encoder.encode(pwd));
        }
    }
}
