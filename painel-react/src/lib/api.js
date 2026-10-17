// Endereços da API Java e do gateway. Sem as variáveis VITE_API_JAVA e VITE_API_NODE, usa os da própria máquina.
export const API_JAVA = import.meta.env.VITE_API_JAVA ?? 'http://localhost:8080';
export const API_NODE = import.meta.env.VITE_API_NODE ?? 'http://localhost:3000';

export class SessaoInvalidaError extends Error {}

/** Faz o login. Devolve o token, ou lança um Error com uma mensagem pronta para mostrar na tela. */
export async function fazerLogin(usuario, senha) {
  let resposta;
  try {
    resposta = await fetch(`${API_JAVA}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, senha }),
    });
  } catch {
    throw new Error('Não foi possível falar com o servidor. Confira a conexão e tente de novo.');
  }

  if (resposta.status === 401) throw new Error('Usuário ou senha incorretos.');
  if (!resposta.ok) throw new Error('O servidor não conseguiu fazer o login. Tente de novo em instantes.');

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
export async function buscarHistorico(token, limite) {
  const consulta = limite ? `?limite=${limite}` : '';
  const resposta = await fetch(`${API_JAVA}/api/sensores${consulta}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (resposta.status === 401 || resposta.status === 403) throw new SessaoInvalidaError();
  if (!resposta.ok) throw new Error(`Falha ao carregar o histórico (${resposta.status})`);

  return resposta.json();
}
