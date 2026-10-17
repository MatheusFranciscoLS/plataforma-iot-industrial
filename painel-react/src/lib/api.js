// Endereços da API Java e do gateway. Sem as variáveis VITE_API_JAVA e VITE_API_NODE, usa os da própria máquina.
export const API_JAVA = import.meta.env.VITE_API_JAVA ?? 'http://localhost:8080';
export const API_NODE = import.meta.env.VITE_API_NODE ?? 'http://localhost:3000';

export class SessaoInvalidaError extends Error {}

/** Erro da API com um código ('rede', 'credenciais' ou 'servidor'); a tela escolhe o texto no idioma certo. */
export class ErroApi extends Error {
  constructor(codigo) {
    super(codigo);
    this.codigo = codigo;
  }
}

/** Faz o login. Devolve o token, ou lança um ErroApi com o código do problema. */
export async function fazerLogin(usuario, senha) {
  let resposta;
  try {
    resposta = await fetch(`${API_JAVA}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, senha }),
    });
  } catch {
    throw new ErroApi('rede');
  }

  if (resposta.status === 401) throw new ErroApi('credenciais');
  if (!resposta.ok) throw new ErroApi('servidor');

  const { token } = await resposta.json();
  return token;
}

/** Alertas guardados no servidor, do mais novo para o mais antigo. Lança SessaoInvalidaError se o token não vale mais. */
export async function buscarAlertas(token, limite = 20) {
  const resposta = await fetch(`${API_JAVA}/api/alertas?limite=${limite}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (resposta.status === 401 || resposta.status === 403) throw new SessaoInvalidaError();
  if (!resposta.ok) throw new Error(`Falha ao carregar os alertas (${resposta.status})`);

  return resposta.json();
}

/** Busca as últimas leituras. Lança SessaoInvalidaError se o token não vale mais. */
export async function buscarHistorico(token, limite, maquina) {
  const parametros = new URLSearchParams();
  if (limite) parametros.set('limite', limite);
  if (maquina) parametros.set('maquina', maquina);
  const consulta = parametros.size > 0 ? `?${parametros}` : '';
  const resposta = await fetch(`${API_JAVA}/api/sensores${consulta}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (resposta.status === 401 || resposta.status === 403) throw new SessaoInvalidaError();
  if (!resposta.ok) throw new Error(`Falha ao carregar o histórico (${resposta.status})`);

  return resposta.json();
}
