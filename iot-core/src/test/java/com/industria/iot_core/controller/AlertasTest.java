package com.industria.iot_core.controller;

import com.industria.iot_core.model.Alerta;
import com.industria.iot_core.repository.AlertaRepository;
import com.industria.iot_core.security.TokenService;
import com.industria.iot_core.service.LimpezaDeLeituras;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AlertasTest {

    @Nested
    @SpringBootTest
    @AutoConfigureMockMvc
    class PelaApi {

        @Autowired MockMvc mockMvc;
        @Autowired AlertaRepository alertas;
        @Autowired TokenService tokenService;
        @MockitoBean RabbitTemplate rabbitTemplate;

        // Cada teste usa uma máquina só dele: o "estava acima do limite?" fica guardado em memória entre os testes.
        private void enviar(String maquina, long timestamp, double temperatura, double vibracao) throws Exception {
            mockMvc.perform(post("/api/sensores")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"idMaquina\":\"" + maquina + "\",\"timestamp\":" + timestamp
                                    + ",\"temperaturaMotor\":" + temperatura + ",\"vibracao\":" + vibracao + ",\"rpm\":1500}"))
                    .andExpect(status().isOk());
        }

        private List<Alerta> alertasDa(String maquina) {
            return alertas.findAll().stream().filter(a -> a.getIdMaquina().equals(maquina)).toList();
        }

        private ResultActions listar(String consulta) throws Exception {
            return mockMvc.perform(get("/api/alertas" + consulta).header("Authorization", "Bearer " + tokenService.gerarToken("admin")));
        }

        @Test
        void passarDoLimiteDeTemperaturaGeraUmAlertaComOValorEOLimite() throws Exception {
            enviar("ALT-TEMP", 1000, 96.5, 2.0);

            List<Alerta> lista = alertasDa("ALT-TEMP");
            assertThat(lista).hasSize(1);
            assertThat(lista.get(0).getTipo()).isEqualTo(Alerta.Tipo.TEMPERATURA);
            assertThat(lista.get(0).getValor()).isEqualTo(96.5);
            assertThat(lista.get(0).getLimite()).isEqualTo(95.0);
            assertThat(lista.get(0).getTimestamp()).isEqualTo(1000L);
        }

        @Test
        void exatamenteNoLimiteNaoAlerta() throws Exception {
            enviar("ALT-LIMITE", 1000, 95.0, 5.0);

            assertThat(alertasDa("ALT-LIMITE")).isEmpty();
        }

        @Test
        void vibracaoAltaGeraAlertaDeVibracao() throws Exception {
            enviar("ALT-VIB", 1000, 70.0, 5.4);

            assertThat(alertasDa("ALT-VIB")).extracting(Alerta::getTipo).containsExactly(Alerta.Tipo.VIBRACAO);
        }

        @Test
        void passarDosDoisLimitesNaMesmaLeituraGeraDoisAlertas() throws Exception {
            enviar("ALT-DOIS", 1000, 99.0, 5.5);

            assertThat(alertasDa("ALT-DOIS")).extracting(Alerta::getTipo)
                    .containsExactlyInAnyOrder(Alerta.Tipo.TEMPERATURA, Alerta.Tipo.VIBRACAO);
        }

        @Test
        void enquantoContinuaAcimaNaoRepeteOAlertaEVoltandoDepoisDeNormalizarAlertaDeNovo() throws Exception {
            enviar("ALT-REPETE", 1000, 99.0, 1.0); // passou: alerta
            enviar("ALT-REPETE", 1002, 98.0, 1.0); // continua acima: nada
            enviar("ALT-REPETE", 1004, 97.0, 1.0); // continua acima: nada
            assertThat(alertasDa("ALT-REPETE")).hasSize(1);

            enviar("ALT-REPETE", 1006, 80.0, 1.0); // voltou ao normal
            enviar("ALT-REPETE", 1008, 99.0, 1.0); // passou de novo: alerta
            assertThat(alertasDa("ALT-REPETE")).hasSize(2);
        }

        @Test
        void listaVemDoMaisNovoParaOMaisAntigoERespeitaOLimite() throws Exception {
            enviar("ALT-LISTA", 2000, 99.0, 1.0);
            enviar("ALT-LISTA", 2002, 80.0, 1.0);
            enviar("ALT-LISTA", 3000, 99.0, 1.0);

            listar("?limite=200")
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].timestamp", is(3000)))
                    .andExpect(jsonPath("$[0].idMaquina", is("ALT-LISTA")))
                    .andExpect(jsonPath("$[0].tipo", is("TEMPERATURA")));
            listar("?limite=1").andExpect(jsonPath("$", hasSize(1)));
        }

        @Test
        void listaExigeToken() throws Exception {
            mockMvc.perform(get("/api/alertas")).andExpect(status().isForbidden());
        }
    }

    @Nested
    @SpringBootTest(properties = "demo.retencao-horas=1")
    class Limpeza {

        @Autowired AlertaRepository alertas;
        @Autowired LimpezaDeLeituras limpeza;
        @MockitoBean RabbitTemplate rabbitTemplate;

        @Test
        void aLimpezaTambemApagaAlertasAntigos() {
            long agora = Instant.now().getEpochSecond();
            alertas.deleteAll();
            alertas.save(new Alerta("LIMPA-1", agora - 3 * 3600, Alerta.Tipo.TEMPERATURA, 99.0, 95.0)); // antigo: apaga
            alertas.save(new Alerta("LIMPA-1", agora - 60, Alerta.Tipo.TEMPERATURA, 99.0, 95.0));        // recente: fica

            limpeza.apagarAntigas();

            assertThat(alertas.findAll()).hasSize(1);
        }
    }
}
