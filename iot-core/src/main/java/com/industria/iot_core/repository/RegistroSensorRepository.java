package com.industria.iot_core.repository; // Ajuste se for iot_core

import com.industria.iot_core.model.RegistroSensor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RegistroSensorRepository extends JpaRepository<RegistroSensor, Long> {
    
    // O Spring Boot é tão inteligente que ele entende o nome do método e cria o SQL sozinho!
    // Isso vai buscar os últimos registros ordenados pelo tempo.
    List<RegistroSensor> findTop60ByOrderByTimestampDesc();
}