import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { io } from "socket.io-client";

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [usuarioInput, setUsuarioInput] = useState('');
  const [senhaInput, setSenhaInput] = useState('');
  const [erroLogin, setErroLogin] = useState('');

  const [historico, setHistorico] = useState([]);
  const [statusAtual, setStatusAtual] = useState({});

  const fazerLogin = async (e) => {
    e.preventDefault();
    try {
      const resposta = await fetch(`${import.meta.env.VITE_API_JAVA}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario: usuarioInput, senha: senhaInput })
      });

      if (resposta.ok) {
        const dados = await resposta.json();
        setToken(dados.token);
        localStorage.setItem('token', dados.token);
        setErroLogin('');
      } else {
        setErroLogin('Usuário ou senha incorretos!');
      }
    } catch (error) {
      setErroLogin('Erro ao conectar com o servidor da fábrica.');
    }
  };

  const fazerLogout = () => {
    setToken(null);
    localStorage.removeItem('token');
    setHistorico([]);
    setStatusAtual({});
  };

  useEffect(() => {
    if (!token) return;

    const carregarHistorico = async () => {
      try {
        const resposta = await fetch(`${import.meta.env.VITE_API_JAVA}/api/sensores`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (resposta.status === 401 || resposta.status === 403) {
            fazerLogout();
            return;
        }

        const dadosPassados = await resposta.json();
        let historicoAgrupado = [];
        
        dadosPassados.forEach(dado => {
          let index = historicoAgrupado.findIndex(item => item.timestamp === dado.timestamp);
          if (index >= 0) {
            historicoAgrupado[index][dado.idMaquina] = dado.temperaturaMotor;
          } else {
            historicoAgrupado.push({
              timestamp: dado.timestamp,
              [dado.idMaquina]: dado.temperaturaMotor
            });
          }
        });
        
        setHistorico(historicoAgrupado);
      } catch (error) {
        console.error("Erro ao carregar o passado:", error);
      }
    };

    carregarHistorico();

    const socket = io(`${import.meta.env.VITE_API_NODE}`, {
        transports: ['websocket'],
        auth: { token: token }
    });

    socket.on('novoRegistro', (dado) => {
      setStatusAtual((estadoAnterior) => ({
        ...estadoAnterior,
        [dado.idMaquina]: dado
      }));

      setHistorico((estadoAnterior) => {
        let novosDados = [...estadoAnterior];
        let index = novosDados.findIndex(item => item.timestamp === dado.timestamp);

        if (index >= 0) {
          novosDados[index] = {
            ...novosDados[index],
            [dado.idMaquina]: dado.temperaturaMotor
          };
        } else {
          novosDados.push({
            timestamp: dado.timestamp,
            [dado.idMaquina]: dado.temperaturaMotor
          });
        }
        return novosDados.length > 20 ? novosDados.slice(1) : novosDados;
      });
    });

    return () => socket.disconnect();
  }, [token]);

  const formatarHora = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('pt-BR');
  };

  // --- TELA DE LOGIN ---
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white font-sans p-4">
        <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-sm border border-slate-700">
          <h2 className="text-2xl font-bold text-center mb-6 text-cyan-400 tracking-wide">Acesso Restrito</h2>
          
          <form onSubmit={fazerLogin} className="flex flex-col gap-4">
            <input 
              type="text" 
              placeholder="Usuário" 
              value={usuarioInput}
              onChange={(e) => setUsuarioInput(e.target.value)}
              className="p-3 rounded-lg bg-slate-900 border border-slate-700 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors"
              required
            />
            <input 
              type="password" 
              placeholder="Senha" 
              value={senhaInput}
              onChange={(e) => setSenhaInput(e.target.value)}
              className="p-3 rounded-lg bg-slate-900 border border-slate-700 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors"
              required
            />
            <button type="submit" className="mt-2 p-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold transition-colors">
              ENTRAR
            </button>
            {erroLogin && <p className="text-red-400 text-sm text-center font-medium mt-2">{erroLogin}</p>}
          </form>
          <p className="text-center text-xs mt-6 text-slate-500">*Dica: admin / senha123</p>
        </div>
      </div>
    );
  }

  // --- TELA DO DASHBOARD ---
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Cabeçalho */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
              Painel de Monitoramento IoT
            </h1>
            <button 
              onClick={fazerLogout} 
              className="px-6 py-2 rounded-lg bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500 font-semibold border border-red-500/50 transition-all"
            >
              Sair do Sistema
            </button>
        </div>

        {/* Cards das Máquinas (Grid Responsivo) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {['MAQ-01', 'MAQ-02', 'MAQ-03'].map((maq) => {
            const dados = statusAtual[maq];
            const emPerigo = dados && (dados.temperaturaMotor > 95 || dados.vibracao > 5.0);
            
            return (
              <div 
                key={maq} 
                className={`p-6 rounded-2xl transition-all duration-300 border ${
                  emPerigo 
                    ? 'bg-red-950/40 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]' 
                    : 'bg-slate-800 border-slate-700 shadow-xl'
                }`}
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className={`text-xl font-bold ${emPerigo ? 'text-red-400' : 'text-cyan-400'}`}>
                    {maq}
                  </h3>
                  {emPerigo && (
                    <span className="flex items-center gap-2 text-xs font-bold bg-red-500/20 text-red-400 px-3 py-1 rounded-full animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-red-500"></span>
                      CRÍTICO
                    </span>
                  )}
                </div>
                
                {dados ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-sm">Temperatura</span>
                      <span className={`font-mono font-bold ${dados.temperaturaMotor > 95 ? 'text-red-400' : 'text-white'}`}>
                        {dados.temperaturaMotor}°C
                      </span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-1.5 mb-4">
                      <div className={`h-1.5 rounded-full ${dados.temperaturaMotor > 95 ? 'bg-red-500' : 'bg-cyan-500'}`} style={{ width: `${Math.min(dados.temperaturaMotor, 100)}%` }}></div>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-sm">RPM</span>
                      <span className="font-mono font-bold text-white">{dados.rpm}</span>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-slate-700/50">
                      <span className="text-slate-400 text-sm">Vibração</span>
                      <span className={`font-mono font-bold ${dados.vibracao > 5.0 ? 'text-red-400' : 'text-white'}`}>
                        {dados.vibracao} mm/s
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 animate-pulse pt-2">
                    <div className="h-4 bg-slate-700 rounded w-3/4"></div>
                    <div className="h-4 bg-slate-700 rounded w-1/2"></div>
                    <div className="h-4 bg-slate-700 rounded w-5/6"></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Gráfico */}
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
          <h3 className="text-lg font-bold mb-6 text-slate-200">Histórico de Temperatura da Frota</h3>
          <div className="w-full h-[400px]">
            <ResponsiveContainer>
              <LineChart data={historico} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="timestamp" tickFormatter={formatarHora} stroke="#64748b" tick={{ fill: '#64748b' }} tickMargin={10} />
                <YAxis domain={['dataMin - 5', 'dataMax + 5']} stroke="#64748b" tick={{ fill: '#64748b' }} />
                <Tooltip 
                  labelFormatter={formatarHora} 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', color: '#f8fafc' }} 
                  itemStyle={{ color: '#e2e8f0' }}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Line type="monotone" dataKey="MAQ-01" stroke="#22d3ee" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#22d3ee' }} isAnimationActive={false} />
                <Line type="monotone" dataKey="MAQ-02" stroke="#f43f5e" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#f43f5e' }} isAnimationActive={false} />
                <Line type="monotone" dataKey="MAQ-03" stroke="#10b981" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#10b981' }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;