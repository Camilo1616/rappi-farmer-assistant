package com.rappi.farmer.application.services;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/** Delega en EmailVerificationService que ya funciona. */
@Service
@RequiredArgsConstructor
public class EmailPinService {

    private final EmailVerificationService verificationService;

    public void sendPin(String email) {
        verificationService.sendCode(email);
    }

    public boolean verifyPin(String email, String pin) {
        return verificationService.verify(email, pin);
    }
}
