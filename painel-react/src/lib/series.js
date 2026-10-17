import { MAQUINAS } from './limites';

// Cada máquina tem uma cor cinza-azulada e um tipo de traço, para dar para separar as linhas sem depender só da cor.
export const SERIES = [
  { chave: MAQUINAS[0], cor: 'rgb(var(--serie-1))', traco: undefined },
  { chave: MAQUINAS[1], cor: 'rgb(var(--serie-2))', traco: '8 4' },
  { chave: MAQUINAS[2], cor: 'rgb(var(--serie-3))', traco: '2 3' },
];
