package com.industria.iot_core.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Quem pode entrar no painel. A senha nunca é guardada: só o hash BCrypt dela. */
@Entity
@Table(name = "usuario")
public class Usuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String nome;

    @Column(name = "senha_hash", nullable = false)
    private String senhaHash;

    protected Usuario() {
        // exigido pelo JPA
    }

    public Usuario(String nome, String senhaHash) {
        this.nome = nome;
        this.senhaHash = senhaHash;
    }

    public Long getId() { return id; }
    public String getNome() { return nome; }
    public String getSenhaHash() { return senhaHash; }
}
