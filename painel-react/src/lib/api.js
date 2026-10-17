// Endereços da API Java e do gateway. Sem as variáveis VITE_API_JAVA e VITE_API_NODE, usa os da própria máquina.
export const API_JAVA = import.meta.env.VITE_API_JAVA ?? 'http://localhost:8080';
export const API_NODE = import.meta.env.VITE_API_NODE ?? 'http://localhost:3000';

export class SessaoInvalidaError extends Error {}

/**
 * Acorda a API e o gateway, que na hospedagem gratuita dormem sem visitas e levam alguns minutos para subir.
 * É chamado quando a tela de login abre: enquanto a pessoa lê a página, os servidores já estão acordando.
 * Não espera resposta e ignora qualquer erro (sem rede, servidor fora do ar...).
 */
export function aquecerServidores() {
  for (const url of [`${API_JAVA}/actuator/health`, `${API_NODE}/saude`]) {
    try {
      fetch(url, { mode: 'no-cors', cache: 'no-store' }).catch(() => {});
    } catch {
      // sem fetch ou sem rede: o login normal continua funcionando
    }
  }
}

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

/** Chama a API com o token. Lança SessaoInvalidaError se o token não vale mais e Error para outras falhas. */
async function chamar(token, caminho, opcoes = {}) {
  const { corpo, ...resto } = opcoes;
  const resposta = await fetch(`${API_JAVA}${caminho}`, {
    ...resto,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(corpo !== undefined && { 'Content-Type': 'application/json' }),
    },
    ...(corpo !== undefined && { body: JSON.stringify(corpo) }),
  });

  if (resposta.status === 401 || resposta.status === 403) throw new SessaoInvalidaError();
  if (!resposta.ok) throw Object.assign(new Error(`Falha na chamada ${caminho} (${resposta.status})`), { status: resposta.status });

  return resposta;
}

/**
 * Alertas guardados no servidor, do mais novo para o mais antigo.
 * `filtros` (todos opcionais): { maquina, tipo: 'TEMPERATURA' | 'VIBRACAO', reconhecido: true | false }.
 */
export async function buscarAlertas(token, limite = 20, filtros = {}) {
  const parametros = new URLSearchParams({ limite });
  if (filtros.maquina) parametros.set('maquina', filtros.maquina);
  if (filtros.tipo) parametros.set('tipo', filtros.tipo);
  if (typeof filtros.reconhecido === 'boolean') parametros.set('reconhecido', filtros.reconhecido);
  return (await chamar(token, `/api/alertas?${parametros}`)).json();
}

/** Quantos alertas ninguém reconheceu ainda. */
export async function contarAlertasPendentes(token) {
  const { quantidade } = await (await chamar(token, '/api/alertas/pendentes')).json();
  return quantidade;
}

/** Marca o alerta como visto pelo usuário logado e devolve o alerta atualizado. */
export async function reconhecerAlerta(token, id) {
  return (await chamar(token, `/api/alertas/${id}/reconhecer`, { method: 'POST' })).json();
}

/** Os limites padrão e os definidos por máquina: { padrao: { TEMPERATURA, VIBRACAO }, maquinas: [...] }. */
export async function buscarLimites(token) {
  return (await chamar(token, '/api/limites')).json();
}

/** Define o limite de uma máquina. `tipo` é 'TEMPERATURA' ou 'VIBRACAO'. */
export async function definirLimite(token, maquina, tipo, limite) {
  return (await chamar(token, `/api/limites/${encodeURIComponent(maquina)}/${tipo}`, { method: 'PUT', corpo: { limite } })).json();
}

/** Volta uma máquina ao limite padrão. */
export async function removerLimite(token, maquina, tipo) {
  try {
    await chamar(token, `/api/limites/${encodeURIComponent(maquina)}/${tipo}`, { method: 'DELETE' });
  } catch (falha) {
    if (falha.status !== 404) throw falha; // 404: já estava no padrão
  }
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
