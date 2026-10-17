package com.industria.iot_core.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Quem pode entrar no painel. A senha nunca é guardada: só o hash BCrypt dela. */
@Entity
@Table(name = "usuario")
public class Usuario {

    /**
     * O que cada usuário pode fazer:
     * ADMIN gerencia usuários e também faz tudo do operador; OPERADOR reconhece alertas e troca limites;
     * LEITURA só olha.
     */
    public enum Perfil {
        ADMIN, OPERADOR, LEITURA;

        /** Perfil escrito no token. Texto ausente ou desconhecido vira LEITURA, o menos poderoso. */
        public static Perfil deTexto(String texto) {
            if (texto == null) return LEITURA;
            try {
                return valueOf(texto);
            } catch (IllegalArgumentException e) {
                return LEITURA;
            }
        }
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String nome;

    @Column(name = "senha_hash", nullable = false)
    private String senhaHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Perfil perfil;

    protected Usuario() {
        // exigido pelo JPA
    }

    /** Sem dizer o perfil, o usuário nasce só com leitura. */
    public Usuario(String nome, String senhaHash) {
        this(nome, senhaHash, Perfil.LEITURA);
    }

    public Usuario(String nome, String senhaHash, Perfil perfil) {
        this.nome = nome;
        this.senhaHash = senhaHash;
        this.perfil = perfil;
    }

    public Long getId() { return id; }
    public String getNome() { return nome; }
    public String getSenhaHash() { return senhaHash; }
    public Perfil getPerfil() { return perfil; }
    public void setSenhaHash(String senhaHash) { this.senhaHash = senhaHash; }
    public void setPerfil(Perfil perfil) { this.perfil = perfil; }
}
