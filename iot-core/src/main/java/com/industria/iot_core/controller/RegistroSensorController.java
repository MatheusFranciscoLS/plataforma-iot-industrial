package com.industria.iot_core.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.industria.iot_core.config.RabbitConfig;
import com.industria.iot_core.dto.LeituraRequest;
import com.industria.iot_core.model.RegistroSensor;
import com.industria.iot_core.repository.RegistroSensorRepository;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;

@RestController
@RequestMapping("/api/sensores")
public class RegistroSensorController {

    private static final Logger log = LoggerFactory.getLogger(RegistroSensorController.class);
    private static final int PADRAO_HISTORICO = 60;
    private static final int MAXIMO_HISTORICO = 500;

    private final RegistroSensorRepository repository;
    private final RabbitTemplate rabbitTemplate;
    private final ObjectMapper objectMapper;

    // Se SENSOR_API_KEY estiver definida, os sensores precisam mandá-la no cabeçalho X-API-Key.
    // Sem ela, a entrada de dados continua aberta, como antes.
    private final String chaveSensores;

    public RegistroSensorController(RegistroSensorRepository repository,
                                    RabbitTemplate rabbitTemplate,
                                    ObjectMapper objectMapper,
                                    @Value("${api.sensor.key:}") String chaveSensores) {
        this.repository = repository;
        this.rabbitTemplate = rabbitTemplate;
        this.objectMapper = objectMapper;
        this.chaveSensores = chaveSensores;
    }

    @PostMapping
    public ResponseEntity<RegistroSensor> receberDados(
            @RequestHeader(value = "X-API-Key", required = false) String chave,
            @Valid @RequestBody LeituraRequest leitura) {

        if (!chaveSensores.isBlank() && !chaveConfere(chave)) {
            return ResponseEntity.status(401).build();
        }

        // Sempre cria um registro novo: o id e a data de recebimento são do servidor, nunca do sensor.
        RegistroSensor novo = new RegistroSensor();
        novo.setIdMaquina(leitura.idMaquina());
        novo.setTimestamp(leitura.timestamp());
        novo.setTemperaturaMotor(leitura.temperaturaMotor());
        novo.setVibracao(leitura.vibracao());
        novo.setRpm(leitura.rpm());

        RegistroSensor salvo = repository.save(novo);
        log.info("Leitura salva: {} | {} °C", salvo.getIdMaquina(), salvo.getTemperaturaMotor());

        // Só depois de salvar avisa a fila. Se a fila falhar, a leitura continua salva.
        try {
            rabbitTemplate.convertAndSend(RabbitConfig.FILA_SENSORES, objectMapper.writeValueAsString(salvo));
        } catch (Exception e) {
            log.warn("Não foi possível enviar a leitura {} para o RabbitMQ: {}", salvo.getId(), e.getMessage());
        }

        return ResponseEntity.ok(salvo);
    }

    /**
     * Histórico, do mais novo para o mais antigo. Sem parâmetros, devolve os 60 mais recentes de todas as máquinas
     * (como o painel sempre usou). `maquina` filtra uma máquina e `limite` escolhe o tamanho (de 1 a 500).
     */
    @GetMapping
    public ResponseEntity<List<RegistroSensor>> listarHistorico(
            @RequestParam(required = false) String maquina,
            @RequestParam(required = false) Integer limite) {

        if (maquina == null && limite == null) {
            return ResponseEntity.ok(repository.findTop60ByOrderByTimestampDesc());
        }

        int tamanho = Math.min(Math.max(limite == null ? PADRAO_HISTORICO : limite, 1), MAXIMO_HISTORICO);
        Pageable pagina = PageRequest.of(0, tamanho);

        List<RegistroSensor> registros = (maquina == null || maquina.isBlank())
                ? repository.findAllByOrderByTimestampDesc(pagina)
                : repository.findByIdMaquinaOrderByTimestampDesc(maquina, pagina);
        return ResponseEntity.ok(registros);
    }

    private boolean chaveConfere(String recebida) {
        return recebida != null && MessageDigest.isEqual(
                recebida.getBytes(StandardCharsets.UTF_8),
                chaveSensores.getBytes(StandardCharsets.UTF_8));
    }
}
