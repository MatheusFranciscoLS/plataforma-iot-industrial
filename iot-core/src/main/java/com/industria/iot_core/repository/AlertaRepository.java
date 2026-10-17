package com.industria.iot_core.repository;

import com.industria.iot_core.model.Alerta;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AlertaRepository extends JpaRepository<Alerta, Long> {

    // Os alertas mais recentes, do mais novo para o mais antigo.
    List<Alerta> findAllByOrderByTimestampDescIdDesc(Pageable pagina);

    // Apaga os alertas anteriores ao timestamp (em segundos) e devolve quantos foram apagados.
    long deleteByTimestampLessThan(Long timestamp);
}
