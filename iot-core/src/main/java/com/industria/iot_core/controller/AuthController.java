package com.industria.iot_core.controller;

import com.industria.iot_core.security.TokenService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    private final TokenService tokenService;

    public AuthController(TokenService tokenService) {
        this.tokenService = tokenService;
    }

    // "Moldes" rápidos para receber e devolver dados no formato JSON
    public record LoginRequest(String usuario, String senha) {}
    public record LoginResponse(String token) {}

    @PostMapping("/login")
    public ResponseEntity<?> fazerLogin(@RequestBody LoginRequest request) {

        // Verificação simples de usuário fixo (demonstração).
        // O & (e não &&) é de propósito: as duas comparações sempre rodam, então o tempo não revela qual campo errou.
        if (iguais("admin", request.usuario()) & iguais("senha123", request.senha())) {
            log.info("Login aprovado para o usuário {}", request.usuario());
            return ResponseEntity.ok(new LoginResponse(tokenService.gerarToken(request.usuario())));
        }

        log.warn("Tentativa de login recusada");
        return ResponseEntity.status(401).body("Usuário ou senha inválidos!");
    }

    // Compara sem parar no primeiro caractere diferente, para não revelar nada pelo tempo de resposta.
    private static boolean iguais(String esperado, String recebido) {
        return recebido != null && MessageDigest.isEqual(
                esperado.getBytes(StandardCharsets.UTF_8),
                recebido.getBytes(StandardCharsets.UTF_8));
    }
}
