import time
import random
import requests
import os

NODE_HOST = os.getenv("NODE_HOST", "localhost")
URL_SERVIDOR = "http://iot-core:8080/api/sensores"


def gerar_dados(id_maquina):
    # ATENÇÃO: As chaves do JSON agora estão idênticas aos atributos da classe Java (camelCase)
    return {
        "idMaquina": id_maquina,
        "timestamp": int(time.time()),
        "temperaturaMotor": round(random.uniform(60.0, 105.0), 2),
        "vibracao": round(random.uniform(0.5, 6.0), 2),
        "rpm": random.randint(1200, 3500),
    }


def main():
    print("Iniciando simulador...")
    maquinas = ["MAQ-01", "MAQ-02", "MAQ-03"]

    while True:
        for maq in maquinas:
            dados = gerar_dados(maq)
            try:
                # CORREÇÃO DA URL AQUI
                resposta = requests.post(URL_SERVIDOR, json=dados)
                print(f"[{maq}] Enviado para o JAVA - Status: {resposta.status_code}")
            except Exception as e:
                # Aproveitei para mandar o Python imprimir o erro real se der problema
                print(
                    f"[{maq}] Falha na conexão. O Java está rodando na 8080? Erro interno: {e}"
                )
        time.sleep(2)


if __name__ == "__main__":
    main()
