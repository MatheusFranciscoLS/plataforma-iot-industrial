import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Junta classes do Tailwind sem deixar duas regras brigarem entre si (usado pelos componentes shadcn/ui).
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
