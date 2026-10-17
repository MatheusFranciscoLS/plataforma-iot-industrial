package com.industria.iot_core.repository;

import com.industria.iot_core.model.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UsuarioRepository extends JpaRepository<Usuario, Long> {

    Optional<Usuario> findByNome(String nome);

    List<Usuario> findAllByOrderByNomeAsc();

    long countByPerfil(Usuario.Perfil perfil);
}
