package com.industria.iot_core.config;

import com.industria.iot_core.model.Usuario;
import com.industria.iot_core.repository.UsuarioRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Cria o usuário de demonstração na primeira vez que a API sobe com o banco vazio.
 * Se o usuário já existe, não mexe nele (a senha pode ter sido trocada no banco).
 * Em produção, defina ADMIN_USUARIO e ADMIN_SENHA para não usar o acesso público de demonstração.
 */
@Configuration
public class UsuarioInicial {

    private static final Logger log = LoggerFactory.getLogger(UsuarioInicial.class);

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public ApplicationRunner criarUsuarioInicial(UsuarioRepository repository,
                                                 PasswordEncoder encoder,
                                                 @Value("${api.admin.usuario:admin}") String nome,
                                                 @Value("${api.admin.senha:senha123}") String senha) {
        return (ApplicationArguments args) -> {
            if (repository.findByNome(nome).isEmpty()) {
                repository.save(new Usuario(nome, encoder.encode(senha)));
                log.info("Usuário inicial '{}' criado.", nome);
            }
        };
    }
}
