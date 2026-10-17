package com.industria.iot_core.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

/** Uma máquina passou de um limite. Guardado no servidor para a lista de alertas sobreviver ao recarregar a página. */
@Entity
@Table(name = "alerta", indexes = @Index(name = "idx_alerta_timestamp", columnList = "timestamp"))
public class Alerta {

    public enum Tipo { TEMPERATURA, VIBRACAO }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "id_maquina", nullable = false, length = 50)
    private String idMaquina;

    // Momento da leitura que causou o alerta, em segundos (o mesmo timestamp da leitura)
    @Column(nullable = false)
    private Long timestamp;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Tipo tipo;

    @Column(nullable = false)
    private Double valor;

    @Column(nullable = false)
    private Double limite;

    @Column(name = "data_registro", nullable = false)
    private LocalDateTime dataRegistro = LocalDateTime.now();

    // Quem viu o alerta e quando; vazios enquanto ninguém reconheceu.
    @Column(name = "reconhecido_por", length = 50)
    private String reconhecidoPor;

    @Column(name = "reconhecido_em")
    private LocalDateTime reconhecidoEm;

    protected Alerta() {
        // exigido pelo JPA
    }

    public Alerta(String idMaquina, Long timestamp, Tipo tipo, Double valor, Double limite) {
        this.idMaquina = idMaquina;
        this.timestamp = timestamp;
        this.tipo = tipo;
        this.valor = valor;
        this.limite = limite;
    }

    public Long getId() { return id; }
    public String getIdMaquina() { return idMaquina; }
    public Long getTimestamp() { return timestamp; }
    public Tipo getTipo() { return tipo; }
    public Double getValor() { return valor; }
    public Double getLimite() { return limite; }
    public LocalDateTime getDataRegistro() { return dataRegistro; }
    public String getReconhecidoPor() { return reconhecidoPor; }
    public LocalDateTime getReconhecidoEm() { return reconhecidoEm; }

    /** Marca o alerta como visto. Quem reconheceu primeiro fica registrado; reconhecer de novo não muda nada. */
    public void reconhecer(String usuario) {
        if (reconhecidoPor == null) {
            reconhecidoPor = usuario;
            reconhecidoEm = LocalDateTime.now();
        }
    }
}
