// A pool of Portuguese first names for poker bots, so a table reads like real
// opponents ("Rui", "Inês") instead of "Bot 1". Picks avoid names already at the
// table; if the pool is exhausted a numeric suffix keeps them unique.

const POOL = [
  'Rui', 'Tiago', 'Bruno', 'André', 'Miguel', 'Pedro', 'João', 'Nuno', 'Hugo', 'Diogo',
  'Ricardo', 'Vasco', 'Gonçalo', 'Tomás', 'Duarte', 'Afonso', 'Rafael', 'Filipe', 'Sérgio', 'Luís',
  'Inês', 'Beatriz', 'Mariana', 'Sofia', 'Carolina', 'Joana', 'Ana', 'Catarina', 'Rita', 'Marta',
  'Helena', 'Patrícia', 'Cláudia', 'Teresa', 'Leonor', 'Matilde',
];

const randInt = (n: number) => crypto.getRandomValues(new Uint32Array(1))[0]! % n;

/** A random name not already in `taken`. */
export function randomBotName(taken: string[]): string {
  const free = POOL.filter((n) => !taken.includes(n));
  if (free.length > 0) return free[randInt(free.length)]!;
  // Pool exhausted (huge table) — fall back to a suffixed name.
  let i = 2;
  while (taken.includes(`${POOL[0]} ${i}`)) i++;
  return `${POOL[randInt(POOL.length)]} ${i}`;
}
