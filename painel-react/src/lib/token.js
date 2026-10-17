const CHAVE = 'token';

/** Lê o campo `exp` (em segundos) do token JWT, sem validar a assinatura. */
export function lerExpiracao(token) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const { exp } = JSON.parse(atob(payload));
    return typeof exp === 'number' ? exp : null;
  } catch {
    return null;
  }
}

/** Lê um campo de texto do token JWT, sem validar a assinatura (a API é quem confere de verdade). */
function lerCampo(token, campo) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const valor = JSON.parse(atob(payload))[campo];
    return typeof valor === 'string' ? valor : null;
  } catch {
    return null;
  }
}

/** Nome do usuário do token, ou null se o token não puder ser lido. */
export function lerUsuario(token) {
  return lerCampo(token, 'sub');
}

/**
 * Perfil do token: 'ADMIN', 'OPERADOR' ou 'LEITURA'. Sem perfil (token antigo ou ilegível) vale 'LEITURA',
 * como na API. Serve só para mostrar ou esconder botões; quem barra a ação de verdade é a API.
 */
export function lerPerfil(token) {
  const perfil = lerCampo(token, 'perfil');
  return perfil === 'ADMIN' || perfil === 'OPERADOR' ? perfil : 'LEITURA';
}

export function tokenExpirado(token, agoraMs = Date.now()) {
  const exp = lerExpiracao(token);
  return exp !== null && exp * 1000 <= agoraMs;
}

export function lerTokenSalvo() {
  try {
    const token = localStorage.getItem(CHAVE);
    if (token && tokenExpirado(token)) {
      localStorage.removeItem(CHAVE); // não deixa um token vencido guardado
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

export function salvarToken(token) {
  try {
    if (token) localStorage.setItem(CHAVE, token);
    else localStorage.removeItem(CHAVE);
  } catch {
    // Sem armazenamento (modo privado, por exemplo): o login vale só até fechar a aba.
  }
}
