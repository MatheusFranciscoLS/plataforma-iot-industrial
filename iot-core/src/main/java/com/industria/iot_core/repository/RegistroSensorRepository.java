package com.industria.iot_core.repository;

import com.industria.iot_core.model.RegistroSensor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RegistroSensorRepository extends JpaRepository<RegistroSensor, Long> {

    // O Spring Data entende o nome do método e cria o SQL sozinho.
    // Os 60 registros mais recentes, de todas as máquinas.
    List<RegistroSensor> findTop60ByOrderByTimestampDesc();

    // Os mais recentes, com o tamanho escolhido por quem chama (Pageable).
    List<RegistroSensor> findAllByOrderByTimestampDesc(Pageable pagina);

    // Os mais recentes de uma máquina só.
    List<RegistroSensor> findByIdMaquinaOrderByTimestampDesc(String idMaquina, Pageable pagina);
}
