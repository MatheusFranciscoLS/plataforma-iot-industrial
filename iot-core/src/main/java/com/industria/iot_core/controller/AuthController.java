package com.industria.iot_core.controller;

import com.industria.iot_core.security.TokenService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    @Autowired
    private TokenService tokenService;

    // "Moldes" rápidos para receber e devolver dados no formato JSON
    public record LoginRequest(String usuario, String senha) {}
    public record LoginResponse(String token) {}

    @PostMapping("/login")
    public ResponseEntity<?> fazerLogin(@RequestBody LoginRequest request) {
        
        // Verificação super simples de usuário fixo (Hardcoded)
        if ("admin".equals(request.usuario()) && "senha123".equals(request.senha())) {
            
            // Se acertou, a máquina gera o crachá
            String token = tokenService.gerarToken(request.usuario());
            System.out.println("🔐 Login aprovado! Crachá gerado para: " + request.usuario());
            
            return ResponseEntity.ok(new LoginResponse(token));
        }
        
        System.out.println("🚫 Tentativa de login falhou para: " + request.usuario());
        return ResponseEntity.status(401).body("Usuário ou senha inválidos!");
    }
}