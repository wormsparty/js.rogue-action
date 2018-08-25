export const char_per_line = 56;
export const map_lines = 22;
export const header_size = 3;

export const DefaultBackgroundColor = '#000000';
export const DefaultTextColor =  '#FFFF00';
export const White = '#FFFFFF';
export const OverlayNormal =  '#555555';
export const OverlayHighlight =  '#FFFFFF';
export const OverlaySelected =  '#FF00FF';

/*
 * Map
 */
export const globalTile2color = {
  '#': '#646464',
  '.': '#646464',
  '~': '#C8C8C8',
};

export const teleport_symbols: Array<string> = [ '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '>', '<' ];
export const item_symbols: Array<string> = [ '*', '$', '/', '=' ];
export const walkable_symbols: Array<string> = [ '.', '<', '>' ];
export const shop_maps: Array<string> = [ 'outside' ];

/*
 * PNJ
 */
export const pnj2color = {
  'g': '#0000FF',
  'm': '#6699FF',
  '@': '#FF0000',
  'O': '#FF7700',
};

export const mouvement_map = {
  0: {x: 1, y: 0},
  1: {x: -1, y: 0},
  2: {x: 0, y: 1},
  3: {x: 0, y: -1},
  4: {x: 1, y: 1},
  5: {x: -1, y: 1},
  6: {x: 1, y: -1},
  7: {x: -1, y: -1},
};

/*
 * Items
 */
export const item2color = {
  '$': '#FFFF00',
  // '(': '#FF8800',
  '=': '#FF0000',
  // '[': '#FF0088',
  // ']': '#FF00FF',
  '*': '#dd99FF',
  // '{': '#00FFFF',
  // ')': '#0000FF',
  // '}': '#00FF00',
  '%': '#119900',
  // '!': '#555555',
  // '?': '#FFFFFF',
  '/': '#222222',
};

export const item2price = {
  '*': 1,
  //  '?': 20,
  '/': 500,
};

export const weapon_items = [ '/' ];
export const throwable_items = [ '*' ];
export const spell_items = [ '=' ];
export const consumable_items = []; // [ '?' ];

export const spell_usage = {
  '=': 10,
};

export const projectile2color = {
  '*': '#999999',
  '&': '#FF0000',
};
