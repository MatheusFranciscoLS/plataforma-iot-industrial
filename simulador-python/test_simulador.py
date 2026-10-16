import unittest

import simulador


class FakeSessao:
    """Troca o requests.Session: guarda a chamada em vez de ir para a rede."""

    def __init__(self):
        self.chamadas = []

    def post(self, url, json=None, headers=None, timeout=None):
        self.chamadas.append({"url": url, "json": json, "headers": headers, "timeout": timeout})
        return "resposta"


class GerarDadosTest(unittest.TestCase):
    def test_tem_exatamente_os_campos_que_a_api_java_espera(self):
        dados = simulador.gerar_dados("MAQ-01")

        self.assertEqual(
            set(dados), {"idMaquina", "timestamp", "temperaturaMotor", "vibracao", "rpm"}
        )
        self.assertEqual(dados["idMaquina"], "MAQ-01")

    def test_valores_ficam_nas_faixas_do_simulador(self):
        for _ in range(500):
            dados = simulador.gerar_dados("MAQ-02")
            self.assertTrue(60.0 <= dados["temperaturaMotor"] <= 105.0)
            self.assertTrue(0.5 <= dados["vibracao"] <= 6.0)
            self.assertTrue(1200 <= dados["rpm"] <= 3500)

    def test_timestamp_e_inteiro_em_segundos(self):
        self.assertIsInstance(simulador.gerar_dados("MAQ-03")["timestamp"], int)


class EnviarTest(unittest.TestCase):
    def test_envia_json_com_timeout(self):
        sessao = FakeSessao()
        dados = {"idMaquina": "MAQ-01"}

        simulador.enviar(sessao, dados, url="http://api/teste", chave="")

        chamada = sessao.chamadas[0]
        self.assertEqual(chamada["url"], "http://api/teste")
        self.assertEqual(chamada["json"], dados)
        self.assertEqual(chamada["timeout"], simulador.TIMEOUT_S)

    def test_sem_chave_nao_manda_cabecalho_de_chave(self):
        self.assertEqual(simulador.montar_cabecalhos(""), {})

    def test_com_chave_manda_x_api_key(self):
        sessao = FakeSessao()

        simulador.enviar(sessao, {}, url="http://api/teste", chave="segredo")

        self.assertEqual(sessao.chamadas[0]["headers"], {"X-API-Key": "segredo"})


if __name__ == "__main__":
    unittest.main()
