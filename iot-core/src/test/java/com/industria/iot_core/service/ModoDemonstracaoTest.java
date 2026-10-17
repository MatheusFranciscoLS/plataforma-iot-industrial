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

    // Uma hora de leituras (a cada 2 s) de cada máquina, repetida com sementes diferentes
    private static final int LEITURAS = 1800;

    private static List<LeituraRequest> simular(String maquina, long semente, int quantidade) {
        ModeloDeMaquina modelo = SimuladorDemo.modelosDasMaquinas().get(maquina);
        Random random = new Random(semente);
        return java.util.stream.IntStream.range(0, quantidade)
                .mapToObj(i -> modelo.proxima(1_700_000_000L + 2L * i, random))
                .toList();
    }

    @Test
    void leituraTrazAMaquinaEOMomentoCertos() {
        LeituraRequest l = simular("MAQ-02", 1, 1).get(0);

        assertThat(l.idMaquina()).isEqualTo("MAQ-02");
        assertThat(l.timestamp()).isEqualTo(1_700_000_000L);
    }

    @Test
    void osValoresFicamEmFaixasFisicasRazoaveisSempre() {
        for (String maquina : SimuladorDemo.MAQUINAS) {
            for (long semente = 1; semente <= 5; semente++) {
                for (LeituraRequest l : simular(maquina, semente, 5000)) {
                    assertThat(l.temperaturaMotor()).isBetween(40.0, 125.0);
                    assertThat(l.vibracao()).isBetween(0.2, 9.0);
                    assertThat(l.rpm()).isBetween(1000, 3600);
                }
            }
        }
    }

    @Test
    void osValoresVariamDevagarEmVezDePularDeUmaLeituraParaOutra() {
        for (long semente = 1; semente <= 5; semente++) {
            List<LeituraRequest> leituras = simular("MAQ-01", semente, 5000);
            for (int i = 1; i < leituras.size(); i++) {
                assertThat(Math.abs(leituras.get(i).temperaturaMotor() - leituras.get(i - 1).temperaturaMotor()))
                        .as("salto de temperatura na leitura %d", i).isLessThan(10.0);
                assertThat(Math.abs(leituras.get(i).vibracao() - leituras.get(i - 1).vibracao()))
                        .as("salto de vibração na leitura %d", i).isLessThan(1.2);
            }
        }
    }

    @Test
    void quasePrecisamenteOTempoTodoAMaquinaEstaNormalMasDeVezEmQuandoPassaDoLimite() {
        int acima = 0, total = 0, passagens = 0;
        for (long semente = 1; semente <= 10; semente++) {
            boolean estavaAcima = false;
            for (LeituraRequest l : simular("MAQ-03", semente, LEITURAS * 4)) {
                boolean estaAcima = l.temperaturaMotor() > 95.0 || l.vibracao() > 5.0;
                if (estaAcima) acima++;
                if (estaAcima && !estavaAcima) passagens++;
                estavaAcima = estaAcima;
                total++;
            }
        }
        // 10 sementes x 4 h: a máquina passa dos limites algumas vezes (os alertas) e a maior parte do tempo fica normal
        assertThat(passagens).as("passagens pelo limite").isBetween(100, 260);
        assertThat((double) acima / total).as("fração do tempo acima do limite").isBetween(0.005, 0.30);
    }

    @Test
    void foraDeUmEpisodioAMaquinaNuncaPassaDoLimite() {
        for (String maquina : SimuladorDemo.MAQUINAS) {
            ModeloDeMaquina modelo = SimuladorDemo.modelosDasMaquinas().get(maquina);
            Random random = new Random(7);
            int desdeOFimDoEpisodio = 1000; // depois de um episódio, os valores levam um tempo para voltar ao normal
            for (int i = 0; i < 20000; i++) {
                boolean estavaEmEpisodio = modelo.emEpisodio();
                LeituraRequest l = modelo.proxima(i, random);
                desdeOFimDoEpisodio = (estavaEmEpisodio || modelo.emEpisodio()) ? 0 : desdeOFimDoEpisodio + 1;
                if (desdeOFimDoEpisodio > 40) {
                    assertThat(l.temperaturaMotor()).as("%s leitura %d", maquina, i).isLessThanOrEqualTo(95.0);
                    assertThat(l.vibracao()).as("%s leitura %d", maquina, i).isLessThanOrEqualTo(5.0);
                }
            }
        }
    }

    @Test
    void asMaquinasTemNormaisDiferentes() {
        double mediaMaq1 = simular("MAQ-01", 3, 2000).stream().mapToDouble(LeituraRequest::temperaturaMotor).average().orElseThrow();
        double mediaMaq3 = simular("MAQ-03", 3, 2000).stream().mapToDouble(LeituraRequest::temperaturaMotor).average().orElseThrow();

        assertThat(mediaMaq3).isGreaterThan(mediaMaq1 + 5.0);
    }

    @Test
    void mesmaSementeDaAsMesmasLeituras() {
        assertThat(simular("MAQ-01", 99, 300)).isEqualTo(simular("MAQ-01", 99, 300));
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
