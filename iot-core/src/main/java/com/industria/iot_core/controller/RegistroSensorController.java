package com.industria.iot_core.controller;

import com.industria.iot_core.dto.LeituraRequest;
import com.industria.iot_core.model.RegistroSensor;
import com.industria.iot_core.repository.RegistroSensorRepository;
import com.industria.iot_core.service.RegistroSensorService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
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

@Tag(name = "Sensores", description = "Entrada das leituras e histórico")
@RestController
@RequestMapping("/api/sensores")
public class RegistroSensorController {

    private static final int PADRAO_HISTORICO = 60;
    private static final int MAXIMO_HISTORICO = 500;

    private final RegistroSensorRepository repository;
    private final RegistroSensorService service;

    // Se SENSOR_API_KEY estiver definida, os sensores precisam mandá-la no cabeçalho X-API-Key.
    // Sem ela, a entrada de dados continua aberta, como antes.
    private final String chaveSensores;

    public RegistroSensorController(RegistroSensorRepository repository,
                                    RegistroSensorService service,
                                    @Value("${api.sensor.key:}") String chaveSensores) {
        this.repository = repository;
        this.service = service;
        this.chaveSensores = chaveSensores;
    }

    @Operation(summary = "Recebe uma leitura de sensor",
            description = "Sem token (os sensores não fazem login). Se a API tem SENSOR_API_KEY, exige o cabeçalho X-API-Key.")
    @SecurityRequirements // rota pública: sem o cadeado na documentação
    @PostMapping
    public ResponseEntity<RegistroSensor> receberDados(
            @RequestHeader(value = "X-API-Key", required = false) String chave,
            @Valid @RequestBody LeituraRequest leitura) {

        if (!chaveSensores.isBlank() && !chaveConfere(chave)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(service.registrar(leitura));
    }

    /**
     * Histórico, do mais novo para o mais antigo. Sem parâmetros, devolve os 60 mais recentes de todas as máquinas
     * (como o painel sempre usou). `maquina` filtra uma máquina e `limite` escolhe o tamanho (de 1 a 500).
     */
    @Operation(summary = "Histórico de leituras, do mais novo para o mais antigo")
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
