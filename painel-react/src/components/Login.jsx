import { useEffect, useState } from 'react';
import { Languages, Loader2, LogIn, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useIdioma } from '@/i18n/idioma-contexto';
import { aquecerServidores, fazerLogin } from '@/lib/api';
import { ACESSO_DEMO } from '@/lib/demo';
import AvisoServidorAcordando from './AvisoServidorAcordando';
import FluxoDoSistema from './FluxoDoSistema';

export default function Login({ aviso, onEntrar }) {
  const { t, alternarIdioma } = useIdioma();
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Começa a acordar os servidores já na abertura da página, não só no clique de entrar.
  useEffect(() => {
    aquecerServidores();
  }, []);

  async function entrar(nome, chave) {
    setErro('');
    setEnviando(true);
    try {
      onEntrar(await fazerLogin(nome, chave));
    } catch (falha) {
      setErro(t(`erro.${falha.codigo ?? 'servidor'}`));
      setEnviando(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-10 sm:px-6 lg:py-16">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={alternarIdioma} aria-label={t('idioma.mudar')}>
          <Languages aria-hidden="true" />
          {t('idioma.botao')}
        </Button>
      </div>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:gap-16">
        <div>
          <h1 className="font-condensada text-5xl font-semibold leading-none sm:text-6xl">{t('app.titulo')}</h1>
          <p className="mt-4 max-w-md text-lg text-suave">{t('login.subtitulo')}</p>
          <p className="mt-3 max-w-md text-suave">{t('login.portfolio')}</p>
        </div>

        <div className="rounded border border-linha bg-painel p-6">
          <h2 id="titulo-login" className="font-condensada text-2xl font-semibold">
            {t('login.entrar')}
          </h2>

          {aviso && (
            <p role="status" className="mt-3 rounded border border-linha bg-fundo px-3 py-2 text-sm">
              {aviso}
            </p>
          )}

          <Button type="button" size="lg" className="mt-4 w-full" disabled={enviando} onClick={() => entrar(ACESSO_DEMO.usuario, ACESSO_DEMO.senha)}>
            {enviando ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Play aria-hidden="true" />}
            {enviando ? t('login.entrando') : t('login.demo')}
          </Button>
          <p className="mt-2 text-sm text-suave">{t('login.demoDica')}</p>
          {enviando && <AvisoServidorAcordando />}

          <form
            aria-labelledby="titulo-login"
            onSubmit={(e) => {
              e.preventDefault();
              entrar(usuario, senha);
            }}
            className="mt-6 border-t border-linha pt-5"
          >
            <p className="text-sm font-medium">{t('login.ou')}</p>

            <div className="mt-3 space-y-2">
              <Label htmlFor="usuario">{t('login.usuario')}</Label>
              <Input id="usuario" autoComplete="username" value={usuario} onChange={(e) => setUsuario(e.target.value)} required />
            </div>

            <div className="mt-4 space-y-2">
              <Label htmlFor="senha">{t('login.senha')}</Label>
              <Input id="senha" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
            </div>

            {erro && (
              <p role="alert" className="mt-4 text-sm font-medium text-alarme">
                {erro}
              </p>
            )}

            <Button type="submit" variant="outline" className="mt-5 w-full" disabled={enviando}>
              <LogIn aria-hidden="true" />
              {t('login.entrar')}
            </Button>
          </form>
        </div>
      </div>

      <FluxoDoSistema />
    </main>
  );
}
