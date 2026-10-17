package com.industria.iot_core.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Documentação da API: JSON em /v3/api-docs e tela interativa em /swagger-ui.html.
 * Para testar as rotas protegidas, faça o login em POST /api/auth/login, copie o token e use o botão "Authorize".
 */
@Configuration
public class OpenApiConfig {

    static final String ESQUEMA_JWT = "token-jwt";

    @Bean
    public OpenAPI documentacao() {
        return new OpenAPI()
                .info(new Info()
                        .title("Plataforma IoT Industrial: API")
                        .version("1.0")
                        .description("""
                                Recebe as leituras dos sensores, guarda o histórico, registra alertas e gerencia usuários.

                                Perfis: ADMIN gerencia usuários; OPERADOR reconhece alertas e troca limites; LEITURA só consulta. \
                                Sem token a resposta é 401; com token mas sem permissão, 403."""))
                .components(new Components().addSecuritySchemes(ESQUEMA_JWT, new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP)
                        .scheme("bearer")
                        .bearerFormat("JWT")
                        .description("Token devolvido por POST /api/auth/login")))
                .addSecurityItem(new SecurityRequirement().addList(ESQUEMA_JWT));
    }
}
