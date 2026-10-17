package com.industria.iot_core.controller;

import com.industria.iot_core.model.Alerta;
import com.industria.iot_core.repository.AlertaRepository;
import com.industria.iot_core.security.TokenService;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Limites por máquina, filtros da lista de alertas e reconhecimento. Cada teste usa máquinas só dele (o estado "acima do limite" fica em memória). */
@SpringBootTest
@AutoConfigureMockMvc
class LimitesEReconhecimentoTest {

    @Autowired MockMvc mockMvc;
    @Autowired AlertaRepository alertas;
    @Autowired TokenService tokenService;
    @MockitoBean RabbitTemplate rabbitTemplate;

    private String token(String usuario) {
        return "Bearer " + tokenService.gerarToken(usuario);
    }

    private void enviar(String maquina, long timestamp, double temperatura, double vibracao) throws Exception {
        mockMvc.perform(post("/api/sensores")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"idMaquina\":\"" + maquina + "\",\"timestamp\":" + timestamp
                                + ",\"temperaturaMotor\":" + temperatura + ",\"vibracao\":" + vibracao + ",\"rpm\":1500}"))
                .andExpect(status().isOk());
    }

    private ResultActions definirLimite(String maquina, String tipo, String corpo) throws Exception {
        return mockMvc.perform(put("/api/limites/" + maquina + "/" + tipo)
                .header("Authorization", token("admin")).contentType(MediaType.APPLICATION_JSON).content(corpo));
    }

    private List<Alerta> alertasDa(String maquina) {
        return alertas.findAll().stream().filter(a -> a.getIdMaquina().equals(maquina)).toList();
    }

    // ---- limites ----

    @Test
    void listaOsLimitesPadraoEOsDefinidosParaAMaquina() throws Exception {
        definirLimite("LIM-LISTA", "TEMPERATURA", "{\"limite\": 80}").andExpect(status().isOk());

        mockMvc.perform(get("/api/limites").header("Authorization", token("admin")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.padrao.TEMPERATURA", is(95.0)))
                .andExpect(jsonPath("$.padrao.VIBRACAO", is(5.0)))
                .andExpect(jsonPath("$.maquinas[*].idMaquina", hasItem("LIM-LISTA")));
    }

    @Test
    void limiteProprioMaisBaixoFazAMaquinaAlertarAntes() throws Exception {
        definirLimite("LIM-BAIXO", "TEMPERATURA", "{\"limite\": 80}").andExpect(status().isOk());

        enviar("LIM-BAIXO", 1000, 85.0, 1.0); // 85 passa de 80, mas não passaria do padrão (95)

        List<Alerta> lista = alertasDa("LIM-BAIXO");
        assertThat(lista).hasSize(1);
        assertThat(lista.get(0).getLimite()).isEqualTo(80.0);
    }

    @Test
    void limiteProprioMaisAltoEvitaAlertaQueOPadraoDaria() throws Exception {
        definirLimite("LIM-ALTO", "TEMPERATURA", "{\"limite\": 110}").andExpect(status().isOk());

        enviar("LIM-ALTO", 1000, 100.0, 1.0);

        assertThat(alertasDa("LIM-ALTO")).isEmpty();
    }

    @Test
    void outraMaquinaContinuaComOLimitePadrao() throws Exception {
        definirLimite("LIM-UMA", "TEMPERATURA", "{\"limite\": 80}").andExpect(status().isOk());

        enviar("LIM-OUTRA", 1000, 85.0, 1.0);

        assertThat(alertasDa("LIM-OUTRA")).isEmpty();
    }

    @Test
    void removerOLimiteVoltaAoPadrao() throws Exception {
        definirLimite("LIM-VOLTA", "VIBRACAO", "{\"limite\": 2.0}").andExpect(status().isOk());
        mockMvc.perform(delete("/api/limites/LIM-VOLTA/VIBRACAO").header("Authorization", token("admin")))
                .andExpect(status().isNoContent());

        enviar("LIM-VOLTA", 1000, 50.0, 3.0); // passaria de 2,0, mas o limite voltou a 5,0

        assertThat(alertasDa("LIM-VOLTA")).isEmpty();
    }

    @Test
    void removerLimiteQueNaoExisteDa404() throws Exception {
        mockMvc.perform(delete("/api/limites/LIM-NADA/TEMPERATURA").header("Authorization", token("admin")))
                .andExpect(status().isNotFound());
    }

    @Test
    void definirDeNovoTrocaOValorSemDuplicar() throws Exception {
        definirLimite("LIM-TROCA", "TEMPERATURA", "{\"limite\": 80}").andExpect(status().isOk());
        definirLimite("LIM-TROCA", "TEMPERATURA", "{\"limite\": 90}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.limite", is(90.0)));

        mockMvc.perform(get("/api/limites").header("Authorization", token("admin")))
                .andExpect(jsonPath("$.maquinas[?(@.idMaquina=='LIM-TROCA')]", hasSize(1)));
    }

    @Test
    void valoresInvalidosSaoRecusados() throws Exception {
        definirLimite("LIM-RUIM", "TEMPERATURA", "{}").andExpect(status().isBadRequest());
        definirLimite("LIM-RUIM", "TEMPERATURA", "{\"limite\": -5}").andExpect(status().isBadRequest());
        definirLimite("LIM-RUIM", "TEMPERATURA", "{\"limite\": 999999}").andExpect(status().isBadRequest());
        definirLimite("LIM-RUIM", "PRESSAO", "{\"limite\": 50}").andExpect(status().isBadRequest());
        definirLimite("nome%20com%20espaco", "TEMPERATURA", "{\"limite\": 50}").andExpect(status().isBadRequest());
    }

    @Test
    void limitesExigemToken() throws Exception {
        mockMvc.perform(get("/api/limites")).andExpect(status().isForbidden());
        mockMvc.perform(put("/api/limites/MAQ-01/TEMPERATURA").contentType(MediaType.APPLICATION_JSON).content("{\"limite\": 80}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/limites/MAQ-01/TEMPERATURA")).andExpect(status().isForbidden());
    }

    // ---- reconhecimento e filtros ----

    @Test
    void reconhecerGuardaQuemViuEQuando() throws Exception {
        enviar("REC-UM", 1000, 99.0, 1.0);
        Long id = alertasDa("REC-UM").get(0).getId();

        mockMvc.perform(post("/api/alertas/" + id + "/reconhecer").header("Authorization", token("maria")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reconhecidoPor", is("maria")))
                .andExpect(jsonPath("$.reconhecidoEm").exists());
    }

    @Test
    void reconhecerDeNovoNaoTrocaQuemReconheceuPrimeiro() throws Exception {
        enviar("REC-DOIS", 1000, 99.0, 1.0);
        Long id = alertasDa("REC-DOIS").get(0).getId();

        mockMvc.perform(post("/api/alertas/" + id + "/reconhecer").header("Authorization", token("maria"))).andExpect(status().isOk());
        mockMvc.perform(post("/api/alertas/" + id + "/reconhecer").header("Authorization", token("joao")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reconhecidoPor", is("maria")));
    }

    @Test
    void reconhecerAlertaQueNaoExisteDa404() throws Exception {
        mockMvc.perform(post("/api/alertas/999999/reconhecer").header("Authorization", token("maria")))
                .andExpect(status().isNotFound());
    }

    @Test
    void reconhecerExigeToken() throws Exception {
        mockMvc.perform(post("/api/alertas/1/reconhecer")).andExpect(status().isForbidden());
    }

    @Test
    void alertaNovoVemSemReconhecimento() throws Exception {
        enviar("REC-NOVO", 1000, 99.0, 1.0);

        mockMvc.perform(get("/api/alertas?maquina=REC-NOVO").header("Authorization", token("admin")))
                .andExpect(jsonPath("$[0].reconhecidoPor", nullValue()))
                .andExpect(jsonPath("$[0].reconhecidoEm", nullValue()));
    }

    @Test
    void filtrosDaListaPorMaquinaTipoEReconhecido() throws Exception {
        enviar("FIL-A", 1000, 99.0, 6.0);  // temperatura e vibração
        enviar("FIL-B", 1001, 99.0, 1.0);  // só temperatura
        Long idDeA = alertasDa("FIL-A").stream().filter(a -> a.getTipo() == Alerta.Tipo.TEMPERATURA).findFirst().orElseThrow().getId();
        mockMvc.perform(post("/api/alertas/" + idDeA + "/reconhecer").header("Authorization", token("maria"))).andExpect(status().isOk());

        mockMvc.perform(get("/api/alertas?limite=200&maquina=FIL-A").header("Authorization", token("admin")))
                .andExpect(jsonPath("$", hasSize(2)));
        mockMvc.perform(get("/api/alertas?limite=200&maquina=FIL-A&tipo=VIBRACAO").header("Authorization", token("admin")))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].tipo", is("VIBRACAO")));
        mockMvc.perform(get("/api/alertas?limite=200&maquina=FIL-A&reconhecido=true").header("Authorization", token("admin")))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].reconhecidoPor", is("maria")));
        mockMvc.perform(get("/api/alertas?limite=200&maquina=FIL-A&reconhecido=false").header("Authorization", token("admin")))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].tipo", is("VIBRACAO")));
        mockMvc.perform(get("/api/alertas?limite=200&maquina=FIL-B").header("Authorization", token("admin")))
                .andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    void tipoInvalidoNoFiltroDa400() throws Exception {
        mockMvc.perform(get("/api/alertas?tipo=PRESSAO").header("Authorization", token("admin")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void contagemDePendentesDiminuiQuandoAlguemReconhece() throws Exception {
        enviar("PEN-UM", 1000, 99.0, 1.0);
        long antes = alertas.countByReconhecidoPorIsNull();
        Long id = alertasDa("PEN-UM").get(0).getId();

        mockMvc.perform(post("/api/alertas/" + id + "/reconhecer").header("Authorization", token("maria"))).andExpect(status().isOk());

        mockMvc.perform(get("/api/alertas/pendentes").header("Authorization", token("admin")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.quantidade", is((int) (antes - 1))));
    }
}
