package com.industria.iot_core.controller;

import com.industria.iot_core.model.Usuario;
import com.industria.iot_core.repository.UsuarioRepository;
import com.industria.iot_core.security.LimiteDeTentativas;
import com.industria.iot_core.security.TokenService;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    private final TokenService tokenService;
    private final UsuarioRepository usuarios;
    private final PasswordEncoder encoder;
    private final LimiteDeTentativas limite;

    // Hash de uma senha qualquer: usado quando o usuário não existe, para o login demorar o mesmo
    // tempo com usuário certo ou errado (senão o tempo de resposta revelaria quais usuários existem).
    private final String hashFalso;

    public AuthController(TokenService tokenService, UsuarioRepository usuarios,
                          PasswordEncoder encoder, LimiteDeTentativas limite) {
        this.tokenService = tokenService;
        this.usuarios = usuarios;
        this.encoder = encoder;
        this.limite = limite;
        this.hashFalso = encoder.encode("senha-que-ninguem-usa");
    }

    // "Moldes" rápidos para receber e devolver dados no formato JSON
    public record LoginRequest(String usuario, String senha) {}
    public record LoginResponse(String token) {}

    @PostMapping("/login")
    public ResponseEntity<?> fazerLogin(@RequestBody LoginRequest request, HttpServletRequest http) {
        String nome = request.usuario() == null ? "" : request.usuario();
        String senha = request.senha() == null ? "" : request.senha();
        String chave = http.getRemoteAddr() + "|" + nome.toLowerCase();

        if (limite.bloqueado(chave)) {
            log.warn("Login bloqueado por excesso de tentativas");
            return ResponseEntity.status(429).body("Muitas tentativas. Tente de novo em alguns minutos.");
        }

        Optional<Usuario> usuario = usuarios.findByNome(nome);
        boolean senhaConfere = encoder.matches(senha, usuario.map(Usuario::getSenhaHash).orElse(hashFalso));

        if (usuario.isPresent() && senhaConfere) {
            limite.limpar(chave);
            log.info("Login aprovado para o usuário {}", nome);
            return ResponseEntity.ok(new LoginResponse(tokenService.gerarToken(usuario.get().getNome(), usuario.get().getPerfil())));
        }

        limite.registrarFalha(chave);
        log.warn("Tentativa de login recusada");
        return ResponseEntity.status(401).body("Usuário ou senha inválidos!");
    }
}
