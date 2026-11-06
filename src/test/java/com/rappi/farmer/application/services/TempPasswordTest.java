package com.rappi.farmer.application.services;

import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class TempPasswordTest {

    @Test
    void hasTwelveCharsWithUpperLowerAndDigitAndNoAmbiguousOnes() {
        for (int i = 0; i < 300; i++) {
            String p = TempPassword.generate();
            assertEquals(12, p.length());
            assertTrue(p.chars().anyMatch(Character::isUpperCase));
            assertTrue(p.chars().anyMatch(Character::isLowerCase));
            assertTrue(p.chars().anyMatch(Character::isDigit));
            assertFalse(p.matches(".*[0O1lI].*"), "caracter ambiguo en " + p);
        }
    }

    @Test
    void generatesDifferentPasswordsEachTime() {
        Set<String> seen = new HashSet<>();
        for (int i = 0; i < 500; i++) seen.add(TempPassword.generate());
        assertEquals(500, seen.size());
    }
}
