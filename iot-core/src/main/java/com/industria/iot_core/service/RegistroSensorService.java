package com.industria.iot_core.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.industria.iot_core.config.RabbitConfig;
import com.industria.iot_core.dto.LeituraRequest;
import com.industria.iot_core.model.RegistroSensor;
import com.industria.iot_core.repository.RegistroSensorRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

/** Salva uma leitura e avisa a fila. Usado pela API (sensores reais) e pelo modo demonstração. */
@Service
public class RegistroSensorService {

    private static final Logger log = LoggerFactory.getLogger(RegistroSensorService.class);

    private final RegistroSensorRepository repository;
    private final RabbitTemplate rabbitTemplate;
    private final ObjectMapper objectMapper;
    private final AlertaService alertas;

    public RegistroSensorService(RegistroSensorRepository repository, RabbitTemplate rabbitTemplate,
                                 ObjectMapper objectMapper, AlertaService alertas) {
        this.repository = repository;
        this.rabbitTemplate = rabbitTemplate;
        this.objectMapper = objectMapper;
        this.alertas = alertas;
    }

    public RegistroSensor registrar(LeituraRequest leitura) {
        // Sempre cria um registro novo: o id e a data de recebimento são do servidor, nunca de quem envia.
        RegistroSensor novo = new RegistroSensor();
        novo.setIdMaquina(leitura.idMaquina());
        novo.setTimestamp(leitura.timestamp());
        novo.setTemperaturaMotor(leitura.temperaturaMotor());
        novo.setVibracao(leitura.vibracao());
        novo.setRpm(leitura.rpm());

        RegistroSensor salvo = repository.save(novo);
        log.info("Leitura salva: {} | {} °C", salvo.getIdMaquina(), salvo.getTemperaturaMotor());

        // Um problema ao registrar o alerta não pode impedir a leitura de seguir adiante.
        try {
            alertas.avaliar(salvo);
        } catch (Exception e) {
            log.warn("Não foi possível avaliar os alertas da leitura {}: {}", salvo.getId(), e.getMessage());
        }

        // Só depois de salvar avisa a fila. Se a fila falhar, a leitura continua salva.
        try {
            rabbitTemplate.convertAndSend(RabbitConfig.FILA_SENSORES, objectMapper.writeValueAsString(salvo));
        } catch (Exception e) {
            log.warn("Não foi possível enviar a leitura {} para o RabbitMQ: {}", salvo.getId(), e.getMessage());
        }

        return salvo;
    }
}
