import { useState } from 'react';
import { Loader2, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fazerLogin } from '@/lib/api';

export default function Login({ aviso, onEntrar }) {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      onEntrar(await fazerLogin(usuario, senha));
    } catch (falha) {
      setErro(falha.message);
      setEnviando(false);
    }
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-5xl content-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:gap-16">
      <div>
        <h1 className="font-condensada text-5xl font-semibold leading-none sm:text-6xl">Monitoramento da fábrica</h1>
        <p className="mt-4 max-w-md text-lg text-suave">
          Acompanhe a temperatura, a rotação e a vibração das máquinas em tempo real e veja na hora qual delas passou do limite.
        </p>
      </div>

      <form onSubmit={enviar} className="rounded border border-linha bg-painel p-6" aria-labelledby="titulo-login">
        <h2 id="titulo-login" className="font-condensada text-2xl font-semibold">
          Entrar
        </h2>

        {aviso && (
          <p role="status" className="mt-3 rounded border border-linha bg-fundo px-3 py-2 text-sm">
            {aviso}
          </p>
        )}

        <div className="mt-5 space-y-2">
          <Label htmlFor="usuario">Usuário</Label>
          <Input id="usuario" autoComplete="username" value={usuario} onChange={(e) => setUsuario(e.target.value)} required />
        </div>

        <div className="mt-4 space-y-2">
          <Label htmlFor="senha">Senha</Label>
          <Input id="senha" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
        </div>

        {erro && (
          <p role="alert" className="mt-4 text-sm font-medium text-alarme">
            {erro}
          </p>
        )}

        <Button type="submit" className="mt-6 w-full" disabled={enviando}>
          {enviando ? <Loader2 aria-hidden="true" className="animate-spin" /> : <LogIn aria-hidden="true" />}
          {enviando ? 'Entrando…' : 'Entrar'}
        </Button>

        <p className="mt-4 text-sm text-suave">Acesso de demonstração: usuário admin, senha senha123.</p>
      </form>
    </main>
  );
}
