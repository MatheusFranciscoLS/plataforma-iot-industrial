package com.industria.iot_core.config;

import com.industria.iot_core.model.Usuario.Perfil;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.util.Set;

/**
 * Proteção do site de demonstração. O acesso de administrador do demo é público (está no README), então, com
 * PROTEGER_USUARIOS=true, quem entra como administrador não consegue estragar o demo para os próximos visitantes:
 * - o administrador inicial e o usuário de demonstração não podem ser apagados nem ter senha ou perfil trocados;
 * - ninguém cria ou promove outro administrador;
 * - o total de usuários tem um teto (os criados por visitantes não se acumulam sem fim).
 * Desligada por padrão (uma instalação própria quer mexer em tudo). Quando algo é barrado a resposta é 423 (Locked).
 */
@Component
public class ProtecaoDoDemo {

    private final boolean ativa;
    private final Set<String> usuariosProtegidos;
    private final int maximoDeUsuarios;

    public ProtecaoDoDemo(@Value("${demo.proteger-usuarios:false}") boolean ativa,
                          @Value("${api.admin.usuario:admin}") String admin,
                          @Value("${api.demo.usuario:demo}") String demo,
                          @Value("${demo.max-usuarios:25}") int maximoDeUsuarios) {
        this.ativa = ativa;
        this.usuariosProtegidos = Set.of(admin, demo);
        this.maximoDeUsuarios = maximoDeUsuarios;
    }

    /** Este usuário está protegido agora? (só quando a proteção está ligada) */
    public boolean protegido(String nome) {
        return ativa && usuariosProtegidos.contains(nome);
    }

    public void exigirQueNaoSejaProtegido(String nome) {
        if (protegido(nome)) {
            throw barrado("Este usuário é protegido no site de demonstração");
        }
    }

    /** Criar usuário: sem novos administradores e com teto de usuários. */
    public void exigirCriacaoPermitida(Perfil perfil, long totalDeUsuarios) {
        if (!ativa) return;
        if (perfil == Perfil.ADMIN) {
            throw barrado("No site de demonstração não é possível criar administradores");
        }
        if (totalDeUsuarios >= maximoDeUsuarios) {
            throw barrado("O site de demonstração aceita no máximo " + maximoDeUsuarios + " usuários");
        }
    }

    /** Trocar o perfil de alguém: não vira administrador. */
    public void exigirPerfilPermitido(Perfil novoPerfil) {
        if (ativa && novoPerfil == Perfil.ADMIN) {
            throw barrado("No site de demonstração não é possível promover a administrador");
        }
    }

    private static ResponseStatusException barrado(String motivo) {
        return new ResponseStatusException(HttpStatus.LOCKED, motivo);
    }
}
