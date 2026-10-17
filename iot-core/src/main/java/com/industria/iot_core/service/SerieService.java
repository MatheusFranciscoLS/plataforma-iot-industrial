package com.industria.iot_core.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

/**
 * Séries e resumos de um período, calculados no banco (uma consulta de agrupamento), não no painel:
 * o painel recebe uns 100 pontos por máquina em vez de milhares de leituras.
 * O resultado de cada consulta fica uns segundos guardado, para vários painéis abertos não repetirem a mesma conta.
 */
@Service
public class SerieService {

    public record Ponto(long t, long leituras, double temperatura, double temperaturaMax,
                        double vibracao, double vibracaoMax, double rpm) {}

    public record SerieDaMaquina(String idMaquina, List<Ponto> pontos) {}

    public record Serie(String periodo, int faixaSegundos, long de, long ate, List<SerieDaMaquina> maquinas) {}

    public record ResumoDaMaquina(String idMaquina, long leituras,
                                  double temperaturaMedia, double temperaturaMax, double temperaturaMin,
                                  double vibracaoMedia, double vibracaoMax, double vibracaoMin,
                                  double rpmMedio, double rpmMax,
                                  long alertasTemperatura, long alertasVibracao) {}

    public record Resumo(String periodo, long de, long ate, List<ResumoDaMaquina> maquinas) {}

    private record Guardado(long gravadoEmMs, Object valor) {}

    @PersistenceContext
    private EntityManager em;

    private final Clock relogio;
    private final long validadeDoCacheMs;
    private final Map<String, Guardado> cache = new ConcurrentHashMap<>();

    public SerieService(Clock relogio, @Value("${serie.cache-segundos:15}") long cacheSegundos) {
        this.relogio = relogio;
        this.validadeDoCacheMs = cacheSegundos * 1000;
    }

    /** Série do período, de todas as máquinas ou só de uma (`maquina` nulo ou vazio = todas). */
    @Transactional(readOnly = true)
    public Serie serie(Periodo periodo, String maquina) {
        return guardado("serie|" + periodo + "|" + maquina, () -> calcularSerie(periodo, maquina));
    }

    @Transactional(readOnly = true)
    public Resumo resumo(Periodo periodo) {
        return guardado("resumo|" + periodo, () -> calcularResumo(periodo));
    }

    @SuppressWarnings("unchecked")
    private <T> T guardado(String chave, Supplier<T> calculo) {
        long agoraMs = relogio.millis();
        Guardado atual = cache.get(chave);
        if (validadeDoCacheMs > 0 && atual != null && agoraMs - atual.gravadoEmMs() < validadeDoCacheMs) {
            return (T) atual.valor();
        }
        T novo = calculo.get();
        cache.put(chave, new Guardado(agoraMs, novo));
        return novo;
    }

    private Serie calcularSerie(Periodo periodo, String maquina) {
        long ate = relogio.instant().getEpochSecond();
        long de = ate - periodo.duracaoSegundos();
        int faixa = periodo.faixaSegundos();
        boolean umaMaquina = maquina != null && !maquina.isBlank();

        // A faixa vem do enum (não do usuário), então entra no texto da consulta: com parâmetro, o Postgres não aceita
        // a mesma conta no SELECT e no GROUP BY.
        String hql = "select r.idMaquina, (r.timestamp / " + faixa + "), count(r), avg(r.temperaturaMotor), max(r.temperaturaMotor), "
                + "avg(r.vibracao), max(r.vibracao), avg(r.rpm) "
                + "from RegistroSensor r where r.timestamp >= :de and r.timestamp <= :ate "
                + (umaMaquina ? "and r.idMaquina = :maquina " : "")
                + "group by r.idMaquina, (r.timestamp / " + faixa + ") order by r.idMaquina, (r.timestamp / " + faixa + ")";
        var consulta = em.createQuery(hql, Object[].class).setParameter("de", de).setParameter("ate", ate);
        if (umaMaquina) consulta.setParameter("maquina", maquina);

        Map<String, List<Ponto>> porMaquina = new LinkedHashMap<>();
        for (Object[] linha : consulta.getResultList()) {
            String id = (String) linha[0];
            long inicioDaFaixa = ((Number) linha[1]).longValue() * faixa;
            porMaquina.computeIfAbsent(id, k -> new ArrayList<>()).add(new Ponto(
                    inicioDaFaixa, ((Number) linha[2]).longValue(),
                    numero(linha[3]), numero(linha[4]), numero(linha[5]), numero(linha[6]), numero(linha[7])));
        }
        List<SerieDaMaquina> maquinas = porMaquina.entrySet().stream().map(e -> new SerieDaMaquina(e.getKey(), e.getValue())).toList();
        return new Serie(periodo.texto(), faixa, de, ate, maquinas);
    }

    private Resumo calcularResumo(Periodo periodo) {
        long ate = relogio.instant().getEpochSecond();
        long de = ate - periodo.duracaoSegundos();

        List<Object[]> linhas = em.createQuery(
                        "select r.idMaquina, count(r), avg(r.temperaturaMotor), max(r.temperaturaMotor), min(r.temperaturaMotor), "
                                + "avg(r.vibracao), max(r.vibracao), min(r.vibracao), avg(r.rpm), max(r.rpm) "
                                + "from RegistroSensor r where r.timestamp >= :de and r.timestamp <= :ate "
                                + "group by r.idMaquina order by r.idMaquina", Object[].class)
                .setParameter("de", de).setParameter("ate", ate).getResultList();

        Map<String, long[]> alertas = new LinkedHashMap<>(); // máquina -> {temperatura, vibração}
        for (Object[] a : em.createQuery("select a.idMaquina, a.tipo, count(a) from Alerta a where a.timestamp >= :de and a.timestamp <= :ate "
                        + "group by a.idMaquina, a.tipo", Object[].class)
                .setParameter("de", de).setParameter("ate", ate).getResultList()) {
            long[] contagem = alertas.computeIfAbsent((String) a[0], k -> new long[2]);
            contagem[a[1].toString().equals("TEMPERATURA") ? 0 : 1] = ((Number) a[2]).longValue();
        }

        List<ResumoDaMaquina> maquinas = linhas.stream().map(l -> {
            long[] contagem = alertas.getOrDefault((String) l[0], new long[2]);
            return new ResumoDaMaquina((String) l[0], ((Number) l[1]).longValue(),
                    numero(l[2]), numero(l[3]), numero(l[4]), numero(l[5]), numero(l[6]), numero(l[7]), numero(l[8]), numero(l[9]),
                    contagem[0], contagem[1]);
        }).toList();
        return new Resumo(periodo.texto(), de, ate, maquinas);
    }

    private static double numero(Object valor) {
        return valor == null ? 0.0 : Math.round(((Number) valor).doubleValue() * 100.0) / 100.0;
    }
}
