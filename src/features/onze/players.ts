/**
 * Onze de Ouro — curated pool of Portuguese players for the draft game.
 * Lines: GK / DF / MF / FW. Ratings are for-fun (0–99). `club` + `era` drive the
 * chemistry/era bonuses. `legend` flags members of the boss XI. Portugal-only by
 * design (the "onze" twist). Need ≥3 GK, ≥12 DF, ≥12 MF, ≥9 FW for the packs.
 */
export type Line = 'GK' | 'DF' | 'MF' | 'FW';
export type Era = 'classico' | 'ouro' | 'euro2016' | 'atual';
export type Club = 'Benfica' | 'Porto' | 'Sporting' | 'Outro';

export interface Player {
  id: string;
  name: string;
  line: Line;
  rating: number;
  club: Club;
  era: Era;
}

export const ERA_LABEL: Record<Era, string> = {
  classico: 'Clássicos',
  ouro: 'Geração de Ouro',
  euro2016: 'Euro 2016',
  atual: 'Atual',
};

export const PLAYERS: Player[] = [
  // GK
  { id: 'vbaia', name: 'Vítor Baía', line: 'GK', rating: 87, club: 'Porto', era: 'ouro' },
  { id: 'ricardo', name: 'Ricardo', line: 'GK', rating: 84, club: 'Sporting', era: 'ouro' },
  { id: 'rpatricio', name: 'Rui Patrício', line: 'GK', rating: 86, club: 'Sporting', era: 'euro2016' },
  { id: 'dcosta', name: 'Diogo Costa', line: 'GK', rating: 85, club: 'Porto', era: 'atual' },
  { id: 'quim', name: 'Quim', line: 'GK', rating: 79, club: 'Benfica', era: 'ouro' },
  { id: 'beto', name: 'Beto', line: 'GK', rating: 77, club: 'Porto', era: 'euro2016' },

  // DF
  { id: 'pepe', name: 'Pepe', line: 'DF', rating: 88, club: 'Porto', era: 'euro2016' },
  { id: 'rcarvalho', name: 'Ricardo Carvalho', line: 'DF', rating: 88, club: 'Porto', era: 'ouro' },
  { id: 'fcouto', name: 'Fernando Couto', line: 'DF', rating: 86, club: 'Porto', era: 'ouro' },
  { id: 'jcosta', name: 'Jorge Costa', line: 'DF', rating: 83, club: 'Porto', era: 'ouro' },
  { id: 'rdias', name: 'Rúben Dias', line: 'DF', rating: 89, club: 'Benfica', era: 'atual' },
  { id: 'nmendes', name: 'Nuno Mendes', line: 'DF', rating: 85, club: 'Sporting', era: 'atual' },
  { id: 'cancelo', name: 'João Cancelo', line: 'DF', rating: 86, club: 'Benfica', era: 'atual' },
  { id: 'guerreiro', name: 'Raphaël Guerreiro', line: 'DF', rating: 83, club: 'Outro', era: 'euro2016' },
  { id: 'balves', name: 'Bruno Alves', line: 'DF', rating: 80, club: 'Porto', era: 'euro2016' },
  { id: 'bosingwa', name: 'Bosingwa', line: 'DF', rating: 80, club: 'Porto', era: 'ouro' },
  { id: 'pferreira', name: 'Paulo Ferreira', line: 'DF', rating: 79, club: 'Porto', era: 'ouro' },
  { id: 'cedric', name: 'Cédric Soares', line: 'DF', rating: 78, club: 'Sporting', era: 'euro2016' },
  { id: 'axavier', name: 'Abel Xavier', line: 'DF', rating: 76, club: 'Benfica', era: 'ouro' },
  { id: 'jfonte', name: 'José Fonte', line: 'DF', rating: 80, club: 'Outro', era: 'euro2016' },
  { id: 'rolando', name: 'Rolando', line: 'DF', rating: 77, club: 'Porto', era: 'euro2016' },
  { id: 'semedo', name: 'Nélson Semedo', line: 'DF', rating: 80, club: 'Benfica', era: 'atual' },

  // MF
  { id: 'figo', name: 'Luís Figo', line: 'MF', rating: 93, club: 'Sporting', era: 'ouro' },
  { id: 'ruicosta', name: 'Rui Costa', line: 'MF', rating: 89, club: 'Benfica', era: 'ouro' },
  { id: 'deco', name: 'Deco', line: 'MF', rating: 88, club: 'Porto', era: 'ouro' },
  { id: 'maniche', name: 'Maniche', line: 'MF', rating: 82, club: 'Porto', era: 'ouro' },
  { id: 'costinha', name: 'Costinha', line: 'MF', rating: 80, club: 'Porto', era: 'ouro' },
  { id: 'tiago', name: 'Tiago Mendes', line: 'MF', rating: 80, club: 'Benfica', era: 'ouro' },
  { id: 'moutinho', name: 'João Moutinho', line: 'MF', rating: 85, club: 'Porto', era: 'euro2016' },
  { id: 'bsilva', name: 'Bernardo Silva', line: 'MF', rating: 89, club: 'Benfica', era: 'atual' },
  { id: 'bfernandes', name: 'Bruno Fernandes', line: 'MF', rating: 88, club: 'Sporting', era: 'atual' },
  { id: 'wcarvalho', name: 'William Carvalho', line: 'MF', rating: 81, club: 'Sporting', era: 'euro2016' },
  { id: 'rsanches', name: 'Renato Sanches', line: 'MF', rating: 80, club: 'Benfica', era: 'euro2016' },
  { id: 'pizzi', name: 'Pizzi', line: 'MF', rating: 79, club: 'Benfica', era: 'atual' },
  { id: 'jmario', name: 'João Mário', line: 'MF', rating: 79, club: 'Sporting', era: 'euro2016' },
  { id: 'psousa', name: 'Paulo Sousa', line: 'MF', rating: 81, club: 'Benfica', era: 'ouro' },
  { id: 'rneves', name: 'Rúben Neves', line: 'MF', rating: 82, club: 'Porto', era: 'atual' },
  { id: 'vitinha', name: 'Vitinha', line: 'MF', rating: 84, club: 'Porto', era: 'atual' },

  // FW
  { id: 'eusebio', name: 'Eusébio', line: 'FW', rating: 95, club: 'Benfica', era: 'classico' },
  { id: 'ronaldo', name: 'Cristiano Ronaldo', line: 'FW', rating: 97, club: 'Sporting', era: 'atual' },
  { id: 'pauleta', name: 'Pauleta', line: 'FW', rating: 84, club: 'Outro', era: 'ouro' },
  { id: 'ngomes', name: 'Nuno Gomes', line: 'FW', rating: 82, club: 'Benfica', era: 'ouro' },
  { id: 'simao', name: 'Simão Sabrosa', line: 'FW', rating: 82, club: 'Benfica', era: 'ouro' },
  { id: 'quaresma', name: 'Ricardo Quaresma', line: 'FW', rating: 81, club: 'Porto', era: 'euro2016' },
  { id: 'nani', name: 'Nani', line: 'FW', rating: 82, club: 'Sporting', era: 'euro2016' },
  { id: 'postiga', name: 'Hélder Postiga', line: 'FW', rating: 76, club: 'Porto', era: 'ouro' },
  { id: 'gramos', name: 'Gonçalo Ramos', line: 'FW', rating: 81, club: 'Benfica', era: 'atual' },
  { id: 'leao', name: 'Rafael Leão', line: 'FW', rating: 85, club: 'Sporting', era: 'atual' },
  { id: 'felix', name: 'João Félix', line: 'FW', rating: 83, club: 'Benfica', era: 'atual' },
  { id: 'jota', name: 'Diogo Jota', line: 'FW', rating: 84, club: 'Porto', era: 'atual' },
];

export const PLAYER_BY_ID: Record<string, Player> = Object.fromEntries(PLAYERS.map((p) => [p.id, p]));

/** The fixed legendary Portugal XI you face as the final boss (rating ~90). */
export const BOSS_XI: string[] = [
  'rpatricio',
  'cancelo', 'rcarvalho', 'rdias', 'nmendes',
  'figo', 'ruicosta', 'bsilva',
  'ronaldo', 'eusebio', 'leao',
];
