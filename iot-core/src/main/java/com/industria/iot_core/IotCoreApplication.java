package com.industria.iot_core;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling // usado pelo modo demonstração e pela limpeza de leituras antigas
public class IotCoreApplication {

	public static void main(String[] args) {
		SpringApplication.run(IotCoreApplication.class, args);
	}

}
