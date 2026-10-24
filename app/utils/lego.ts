export const LEGO = {
  white: '#f4f4f4',
  warmWhite: '#efe9dc',
  cream: '#e6ddcc',
  lightGray: '#b9bec6',
  midGray: '#8f959c',
  darkGray: '#59616a',
  charcoal: '#2b333c',
  black: '#151c24',
  navy: '#1d3350',
  blue: '#1e5aa8',
  azure: '#2e8fb5',
  cyan: '#39b6c9',
  yellow: '#f2cd37',
  gold: '#e0a92e',
  red: '#c4382c',
  green: '#3f9550',
  lime: '#7fae3f',
  orange: '#e8832a',
  tan: '#d9b98a',
  wood: '#a97745',
  woodDark: '#6f4a2c',
  floor: '#d2c2a8',
  floorAlt: '#dfd2ba',
  floorEdge: '#bfae92',
  base: '#243041',
  baseEdge: '#161f2b',
  skin: '#ffd83f',
} as const

const MINIFIG_TORSOS = [
  '#c4382c',
  '#1e5aa8',
  '#3f9550',
  '#e8832a',
  '#6a4c93',
  '#2e8fb5',
  '#b23a48',
  '#4f6d7a',
]

const HAIR_COLORS = ['#2b1b12', '#4a2e1a', '#1e1e1e', '#5b3a22', '#7a5233']

function hash(value: string): number {
  let output = 0
  for (let index = 0; index < value.length; index += 1) {
    output = (output * 31 + value.charCodeAt(index)) >>> 0
  }
  return output
}

export function minifigTorso(name: string): string {
  return MINIFIG_TORSOS[hash(name) % MINIFIG_TORSOS.length] ?? MINIFIG_TORSOS[0]!
}

export function minifigHair(name: string): string {
  return HAIR_COLORS[hash(name) % HAIR_COLORS.length] ?? HAIR_COLORS[0]!
}

export function minifigVariant(name: string): 0 | 1 | 2 | 3 {
  return (hash(name) % 4) as 0 | 1 | 2 | 3
}
