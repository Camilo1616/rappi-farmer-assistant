package com.rappi.farmer.application.services;

import com.rappi.farmer.application.dtos.CreateUserRequest;
import com.rappi.farmer.application.dtos.PanelUserDto;
import com.rappi.farmer.domain.entities.User;
import com.rappi.farmer.domain.enums.UserRole;
import com.rappi.farmer.domain.exceptions.BusinessException;
import com.rappi.farmer.domain.repositories.UserRepository;
import com.rappi.farmer.domain.services.MailSender;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class UserAdminServiceTest {

    private UserRepository repo;
    private UserService userService;
    private PasswordEncoder encoder;
    private MailSender mail;
    private UserAdminService service;

    private static User user(long id, String name, String email, UserRole role) {
        User u = new User();
        u.setId(id);
        u.setFullName(name);
        u.setEmail(email);
        u.setRole(role.name());
        u.setAccountStatus("ACTIVE");
        return u;
    }

    @BeforeEach
    void setUp() {
        repo = mock(UserRepository.class);
        userService = mock(UserService.class);
        encoder = mock(PasswordEncoder.class);
        mail = mock(MailSender.class);
        service = new UserAdminService(repo, userService, encoder, mail);
        when(repo.findById(1L)).thenReturn(Optional.of(user(1, "Angela", "angela@jbell.co", UserRole.DUENA)));
        when(repo.findById(2L)).thenReturn(Optional.of(user(2, "Lorena", "lorena@jbell.co", UserRole.ASISTENTE)));
        when(repo.findById(3L)).thenReturn(Optional.of(user(3, "Cristian", "cristian@rappi.com", UserRole.FARMER_MASS)));
        when(repo.save(any())).thenAnswer(i -> i.getArgument(0));
        when(encoder.encode(anyString())).thenReturn("HASH");
        when(userService.createUser(any())).thenAnswer(i -> {
            CreateUserRequest r = i.getArgument(0);
            User u = user(10, r.getFullName(), r.getEmail(), UserRole.valueOf(r.getRole()));
            u.setPasswordHash("HASH");
            return u;
        });
    }

    @Test
    void permissionMatrix() {
        assertTrue(UserAdminService.canManage(UserRole.ADMIN, UserRole.DUENA));
        assertTrue(UserAdminService.canManage(UserRole.DUENA, UserRole.ASISTENTE));
        assertTrue(UserAdminService.canManage(UserRole.ASISTENTE, UserRole.ASISTENTE));
        assertFalse(UserAdminService.canManage(UserRole.ASISTENTE, UserRole.DUENA));      // Lorena no crea propietarias
        assertFalse(UserAdminService.canManage(UserRole.DUENA, UserRole.FARMER_MASS));    // no toca usuarios de Rappi
        assertFalse(UserAdminService.canManage(UserRole.FARMER_MASS, UserRole.ASISTENTE));
    }

    @Test
    void createSendsTheTemporaryPasswordByEmailAndForcesAChange() {
        PanelUserDto dto = service.create(1L, " Paola ", " Paola@JBell.co ", "ASISTENTE");

        ArgumentCaptor<CreateUserRequest> req = ArgumentCaptor.forClass(CreateUserRequest.class);
        verify(userService).createUser(req.capture());
        String temp = req.getValue().getPassword();
        assertEquals(12, temp.length());
        assertEquals("paola@jbell.co", req.getValue().getEmail());

        ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
        verify(mail).send(eq("paola@jbell.co"), anyString(), body.capture());
        assertTrue(body.getValue().contains(temp), "el correo lleva la contraseña temporal");
        assertTrue(body.getValue().contains("paola@jbell.co"));
        // El usuario queda obligado a cambiarla y la respuesta no la expone
        verify(repo).save(argThat(User::isMustChangePassword));
        assertTrue(dto.mustChangePassword());
        assertFalse(dto.toString().contains(temp));
    }

    @Test
    void ifTheEmailFailsTheErrorPropagatesSoNothingIsKept() {
        doThrow(new BusinessException("No se pudo enviar el correo")).when(mail).send(anyString(), anyString(), anyString());
        assertThrows(BusinessException.class, () -> service.create(1L, "Paola", "paola@jbell.co", "ASISTENTE"));
    }

    @Test
    void createValidations() {
        assertThrows(BusinessException.class, () -> service.create(2L, "X", "x@jbell.co", "DUENA"));       // Lorena no crea DUENA
        assertThrows(BusinessException.class, () -> service.create(1L, "X", "x@jbell.co", "FARMER_MASS")); // rol de Rappi
        assertThrows(BusinessException.class, () -> service.create(1L, "X", "x@jbell.co", "INVENTADO"));
        assertThrows(BusinessException.class, () -> service.create(1L, " ", "x@jbell.co", "ASISTENTE"));
        assertThrows(BusinessException.class, () -> service.create(1L, "X", "no-es-correo", "ASISTENTE"));
        when(repo.existsByEmail("x@jbell.co")).thenReturn(true);
        assertThrows(BusinessException.class, () -> service.create(1L, "X", "x@jbell.co", "ASISTENTE"));
        verify(mail, never()).send(anyString(), anyString(), anyString());
    }

    @Test
    void resendGeneratesANewPasswordAndForcesAChange() {
        service.resendAccess(1L, 2L);
        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(repo).save(saved.capture());
        assertEquals("HASH", saved.getValue().getPasswordHash());
        assertTrue(saved.getValue().isMustChangePassword());
        ArgumentCaptor<String> temp = ArgumentCaptor.forClass(String.class);
        verify(encoder).encode(temp.capture());
        ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
        verify(mail).send(eq("lorena@jbell.co"), anyString(), body.capture());
        assertTrue(body.getValue().contains(temp.getValue()));
    }

    @Test
    void cannotManageRappiUsersOrYourself() {
        assertThrows(BusinessException.class, () -> service.resendAccess(1L, 3L));
        assertThrows(BusinessException.class, () -> service.setActive(1L, 1L, false));
        assertThrows(BusinessException.class, () -> service.changeRole(1L, 1L, "ASISTENTE"));
        verify(mail, never()).send(anyString(), anyString(), anyString());
    }

    @Test
    void deactivatingSuspendsTheAccount() {
        PanelUserDto dto = service.setActive(1L, 2L, false);
        assertFalse(dto.active());
        verify(repo).save(argThat(u -> "SUSPENDED".equals(u.getAccountStatus())));
    }

    @Test
    void assistantCannotPromoteAnAssistantToOwner() {
        User other = user(5, "Otra", "otra@jbell.co", UserRole.ASISTENTE);
        when(repo.findById(5L)).thenReturn(Optional.of(other));
        assertThrows(BusinessException.class, () -> service.changeRole(2L, 5L, "DUENA"));
        service.changeRole(1L, 5L, "DUENA");   // la propietaria sí puede
        assertEquals("DUENA", other.getRole());
    }

    @Test
    void listShowsOnlyPanelUsersWithTheirManageFlag() {
        when(repo.findAll()).thenReturn(List.of(
                user(1, "Angela", "angela@jbell.co", UserRole.DUENA),
                user(2, "Lorena", "lorena@jbell.co", UserRole.ASISTENTE),
                user(3, "Cristian", "cristian@rappi.com", UserRole.FARMER_MASS)));
        List<PanelUserDto> list = service.list(2L);          // quien consulta es Lorena
        assertEquals(List.of("Angela", "Lorena"), list.stream().map(PanelUserDto::fullName).toList());
        assertFalse(list.get(0).canManage());                // Lorena no administra a la propietaria
        assertTrue(list.get(1).canManage());
    }
}
