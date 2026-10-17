package com.industria.iot_core.repository;

import com.industria.iot_core.model.Alerta;
import com.industria.iot_core.model.LimiteMaquina;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface LimiteMaquinaRepository extends JpaRepository<LimiteMaquina, Long> {

    Optional<LimiteMaquina> findByIdMaquinaAndTipo(String idMaquina, Alerta.Tipo tipo);
}
