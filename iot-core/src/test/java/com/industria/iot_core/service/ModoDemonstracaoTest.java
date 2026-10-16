package com.industria.iot_core.service;

import com.industria.iot_core.dto.LeituraRequest;
import com.industria.iot_core.model.RegistroSensor;
import com.industria.iot_core.repository.RegistroSensorRepository;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Random;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

class ModoDemonstracaoTest {

    @Test
    void leituraGeradaFicaNasFaixasDoSimuladorPython() {
        Random random = new Random(42);
        for (int i = 0; i < 2000; i++) {
            LeituraRequest l = SimuladorDemo.gerarLeitura("MAQ-02", 1_700_000_000L, random);

            assertThat(l.idMaquina()).isEqualTo("MAQ-02");
            assertThat(l.timestamp()).isEqualTo(1_700_000_000L);
            assertThat(l.temperaturaMotor()).isBetween(60.0, 105.0);
            assertThat(l.vibracao()).isBetween(0.5, 6.0);
            assertThat(l.rpm()).isBetween(1200, 3500);
        }
    }

    @Nested
    @SpringBootTest(properties = {"demo.simulador.ativo=true", "demo.simulador.intervalo-ms=100"})
    class Ligado {

        @Autowired RegistroSensorRepository repository;
        @MockitoBean RabbitTemplate rabbitTemplate;

        @Test
        void aApiGeraLeiturasDasTresMaquinasSozinha() {
            await().atMost(Duration.ofSeconds(15)).untilAsserted(() -> {
                Set<String> maquinas = repository.findAll().stream()
                        .map(RegistroSensor::getIdMaquina).collect(Collectors.toSet());
                assertThat(maquinas).containsExactlyInAnyOrder("MAQ-01", "MAQ-02", "MAQ-03");
            });
        }
    }

    @Nested
    @SpringBootTest(properties = "demo.retencao-horas=1")
    class Limpeza {

        @Autowired RegistroSensorRepository repository;
        @Autowired LimpezaDeLeituras limpeza;
        @MockitoBean RabbitTemplate rabbitTemplate;

        private RegistroSensor leitura(long timestamp) {
            RegistroSensor r = new RegistroSensor();
            r.setIdMaquina("MAQ-01");
            r.setTimestamp(timestamp);
            r.setTemperaturaMotor(70.0);
            r.setVibracao(1.0);
            r.setRpm(1500);
            return r;
        }

        @Test
        void apagaSoAsLeiturasMaisAntigasQueOLimite() {
            long agora = Instant.now().getEpochSecond();
            repository.deleteAll();
            repository.save(leitura(agora - 3 * 3600)); // 3 h atrás: apaga
            repository.save(leitura(agora - 2 * 3600)); // 2 h atrás: apaga
            repository.save(leitura(agora - 600));      // 10 min atrás: fica
            repository.save(leitura(agora));            // agora: fica

            limpeza.apagarAntigas();

            List<Long> restantes = repository.findAll().stream().map(RegistroSensor::getTimestamp).toList();
            assertThat(restantes).hasSize(2).allMatch(t -> t >= agora - 600);
        }
    }
}
