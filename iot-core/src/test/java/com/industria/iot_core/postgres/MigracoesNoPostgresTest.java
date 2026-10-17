package com.industria.iot_core.postgres;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * As migrações num PostgreSQL de verdade, nos dois pontos de partida que existem:
 * banco vazio (instalação nova) e banco que já tinha as tabelas criadas pelo Hibernate, antes do Flyway
 * (é o caso do banco do demo). Cada cenário usa o seu próprio esquema dentro do mesmo container.
 * Sem Docker na máquina, esta classe é pulada; no CI roda sempre.
 */
@Testcontainers(disabledWithoutDocker = true)
class MigracoesNoPostgresTest {

    @Container
    static final PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17-alpine");

    private JdbcTemplate bancoNoEsquema(String esquema) {
        return new JdbcTemplate(new DriverManagerDataSource(postgres.getJdbcUrl() + "&currentSchema=" + esquema,
                postgres.getUsername(), postgres.getPassword()));
    }

    private Flyway flyway(String esquema, boolean baselineNoV1) {
        var configuracao = Flyway.configure()
                .dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .schemas(esquema)
                .locations("classpath:db/migration");
        if (baselineNoV1) configuracao.baselineOnMigrate(true).baselineVersion("1");
        return configuracao.load();
    }

    @Test
    void bancoVazioRecebeTodasAsMigracoes() {
        flyway("novo", false).migrate();
        JdbcTemplate jdbc = bancoNoEsquema("novo");

        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM flyway_schema_history WHERE success", Integer.class)).isEqualTo(4);
        assertThat(jdbc.queryForList("SELECT table_name FROM information_schema.tables WHERE table_schema = 'novo'", String.class))
                .contains("usuario", "registro_sensor", "alerta", "limite_maquina");
    }

    @Test
    void bancoQueJaTinhaAsTabelasDoHibernateRecebeSoAsMigracoesNovasEOUsuarioExistenteViraAdmin() throws IOException {
        JdbcTemplate jdbc = bancoNoEsquema("legado");
        jdbc.execute("CREATE SCHEMA legado");
        // Como o Hibernate deixou o banco antes do Flyway: as tabelas da versão 1, com um usuário dentro e sem histórico
        String versao1 = new ClassPathResource("db/migration/V1__esquema_inicial.sql").getContentAsString(StandardCharsets.UTF_8);
        jdbc.execute(versao1);
        jdbc.update("INSERT INTO usuario (nome, senha_hash) VALUES ('admin', 'hash-existente')");
        jdbc.update("INSERT INTO registro_sensor (id_maquina, timestamp, temperatura_motor, vibracao, rpm) VALUES ('MAQ-01', 1000, 80, 2, 1500)");

        flyway("legado", true).migrate();

        // Nada foi apagado, a versão 1 só foi marcada, e as versões 2 a 4 rodaram por cima
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM registro_sensor", Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT type FROM flyway_schema_history WHERE version = '1'", String.class)).isEqualTo("BASELINE");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM flyway_schema_history WHERE success AND version IN ('2', '3', '4')", Integer.class))
                .isEqualTo(3);
        // Quem já existia antes dos perfis é quem criou o sistema: vira ADMIN
        assertThat(jdbc.queryForObject("SELECT perfil FROM usuario WHERE nome = 'admin'", String.class)).isEqualTo("ADMIN");
        // E um usuário novo, sem dizer o perfil, nasce só com leitura
        jdbc.update("INSERT INTO usuario (nome, senha_hash) VALUES ('novo', 'hash')");
        assertThat(jdbc.queryForObject("SELECT perfil FROM usuario WHERE nome = 'novo'", String.class)).isEqualTo("LEITURA");
    }
}
