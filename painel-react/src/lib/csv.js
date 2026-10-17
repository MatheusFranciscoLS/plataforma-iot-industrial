/**
 * Transforma as leituras em um CSV (separador vírgula, ponto decimal, uma linha por leitura, da mais antiga
 * para a mais nova). O momento vai em ISO 8601 (UTC), que o Excel e o Google Planilhas entendem.
 */
export function gerarCsv(leituras) {
  const linhas = [...leituras]
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((l) =>
      [new Date(l.timestamp * 1000).toISOString(), l.idMaquina, l.temperaturaMotor, l.vibracao, l.rpm].join(','),
    );
  return ['momento,maquina,temperatura_c,vibracao_mm_s,rpm', ...linhas].join('\n') + '\n';
}

/** Baixa um texto como arquivo, pelo navegador. */
export function baixarArquivo(nome, conteudo, tipo = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
