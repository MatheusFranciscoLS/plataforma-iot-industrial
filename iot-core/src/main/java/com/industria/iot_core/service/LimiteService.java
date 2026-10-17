package com.industria.iot_core.service;

import com.industria.iot_core.model.Alerta;
import com.industria.iot_core.model.LimiteMaquina;
import com.industria.iot_core.repository.LimiteMaquinaRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Limites de alerta: o padrão vem da configuração e cada máquina pode ter o seu.
 * Os limites próprios ficam numa cópia em memória (a API roda numa instância só), porque cada leitura recebida consulta isso.
 */
@Service
public class LimiteService {

    private final LimiteMaquinaRepository repository;
    private final Map<Alerta.Tipo, Double> padrao;

    // chave: máquina + tipo. Carregado do banco na primeira consulta e descartado a cada mudança.
    private volatile Map<String, Double> proprios;

    public LimiteService(LimiteMaquinaRepository repository,
                         @Value("${alerta.limite-temperatura:95}") double limiteTemperatura,
                         @Value("${alerta.limite-vibracao:5.0}") double limiteVibracao) {
        this.repository = repository;
        this.padrao = Map.of(Alerta.Tipo.TEMPERATURA, limiteTemperatura, Alerta.Tipo.VIBRACAO, limiteVibracao);
    }

    /** O limite que vale para a máquina: o dela, se existir, senão o padrão. */
    public double limiteDe(String idMaquina, Alerta.Tipo tipo) {
        Double proprio = proprios().get(chave(idMaquina, tipo));
        return proprio != null ? proprio : padrao.get(tipo);
    }

    public Map<Alerta.Tipo, Double> padrao() {
        return padrao;
    }

    public List<LimiteMaquina> listarProprios() {
        return repository.findAll().stream()
                .sorted(Comparator.comparing(LimiteMaquina::getIdMaquina).thenComparing(LimiteMaquina::getTipo))
                .toList();
    }

    @Transactional
    public LimiteMaquina definir(String idMaquina, Alerta.Tipo tipo, double limite) {
        LimiteMaquina linha = repository.findByIdMaquinaAndTipo(idMaquina, tipo)
                .orElseGet(() -> new LimiteMaquina(idMaquina, tipo, limite));
        linha.setLimite(limite);
        LimiteMaquina salvo = repository.save(linha);
        proprios = null;
        return salvo;
    }

    /** Volta ao limite padrão. Devolve false se a máquina já usava o padrão. */
    @Transactional
    public boolean remover(String idMaquina, Alerta.Tipo tipo) {
        var linha = repository.findByIdMaquinaAndTipo(idMaquina, tipo);
        linha.ifPresent(repository::delete);
        proprios = null;
        return linha.isPresent();
    }

    private Map<String, Double> proprios() {
        Map<String, Double> atual = proprios;
        if (atual == null) {
            Map<String, Double> novo = new ConcurrentHashMap<>();
            repository.findAll().forEach(l -> novo.put(chave(l.getIdMaquina(), l.getTipo()), l.getLimite()));
            proprios = novo;
            atual = novo;
        }
        return atual;
    }

    private static String chave(String idMaquina, Alerta.Tipo tipo) {
        return idMaquina + "|" + tipo;
    }
}
