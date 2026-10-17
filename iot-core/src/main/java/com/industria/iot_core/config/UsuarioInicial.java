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
 * Cria os usuários iniciais na primeira vez que a API sobe com o banco vazio:
 * - o administrador (ADMIN), com ADMIN_USUARIO e ADMIN_SENHA;
 * - o usuário de demonstração (OPERADOR), com o acesso público que o botão "Ver o painel de demonstração" usa.
 *   Ele reconhece alertas e troca limites, mas não gerencia usuários. DEMO_USUARIO vazio desliga esse usuário.
 * Se um usuário já existe, não mexe nele (a senha pode ter sido trocada).
 * Em produção, defina ADMIN_SENHA: a senha padrão do administrador é pública (está no README).
 */
@Configuration
public class UsuarioInicial {

    static final String SENHA_PADRAO_DO_ADMIN = "senha123";

    private static final Logger log = LoggerFactory.getLogger(UsuarioInicial.class);

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public ApplicationRunner criarUsuarioInicial(UsuarioRepository repository,
                                                 PasswordEncoder encoder,
                                                 @Value("${api.admin.usuario:admin}") String nome,
                                                 @Value("${api.admin.senha:" + SENHA_PADRAO_DO_ADMIN + "}") String senha,
                                                 @Value("${api.demo.usuario:demo}") String nomeDemo,
                                                 @Value("${api.demo.senha:demo123}") String senhaDemo) {
        return (ApplicationArguments args) -> {
            if (repository.findByNome(nome).isEmpty()) {
                repository.save(new Usuario(nome, encoder.encode(senha), Usuario.Perfil.ADMIN));
                log.info("Usuário inicial '{}' criado como ADMIN.", nome);
            }
            if (!nomeDemo.isBlank() && repository.findByNome(nomeDemo).isEmpty()) {
                repository.save(new Usuario(nomeDemo, encoder.encode(senhaDemo), Usuario.Perfil.OPERADOR));
                log.info("Usuário de demonstração '{}' criado como OPERADOR.", nomeDemo);
            }

            repository.findByNome(nome)
                    .filter(admin -> encoder.matches(SENHA_PADRAO_DO_ADMIN, admin.getSenhaHash()))
                    .ifPresent(admin -> log.warn("ATENÇÃO: o administrador '{}' ainda usa a senha padrão, que é pública. "
                            + "Troque a senha dele na tela de usuários do painel.", admin.getNome()));
        };
    }
}
