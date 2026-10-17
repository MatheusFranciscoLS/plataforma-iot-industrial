package com.industria.iot_core.service;

import com.industria.iot_core.model.Alerta;
import com.industria.iot_core.model.RegistroSensor;
import com.industria.iot_core.repository.AlertaRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Registra um alerta quando uma máquina passa de um limite. Só o momento em que ela passa conta:
 * enquanto continuar acima do limite, as leituras seguintes não geram alertas repetidos.
 * O estado "estava acima?" fica na memória; reiniciar a API faz a primeira leitura acima do limite alertar de novo.
 */
@Service
public class AlertaService {

    private static final Logger log = LoggerFactory.getLogger(AlertaService.class);

    private final AlertaRepository repository;
    private final double limiteTemperatura;
    private final double limiteVibracao;

    // chave: máquina + tipo; valor: se a leitura anterior já estava acima do limite
    private final Map<String, Boolean> acima = new ConcurrentHashMap<>();

    // Os limites são os mesmos do painel (95 °C e 5,0 mm/s); se mudar aqui, mude lá (painel-react/src/lib/limites.js).
    public AlertaService(AlertaRepository repository,
                         @Value("${alerta.limite-temperatura:95}") double limiteTemperatura,
                         @Value("${alerta.limite-vibracao:5.0}") double limiteVibracao) {
        this.repository = repository;
        this.limiteTemperatura = limiteTemperatura;
        this.limiteVibracao = limiteVibracao;
    }

    public void avaliar(RegistroSensor leitura) {
        avaliar(leitura, Alerta.Tipo.TEMPERATURA, leitura.getTemperaturaMotor(), limiteTemperatura);
        avaliar(leitura, Alerta.Tipo.VIBRACAO, leitura.getVibracao(), limiteVibracao);
    }

    private void avaliar(RegistroSensor leitura, Alerta.Tipo tipo, Double valor, double limite) {
        if (valor == null) return;

        boolean estaAcima = valor > limite;
        Boolean estavaAcima = acima.put(leitura.getIdMaquina() + "|" + tipo, estaAcima);

        if (estaAcima && !Boolean.TRUE.equals(estavaAcima)) {
            repository.save(new Alerta(leitura.getIdMaquina(), leitura.getTimestamp(), tipo, valor, limite));
            log.info("Alerta: {} passou do limite de {} ({} > {})", leitura.getIdMaquina(), tipo, valor, limite);
        }
    }
}
