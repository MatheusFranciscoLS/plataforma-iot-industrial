package com.industria.iot_core.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

/**
 * Leitura enviada por um sensor. Só tem os campos que o sensor pode informar:
 * o id e a data de recebimento são sempre definidos pelo servidor (campos extras são ignorados).
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record LeituraRequest(
        @NotBlank @Size(max = 50) String idMaquina,
        @NotNull @Positive Long timestamp,
        @NotNull Double temperaturaMotor,
        @NotNull @PositiveOrZero Double vibracao,
        @NotNull @PositiveOrZero Integer rpm) {
}
