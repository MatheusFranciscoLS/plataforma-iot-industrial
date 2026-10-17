package com.industria.iot_core.migracoes;

import com.industria.iot_core.model.RegistroSensor;
import com.industria.iot_core.model.Usuario;
import com.industria.iot_core.repository.RegistroSensorRepository;
import com.industria.iot_core.repository.UsuarioRepository;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Cria o esquema só com as migrações do Flyway (o Hibernate apenas confere, com ddl-auto=validate).
 * Se uma entidade mudar sem migração correspondente, este teste quebra no CI e não em produção.
 */
@SpringBootTest(properties = {
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate",
        "spring.datasource.url=jdbc:h2:mem:migracoes;MODE=PostgreSQL;DB_CLOSE_DELAY=-1"
})
class MigracoesTest {

    @Autowired JdbcTemplate jdbc;
    @Autowired RegistroSensorRepository leituras;
    @Autowired UsuarioRepository usuarios;
    @MockitoBean RabbitTemplate rabbitTemplate;

    @Test
    void asMigracoesCriamUmEsquemaQueAsEntidadesAceitam() {
        // Se chegou aqui, o contexto subiu: o Hibernate validou as tabelas criadas pelas migrações.
        Integer aplicadas = jdbc.queryForObject("SELECT COUNT(*) FROM \"flyway_schema_history\" WHERE \"success\" = TRUE", Integer.class);
        assertThat(aplicadas).isGreaterThanOrEqualTo(1);
    }

    @Test
    void asTabelasCriadasPelasMigracoesFuncionamParaGravarELer() {
        RegistroSensor r = new RegistroSensor();
        r.setIdMaquina("MAQ-01");
        r.setTimestamp(1_700_000_000L);
        r.setTemperaturaMotor(80.5);
        r.setVibracao(2.25);
        r.setRpm(1800);

        RegistroSensor salvo = leituras.saveAndFlush(r);
        usuarios.saveAndFlush(new Usuario("migracao-teste", "hash"));

        assertThat(salvo.getId()).isNotNull();
        assertThat(salvo.getDataRecebimento()).isNotNull();
        assertThat(leituras.findTop60ByOrderByTimestampDesc()).extracting(RegistroSensor::getIdMaquina).contains("MAQ-01");
        assertThat(usuarios.findByNome("migracao-teste")).isPresent();
    }
}
