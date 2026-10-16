import { cn } from '@/lib/utils';

/** Barra horizontal com um traço vermelho no valor-limite. Fica vermelha quando o valor passa do limite. */
export default function Medidor({ valor, min, max, limite, rotulo }) {
  const pct = (v) => Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100));
  const acima = valor > limite;

  return (
    <div
      role="meter"
      aria-label={rotulo}
      aria-valuenow={valor}
      aria-valuemin={min}
      aria-valuemax={max}
      className="relative mt-2 h-2 rounded-sm bg-linha/70"
    >
      <div
        className={cn('absolute inset-y-0 left-0 rounded-sm transition-[width] duration-500', acima ? 'bg-alarme' : 'bg-tinta')}
        style={{ width: `${pct(valor)}%` }}
      />
      <div aria-hidden="true" className="absolute -inset-y-1 w-0.5 bg-alarme" style={{ left: `${pct(limite)}%` }} />
    </div>
  );
}
