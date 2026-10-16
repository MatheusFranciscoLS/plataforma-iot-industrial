import os
import random
import time

import requests

# Configuração por variáveis de ambiente (os padrões servem para rodar tudo na própria máquina)
URL_SERVIDOR = os.getenv("JAVA_URL", "http://localhost:8080/api/sensores")
CHAVE_API = os.getenv("SENSOR_API_KEY", "")  # só é preciso se a API Java exigir a chave
INTERVALO_S = float(os.getenv("INTERVALO_S", "2"))
TIMEOUT_S = 5  # sem isso, uma API travada deixaria o simulador esperando para sempre

MAQUINAS = ["MAQ-01", "MAQ-02", "MAQ-03"]


def gerar_dados(id_maquina):
    # As chaves do JSON são iguais aos atributos da classe Java (camelCase)
    return {
        "idMaquina": id_maquina,
        "timestamp": int(time.time()),
        "temperaturaMotor": round(random.uniform(60.0, 105.0), 2),
        "vibracao": round(random.uniform(0.5, 6.0), 2),
        "rpm": random.randint(1200, 3500),
    }


def montar_cabecalhos(chave):
    return {"X-API-Key": chave} if chave else {}


def enviar(sessao, dados, url=URL_SERVIDOR, chave=CHAVE_API):
    """Envia uma leitura para a API Java e devolve a resposta HTTP."""
    return sessao.post(url, json=dados, headers=montar_cabecalhos(chave), timeout=TIMEOUT_S)


def main():
    print(f"Iniciando simulador. Enviando para {URL_SERVIDOR} a cada {INTERVALO_S} s.")

    with requests.Session() as sessao:
        while True:
            for maq in MAQUINAS:
                try:
                    resposta = enviar(sessao, gerar_dados(maq))
                    print(f"[{maq}] Enviado para o Java - Status: {resposta.status_code}")
                except requests.RequestException as erro:
                    print(f"[{maq}] Falha ao enviar. A API Java está no ar em {URL_SERVIDOR}? Erro: {erro}")
            time.sleep(INTERVALO_S)


if __name__ == "__main__":
    main()
