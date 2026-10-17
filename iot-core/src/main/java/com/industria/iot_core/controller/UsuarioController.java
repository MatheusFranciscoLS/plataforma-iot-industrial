package com.industria.iot_core.controller;

import com.industria.iot_core.model.Usuario;
import com.industria.iot_core.model.Usuario.Perfil;
import com.industria.iot_core.repository.UsuarioRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/** Gerência de usuários. Só o perfil ADMIN chega aqui (regra no SecurityConfig). A senha nunca sai nas respostas. */
@RestController
@RequestMapping("/api/usuarios")
public class UsuarioController {

    public record UsuarioResumo(String nome, Perfil perfil) {
        static UsuarioResumo de(Usuario u) {
            return new UsuarioResumo(u.getNome(), u.getPerfil());
        }
    }

    public record NovoUsuario(
            @NotNull(message = "nome é obrigatório")
            @Pattern(regexp = "[A-Za-z0-9._-]{3,50}", message = "nome deve ter de 3 a 50 letras, números, ponto, hífen ou sublinhado")
            String nome,
            @NotNull(message = "senha é obrigatória")
            @Size(min = 8, max = 72, message = "senha deve ter de 8 a 72 caracteres")
            String senha,
            @NotNull(message = "perfil é obrigatório")
            Perfil perfil) {}

    public record NovaSenha(
            @NotNull(message = "senha é obrigatória")
            @Size(min = 8, max = 72, message = "senha deve ter de 8 a 72 caracteres")
            String senha) {}

    public record NovoPerfil(@NotNull(message = "perfil é obrigatório") Perfil perfil) {}

    private final UsuarioRepository usuarios;
    private final PasswordEncoder encoder;

    public UsuarioController(UsuarioRepository usuarios, PasswordEncoder encoder) {
        this.usuarios = usuarios;
        this.encoder = encoder;
    }

    @GetMapping
    public List<UsuarioResumo> listar() {
        return usuarios.findAllByOrderByNomeAsc().stream().map(UsuarioResumo::de).toList();
    }

    @PostMapping
    @Transactional
    public ResponseEntity<UsuarioResumo> criar(@Valid @RequestBody NovoUsuario pedido) {
        if (usuarios.findByNome(pedido.nome()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Já existe um usuário com esse nome");
        }
        Usuario criado = usuarios.save(new Usuario(pedido.nome(), encoder.encode(pedido.senha()), pedido.perfil()));
        return ResponseEntity.status(HttpStatus.CREATED).body(UsuarioResumo.de(criado));
    }

    /** Troca a senha de qualquer usuário (inclusive a do próprio administrador). */
    @PutMapping("/{nome}/senha")
    @Transactional
    public ResponseEntity<Void> trocarSenha(@PathVariable String nome, @Valid @RequestBody NovaSenha pedido) {
        Usuario usuario = buscar(nome);
        usuario.setSenhaHash(encoder.encode(pedido.senha()));
        usuarios.save(usuario);
        return ResponseEntity.noContent().build();
    }

    /** Troca o perfil. O sistema nunca fica sem administrador. */
    @PutMapping("/{nome}/perfil")
    @Transactional
    public UsuarioResumo trocarPerfil(@PathVariable String nome, @Valid @RequestBody NovoPerfil pedido) {
        Usuario usuario = buscar(nome);
        if (usuario.getPerfil() == Perfil.ADMIN && pedido.perfil() != Perfil.ADMIN) {
            exigirOutroAdministrador();
        }
        usuario.setPerfil(pedido.perfil());
        return UsuarioResumo.de(usuarios.save(usuario));
    }

    /** Apaga o usuário. Ninguém apaga a si mesmo, e o último administrador fica. */
    @DeleteMapping("/{nome}")
    @Transactional
    public ResponseEntity<Void> apagar(@PathVariable String nome, Authentication autenticacao) {
        Usuario usuario = buscar(nome);
        if (usuario.getNome().equals(autenticacao.getName())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Você não pode apagar o seu próprio usuário");
        }
        if (usuario.getPerfil() == Perfil.ADMIN) {
            exigirOutroAdministrador();
        }
        usuarios.delete(usuario);
        return ResponseEntity.noContent().build();
    }

    private Usuario buscar(String nome) {
        return usuarios.findByNome(nome)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuário não encontrado"));
    }

    private void exigirOutroAdministrador() {
        if (usuarios.countByPerfil(Perfil.ADMIN) <= 1) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "O sistema precisa de pelo menos um administrador");
        }
    }
}
