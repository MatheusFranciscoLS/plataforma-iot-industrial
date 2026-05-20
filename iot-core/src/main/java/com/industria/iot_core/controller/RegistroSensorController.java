package com.industria.iot_core.controller; 

import com.industria.iot_core.model.RegistroSensor;
import com.industria.iot_core.repository.RegistroSensorRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/sensores")
@CrossOrigin(origins = "*")
public class RegistroSensorController {

    @Autowired
    private RegistroSensorRepository repository;

    @Autowired
    private RabbitTemplate rabbitTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    // Criamos a fila oficial no RabbitMQ
    @Bean
    public Queue filaSensores() {
        return new Queue("sensores.fila", true); 
    }

    @PostMapping
    public ResponseEntity<RegistroSensor> receberDados(@RequestBody RegistroSensor novoRegistro) {
        RegistroSensor salvo = repository.save(novoRegistro);
        System.out.println("💾 Salvo no Postgres: " + salvo.getIdMaquina() + " | Temp: " + salvo.getTemperaturaMotor() + "°C");
        
        // --- NOVA PARTE: Enviando para a Fila do RabbitMQ ---
        try {
            // Transformamos o objeto Java em um texto JSON perfeito
            String json = objectMapper.writeValueAsString(salvo);
            
            // Despachamos para o correio
            rabbitTemplate.convertAndSend("sensores.fila", json);
        } catch (Exception e) {
            System.out.println("⚠️ Erro ao enviar para o RabbitMQ: " + e.getMessage());
        }
        // --------------------------------------------------------

        return ResponseEntity.ok(salvo);
    }

    @GetMapping
    public ResponseEntity<List<RegistroSensor>> listarHistorico() {
        List<RegistroSensor> ultimos = repository.findTop60ByOrderByTimestampDesc();
        return ResponseEntity.ok(ultimos);
    }
}