-- Usuarios creados desde "Usuarios y roles" entran con una contrasena temporal que deben cambiar
ALTER TABLE `users` ADD COLUMN `must_change_password` bit(1) NOT NULL DEFAULT b'0';
