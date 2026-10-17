package com.industria.iot_core.controller;

import com.industria.iot_core.config.ProtecaoDoDemo;
import com.industria.iot_core.model.Usuario;
import com.industria.iot_core.repository.UsuarioRepository;
import com.industria.iot_core.security.LimiteDeTentativas;
import com.industria.iot_core.security.TokenService;
import io.jsonwebtoken.Claims;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Optional;

@Tag(name = "Login", description = "Entrada no sistema")
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

    private final ProtecaoDoDemo protecao;

    public AuthController(TokenService tokenService, UsuarioRepository usuarios,
                          PasswordEncoder encoder, LimiteDeTentativas limite, ProtecaoDoDemo protecao) {
        this.tokenService = tokenService;
        this.usuarios = usuarios;
        this.encoder = encoder;
        this.limite = limite;
        this.protecao = protecao;
        this.hashFalso = encoder.encode("senha-que-ninguem-usa");
    }

    // "Moldes" rápidos para receber e devolver dados no formato JSON
    public record LoginRequest(String usuario, String senha) {}
    public record LoginResponse(String token) {}

    public record TrocaDeSenha(
            @NotBlank(message = "senhaAtual é obrigatória")
            String senhaAtual,
            @NotNull(message = "novaSenha é obrigatória")
            @Size(min = 8, max = 72, message = "novaSenha deve ter de 8 a 72 caracteres")
            String novaSenha) {}

    @Operation(summary = "Troca a senha do usuário logado",
            description = "Qualquer perfil, só a própria senha. 400 se a senha atual estiver errada; 429 depois de muitas tentativas; "
                    + "423 para os usuários protegidos do site de demonstração. Tokens já emitidos valem até vencer.")
    @PutMapping("/senha")
    @Transactional
    public ResponseEntity<?> trocarMinhaSenha(@Valid @RequestBody TrocaDeSenha pedido, Authentication autenticacao, HttpServletRequest http) {
        String nome = autenticacao.getName();
        protecao.exigirQueNaoSejaProtegido(nome);

        String chave = "senha|" + http.getRemoteAddr() + "|" + nome.toLowerCase();
        if (limite.bloqueado(chave)) {
            log.warn("Troca de senha bloqueada por excesso de tentativas");
            return ResponseEntity.status(429).body("Muitas tentativas. Tente de novo em alguns minutos.");
        }

        Usuario usuario = usuarios.findByNome(nome).orElse(null);
        if (usuario == null) {
            return ResponseEntity.status(401).build(); // o usuário foi apagado depois de o token ser emitido
        }
        if (!encoder.matches(pedido.senhaAtual(), usuario.getSenhaHash())) {
            limite.registrarFalha(chave);
            return ResponseEntity.badRequest().body("Senha atual incorreta");
        }

        limite.limpar(chave);
        usuario.setSenhaHash(encoder.encode(pedido.novaSenha()));
        usuarios.save(usuario);
        log.info("O usuário {} trocou a própria senha", nome);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Renova o token antes de ele vencer",
            description = "Devolve um token novo (mais 2 horas) com o perfil que o usuário tem agora. 401 se o token estiver vencido, "
                    + "o usuário não existir mais ou a sessão já tiver passado do limite de horas desde o login (padrão 12 h).")
    @PostMapping("/renovar")
    public ResponseEntity<?> renovar(@RequestHeader(value = "Authorization", required = false) String cabecalho) {
        String token = cabecalho != null && cabecalho.startsWith("Bearer ") ? cabecalho.substring(7) : "";
        Claims atuais = tokenService.ler(token).orElse(null);
        Usuario usuario = atuais == null ? null : usuarios.findByNome(atuais.getSubject()).orElse(null);
        if (usuario == null) {
            return ResponseEntity.status(401).build();
        }
        return tokenService.renovar(atuais, usuario.getPerfil())
                .<ResponseEntity<?>>map(novo -> ResponseEntity.ok(new LoginResponse(novo)))
                .orElseGet(() -> ResponseEntity.status(401).body("A sessão ficou longa demais. Entre de novo."));
    }

    @Operation(summary = "Faz o login e devolve o token JWT",
            description = "401 se usuário ou senha estiverem errados; 429 depois de muitas tentativas seguidas.")
    @SecurityRequirements // rota pública: sem o cadeado na documentação
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
