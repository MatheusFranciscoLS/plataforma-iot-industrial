package com.industria.iot_core.repository;

import com.industria.iot_core.model.RegistroSensor;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
class RegistroSensorRepositoryTest {

    @Autowired RegistroSensorRepository repository;

    private RegistroSensor leitura(String maquina, long timestamp) {
        RegistroSensor r = new RegistroSensor();
        r.setIdMaquina(maquina);
        r.setTimestamp(timestamp);
        r.setTemperaturaMotor(70.0);
        r.setVibracao(1.0);
        r.setRpm(1500);
        return r;
    }

    @Test
    void salvarPreencheADataDeRecebimentoAutomaticamente() {
        RegistroSensor salvo = repository.saveAndFlush(leitura("MAQ-01", 1L));

        assertThat(salvo.getId()).isNotNull();
        assertThat(salvo.getDataRecebimento()).isNotNull();
    }

    @Test
    void historicoDevolveNoMaximo60RegistrosDoMaisNovoParaOMaisAntigo() {
        for (long t = 1; t <= 70; t++) {
            repository.save(leitura("MAQ-01", t));
        }

        List<RegistroSensor> historico = repository.findTop60ByOrderByTimestampDesc();

        assertThat(historico).hasSize(60);
        assertThat(historico.get(0).getTimestamp()).isEqualTo(70L);
        assertThat(historico.get(59).getTimestamp()).isEqualTo(11L);
    }

    @Test
    void historicoMisturaMaquinasEOrdenaSoPeloTempo() {
        repository.save(leitura("MAQ-01", 10L));
        repository.save(leitura("MAQ-02", 30L));
        repository.save(leitura("MAQ-03", 20L));

        List<RegistroSensor> historico = repository.findTop60ByOrderByTimestampDesc();

        assertThat(historico).extracting(RegistroSensor::getIdMaquina)
                .containsExactly("MAQ-02", "MAQ-03", "MAQ-01");
    }

    @Test
    void historicoVazioDevolveListaVazia() {
        assertThat(repository.findTop60ByOrderByTimestampDesc()).isEmpty();
    }
}
