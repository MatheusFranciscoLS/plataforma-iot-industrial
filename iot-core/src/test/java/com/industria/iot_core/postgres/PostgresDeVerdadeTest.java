package com.industria.iot_core.postgres;

import com.industria.iot_core.model.Alerta;
import com.industria.iot_core.model.RegistroSensor;
import com.industria.iot_core.model.Usuario.Perfil;
import com.industria.iot_core.repository.AlertaRepository;
import com.industria.iot_core.repository.RegistroSensorRepository;
import com.industria.iot_core.security.TokenService;
import com.industria.iot_core.service.LimpezaDeLeituras;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * A API inteira contra um PostgreSQL de verdade (num container), do mesmo tipo do banco de produção.
 * Os outros testes usam H2, que aceita coisas que o Postgres recusa; aqui as migrações do Flyway criam o esquema,
 * o Hibernate só confere (validate) e as consultas, restrições e tipos rodam no banco real.
 * Sem Docker na máquina, esta classe é pulada; no CI roda sempre.
 */
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(properties = {
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate",
        "spring.jpa.database-platform=org.hibernate.dialect.PostgreSQLDialect",
        "spring.datasource.driver-class-name=org.postgresql.Driver",
        "demo.retencao-horas=1"
})
@AutoConfigureMockMvc
class PostgresDeVerdadeTest {

    @Container
    static final PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17-alpine");

    @DynamicPropertySource
    static void bancoDoContainer(DynamicPropertyRegistry registro) {
        registro.add("spring.datasource.url", postgres::getJdbcUrl);
        registro.add("spring.datasource.username", postgres::getUsername);
        registro.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired MockMvc mockMvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired TokenService tokenService;
    @Autowired AlertaRepository alertas;
    @Autowired RegistroSensorRepository leituras;
    @Autowired LimpezaDeLeituras limpeza;
    @MockitoBean RabbitTemplate rabbitTemplate;

    private String como(Perfil perfil) {
        return "Bearer " + tokenService.gerarToken("pg-" + perfil, perfil);
    }

    private void enviar(String maquina, long timestamp, double temperatura, double vibracao) throws Exception {
        mockMvc.perform(post("/api/sensores").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"idMaquina\":\"" + maquina + "\",\"timestamp\":" + timestamp
                                + ",\"temperaturaMotor\":" + temperatura + ",\"vibracao\":" + vibracao + ",\"rpm\":1500}"))
                .andExpect(status().isOk());
    }

    @Test
    void asQuatroMigracoesRodaramNoPostgresEOEsquemaTemOQueAsEntidadesPedem() {
        Integer sucesso = jdbc.queryForObject("SELECT COUNT(*) FROM flyway_schema_history WHERE success", Integer.class);
        assertThat(sucesso).isEqualTo(4);

        assertThat(jdbc.queryForList("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'", String.class))
                .contains("usuario", "registro_sensor", "alerta", "limite_maquina");
        assertThat(jdbc.queryForList("SELECT column_name FROM information_schema.columns WHERE table_name = 'usuario'", String.class))
                .contains("perfil");
    }

    @Test
    void osUsuariosIniciaisNascemComOsPerfisCertos() {
        assertThat(jdbc.queryForObject("SELECT perfil FROM usuario WHERE nome = 'admin'", String.class)).isEqualTo("ADMIN");
        assertThat(jdbc.queryForObject("SELECT perfil FROM usuario WHERE nome = 'demo'", String.class)).isEqualTo("OPERADOR");
    }

    @Test
    void leituraGeraAlertaQueSeReconheceEAparecePeloFiltro() throws Exception {
        enviar("PG-ALERTA", 1000, 99.0, 6.0);
        Long id = alertas.findAll().stream().filter(a -> a.getIdMaquina().equals("PG-ALERTA") && a.getTipo() == Alerta.Tipo.TEMPERATURA)
                .findFirst().orElseThrow().getId();

        // Cada filtro sozinho e todos juntos, para o Postgres provar que as consultas montadas aceitam parâmetros ausentes
        mockMvc.perform(get("/api/alertas?limite=200&maquina=PG-ALERTA").header("Authorization", como(Perfil.LEITURA)))
                .andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(2)));
        mockMvc.perform(get("/api/alertas?limite=200&tipo=VIBRACAO&maquina=PG-ALERTA").header("Authorization", como(Perfil.LEITURA)))
                .andExpect(jsonPath("$", hasSize(1)));
        mockMvc.perform(get("/api/alertas?limite=200&reconhecido=false&maquina=PG-ALERTA").header("Authorization", como(Perfil.LEITURA)))
                .andExpect(jsonPath("$", hasSize(2)));

        mockMvc.perform(post("/api/alertas/" + id + "/reconhecer").header("Authorization", como(Perfil.OPERADOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reconhecidoPor", is("pg-OPERADOR")))
                .andExpect(jsonPath("$.reconhecidoEm").exists());

        mockMvc.perform(get("/api/alertas?limite=200&reconhecido=true&maquina=PG-ALERTA").header("Authorization", como(Perfil.LEITURA)))
                .andExpect(jsonPath("$", hasSize(1)));
        mockMvc.perform(get("/api/alertas?limite=200&reconhecido=false&maquina=PG-ALERTA").header("Authorization", como(Perfil.LEITURA)))
                .andExpect(jsonPath("$", hasSize(1)));
        mockMvc.perform(get("/api/alertas/pendentes").header("Authorization", como(Perfil.LEITURA)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.quantidade").isNumber());
    }

    @Test
    void limiteDeMaquinaTrocaSemDuplicarEOBancoBarraDuplicataDireta() throws Exception {
        for (String valor : new String[] {"80", "85"}) {
            mockMvc.perform(put("/api/limites/PG-LIMITE/TEMPERATURA").header("Authorization", como(Perfil.OPERADOR))
                    .contentType(MediaType.APPLICATION_JSON).content("{\"limite\": " + valor + "}")).andExpect(status().isOk());
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM limite_maquina WHERE id_maquina = 'PG-LIMITE'", Integer.class)).isEqualTo(1);

        assertThatThrownBy(() -> jdbc.update("INSERT INTO limite_maquina (id_maquina, tipo, limite) VALUES ('PG-LIMITE', 'TEMPERATURA', 70)"))
                .isInstanceOf(DataIntegrityViolationException.class);

        enviar("PG-LIMITE", 1000, 90.0, 1.0); // 90 passa de 85, mas não passaria do padrão (95)
        assertThat(alertas.findAll()).anyMatch(a -> a.getIdMaquina().equals("PG-LIMITE") && a.getLimite() == 85.0);

        mockMvc.perform(delete("/api/limites/PG-LIMITE/TEMPERATURA").header("Authorization", como(Perfil.OPERADOR)))
                .andExpect(status().isNoContent());
    }

    @Test
    void usuarioCriadoPeloAdministradorEntraComOPerfilEApagaDepois() throws Exception {
        mockMvc.perform(post("/api/usuarios").header("Authorization", como(Perfil.ADMIN)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"nome\":\"pg-ana\",\"senha\":\"senha-boa-123\",\"perfil\":\"LEITURA\"}")).andExpect(status().isCreated());
        mockMvc.perform(post("/api/usuarios").header("Authorization", como(Perfil.ADMIN)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"nome\":\"pg-ana\",\"senha\":\"senha-boa-123\",\"perfil\":\"LEITURA\"}")).andExpect(status().isConflict());

        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"usuario\":\"pg-ana\",\"senha\":\"senha-boa-123\"}")).andExpect(status().isOk());

        mockMvc.perform(delete("/api/usuarios/pg-ana").header("Authorization", como(Perfil.ADMIN))).andExpect(status().isNoContent());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM usuario WHERE nome = 'pg-ana'", Integer.class)).isZero();
    }

    @Test
    void historicoFiltraPorMaquinaELimiteNoPostgres() throws Exception {
        for (int i = 0; i < 5; i++) enviar("PG-HIST", 2000 + i, 70.0, 1.0);

        mockMvc.perform(get("/api/sensores?maquina=PG-HIST&limite=3").header("Authorization", como(Perfil.LEITURA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(3)))
                .andExpect(jsonPath("$[0].timestamp", is(2004)));
        mockMvc.perform(get("/api/sensores").header("Authorization", como(Perfil.LEITURA)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").isNumber());
    }

    @Test
    void aLimpezaApagaLeiturasEAlertasAntigosNoPostgres() {
        long agora = Instant.now().getEpochSecond();
        RegistroSensor velha = new RegistroSensor();
        velha.setIdMaquina("PG-LIMPA");
        velha.setTimestamp(agora - 3 * 3600);
        velha.setTemperaturaMotor(70.0);
        velha.setVibracao(1.0);
        velha.setRpm(1500);
        leituras.save(velha);
        alertas.save(new Alerta("PG-LIMPA", agora - 3 * 3600, Alerta.Tipo.TEMPERATURA, 99.0, 95.0));
        alertas.save(new Alerta("PG-LIMPA", agora - 60, Alerta.Tipo.TEMPERATURA, 99.0, 95.0));

        limpeza.apagarAntigas();

        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM registro_sensor WHERE id_maquina = 'PG-LIMPA'", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM alerta WHERE id_maquina = 'PG-LIMPA'", Integer.class)).isEqualTo(1);
    }
}
