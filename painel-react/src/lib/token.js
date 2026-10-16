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
