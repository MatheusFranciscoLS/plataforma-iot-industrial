package com.industria.iot_core.model; // Atenção: se a sua pasta for iot_core, ajuste aqui

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "registro_sensor")
public class RegistroSensor {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String idMaquina;
    private Long timestamp;
    private Double temperaturaMotor;
    private Double vibracao;
    private Integer rpm;

    private LocalDateTime dataRecebimento;

    // Esse método roda automaticamente antes de salvar no banco
    @PrePersist
    protected void onCreate() {
        dataRecebimento = LocalDateTime.now();
    }

    // --- GETTERS E SETTERS ---
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getIdMaquina() { return idMaquina; }
    public void setIdMaquina(String idMaquina) { this.idMaquina = idMaquina; }

    public Long getTimestamp() { return timestamp; }
    public void setTimestamp(Long timestamp) { this.timestamp = timestamp; }

    public Double getTemperaturaMotor() { return temperaturaMotor; }
    public void setTemperaturaMotor(Double temperaturaMotor) { this.temperaturaMotor = temperaturaMotor; }

    public Double getVibracao() { return vibracao; }
    public void setVibracao(Double vibracao) { this.vibracao = vibracao; }

    public Integer getRpm() { return rpm; }
    public void setRpm(Integer rpm) { this.rpm = rpm; }

    public LocalDateTime getDataRecebimento() { return dataRecebimento; }
    public void setDataRecebimento(LocalDateTime dataRecebimento) { this.dataRecebimento = dataRecebimento; }
}