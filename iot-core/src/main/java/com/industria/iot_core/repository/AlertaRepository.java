package com.industria.iot_core.repository;

import com.industria.iot_core.model.Alerta;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AlertaRepository extends JpaRepository<Alerta, Long>, JpaSpecificationExecutor<Alerta> {

    // Os alertas mais recentes, do mais novo para o mais antigo.
    List<Alerta> findAllByOrderByTimestampDescIdDesc(Pageable pagina);

    // Quantos alertas ninguém reconheceu ainda.
    long countByReconhecidoPorIsNull();

    // Apaga os alertas anteriores ao timestamp (em segundos) e devolve quantos foram apagados.
    long deleteByTimestampLessThan(Long timestamp);
}
