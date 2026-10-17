package com.industria.iot_core.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/** Limite de alerta de uma máquina, no lugar do limite padrão. Uma linha por máquina e tipo. */
@Entity
@Table(name = "limite_maquina", uniqueConstraints = @UniqueConstraint(name = "uk_limite_maquina_tipo", columnNames = {"id_maquina", "tipo"}))
public class LimiteMaquina {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "id_maquina", nullable = false, length = 50)
    private String idMaquina;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Alerta.Tipo tipo;

    @Column(nullable = false)
    private Double limite;

    protected LimiteMaquina() {
        // exigido pelo JPA
    }

    public LimiteMaquina(String idMaquina, Alerta.Tipo tipo, Double limite) {
        this.idMaquina = idMaquina;
        this.tipo = tipo;
        this.limite = limite;
    }

    public Long getId() { return id; }
    public String getIdMaquina() { return idMaquina; }
    public Alerta.Tipo getTipo() { return tipo; }
    public Double getLimite() { return limite; }
    public void setLimite(Double limite) { this.limite = limite; }
}
