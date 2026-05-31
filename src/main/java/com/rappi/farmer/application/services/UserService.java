package com.rappi.farmer.application.services;

import com.rappi.farmer.application.dtos.CreateUserRequest;
import com.rappi.farmer.domain.entities.User;
import com.rappi.farmer.domain.repositories.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    @Transactional
    public User createUser(CreateUserRequest request) {
        log.info("Creando usuario: {}", request.getEmail());
        User user = new User(null, request.getFullName(), request.getEmail(), "FARMER");
        return userRepository.save(user);
    }

    public List<User> findAll() {
        return userRepository.findAll();
    }
}
