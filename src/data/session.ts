import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  BookOpen,
  CircleGauge,
  Gauge,
  Home,
  Library,
  LineChart,
  Puzzle,
  Settings,
  Swords,
} from 'lucide-react';
import type { TrainingSessionSummary } from '../domain/sessionTypes';

export const boardFiles = ['8', '7', '6', '5', '4', '3', '2', '1'];
export const boardRanks = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

export const pieces: Record<string, string> = {
  a8: '♜',
  c8: '♝',
  d8: '♛',
  f8: '♜',
  g8: '♚',
  a7: '♟',
  b7: '♟',
  c7: '♟',
  e7: '♝',
  g7: '♟',
  h7: '♟',
  d6: '♟',
  f6: '♞',
  e5: '♟',
  e4: '♙',
  c3: '♘',
  d3: '♗',
  a2: '♙',
  b2: '♙',
  c2: '♙',
  f2: '♙',
  g2: '♙',
  h2: '♙',
  a1: '♖',
  c1: '♗',
  d1: '♕',
  e1: '♔',
  g1: '♘',
  h1: '♖',
};

export const highlightedSquares = new Set(['c3', 'd5', 'e2']);

export const moves = [
  ['1.', 'e4', 'c5'],
  ['2.', 'Cf3', 'd6'],
  ['3.', 'd4', 'cxd4'],
  ['4.', 'Cxd4', 'Cf6'],
  ['5.', 'Cc3', 'a6'],
  ['6.', 'Cd5', 'e5'],
  ['7.', 'Cc3', 'Ae7'],
  ['8.', 'Ag5', 'h6'],
];

export const variations = [
  ['+0.58', '6. Cd5 e5 7. Cc3 Ae7 8. Ag5 h6 9. Axf6 Axf6 10. Nd5'],
  ['+0.28', '6. e5 Cd5 7. Cxd5 exd5 8. c3 Ae7 9. Ad3 d6'],
  ['-0.12', '6. Cde2 dxe5 7. exd5 Cd4 8. Cxd4 exd4 9. Ce4 Dxd5'],
  ['+0.31', '6. a4 b5 7. axb5 e5 8. Cc3 dxe5 9. Df3 Axb5'],
];

export const navigation: Array<{ icon: LucideIcon; label: string }> = [
  { icon: Home, label: 'Dashboard' },
  { icon: Swords, label: 'Partida' },
  { icon: LineChart, label: 'Análisis' },
  { icon: Puzzle, label: 'Puzzles' },
  { icon: BarChart3, label: 'Reportes' },
  { icon: Settings, label: 'Configuración' },
];

export const utilityTools: Array<{ icon: LucideIcon; label: string }> = [
  { icon: BookOpen, label: 'Libro' },
  { icon: CircleGauge, label: 'Motor' },
  { icon: Library, label: 'Explorador' },
  { icon: Gauge, label: 'Tablero' },
  { icon: Settings, label: 'Anotaciones' },
];

export const trainingSession: TrainingSessionSummary = {
  mode: 'Humano vs humano · entrenamiento',
  stationRole: 'player-client',
  moderatorState: 'Moderador conectado',
  tutorPolicy: 'Tutor privado por estación',
  assistanceLevel: 'Clase consentida',
  visibility: 'Privado',
  matchPolicy: {
    tutorVisibility: 'private',
    assistanceTiming: 'live',
    enginePermission: 'evaluation-only',
    allowStudyBranches: true,
    markExportsAsAssisted: true,
  },
};
