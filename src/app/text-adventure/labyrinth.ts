﻿import {Engine} from '../common/engine';
import {AllMaps} from './map_content';
import * as consts from './const';
import * as translations from './translations';
import {LevelMap, Pos, ObjPos, ProjPos} from './map_logic';
import {item2color} from './const';
import {SpawnerState} from './target';

function make_first_letter_upper(str): string {
  return str.charAt(0).toUpperCase() + str.substr(1);
}

const charToCommand = new Map<string, [string, Pos]>([
  [ 'ArrowUp', [ '^', new Pos(consts.char_per_line - 8, 0) ] ],
  [ 'ArrowLeft', [ '<', new Pos(consts.char_per_line - 11, 1) ] ],
  [ 'ArrowDown', [ 'v', new Pos(consts.char_per_line - 8, 1) ] ],
  [ 'ArrowRight', [ '>', new Pos(consts.char_per_line - 5, 1) ] ],
]);

const currencyFormatter = new Intl.NumberFormat('fr-CH', {
  style: 'decimal',
  minimumFractionDigits: 0,
});

class Item {
  symbol: string;
  usage: number;

  constructor(symbol, usage) {
    this.symbol = symbol;
    this.usage = usage;
  }
}

class PersistedMapData {
  items: Map<string, Array<ObjPos>>;
  projectiles: Array<ProjPos>;
  spawner: SpawnerState;

  static parse(json): PersistedMapData {
    if (json === null) {
      return null;
    }

    const p = new PersistedMapData();

    p.items = new Map<string, Array<ObjPos>>();

    for (const item in json.items) {
      if (json.items.hasOwnProperty(item)) {
        const pss: Array<ObjPos> = [];
        const positions = json.items[item];

        for (let i = 0; i < positions.length; i++) {
          pss.push(new ObjPos(positions[i].x, positions[i].y, positions[i].usage));
        }

        p.items.set(item, pss);
      }
    }

    p.projectiles = [];

    for (let i = 0 ; i < json.projectiles.length; i++) {
      const proj = json.projectiles[i];
      p.projectiles.push(new ProjPos(proj.x, proj.y, proj.vx, proj.vy, proj.symbol, proj.power));
    }

    p.spawner = SpawnerState.parse(json.spawner);
    return p;
  }
  print(): {} {
    const p = {
      items: {},
      projectiles: [],
      spawner: this.spawner.print(),
    };

    for (const [item, positions] of this.items) {
      const pss = [];

      for (let i = 0; i < positions.length; i++) {
        pss.push({
          x: positions[i].x,
          y: positions[i].y,
          usage: positions[i].usage,
        });
      }

      p.items[item] = pss;
    }

    for (const proj of this.projectiles) {
      p.projectiles.push({
        x: proj.x,
        y: proj.y,
        vx: proj.vx,
        vy: proj.vy,
        symbol: proj.symbol,
        power: proj.power,
      });
    }

    return p;
  }
  copy(): PersistedMapData {
    const cpy = new PersistedMapData();

    cpy.items = new Map<string, Array<ObjPos>>();

    for (const [item, positions] of this.items) {
      const pss: Array<ObjPos> = [];

      for (const p of positions) {
        pss.push(p.copy());
      }

      cpy.items.set(item, pss);
    }

    cpy.projectiles = [];

    for (const proj of this.projectiles) {
      cpy.projectiles.push(proj.copy());
    }

    cpy.spawner = this.spawner.copy();
    return cpy;
  }
}

class PersistedData {
  weapon: string;
  rocks: number;
  coins: number;
  hero_position: Pos;
  map_data: Map<string, PersistedMapData>;
  current_map_name: string;

  static parse(json): PersistedData {
    if (json === null) {
      return null;
    }

    const p = new PersistedData();

    p.weapon = json.weapon;
    p.rocks = json.rocks;
    p.coins = json.coins;
    p.hero_position = new Pos(json.hero_position.x, json.hero_position.y);
    p.map_data = new Map<string, PersistedMapData>();

    for (const map in json.map_data) {
      if (json.map_data.hasOwnProperty(map)) {
        p.map_data.set(map, PersistedMapData.parse(json.map_data[map]));
      }
    }

    p.current_map_name = json.current_map_name;
    return p;
  }
  print(): {} {
    const p = {
      weapon: this.weapon,
      rocks: this.rocks,
      coins: this.coins,
      hero_position: {
        x: this.hero_position.x,
        y: this.hero_position.y
      },
      map_data: {},
      current_map_name: this.current_map_name,
    };

    for (const [i, data] of this.map_data) {
      p.map_data[i] = data.print();
    }

    return p;
  }
  copy(): PersistedData {
    const cpy = new PersistedData();

    cpy.weapon = this.weapon;
    cpy.rocks = this.rocks;
    cpy.coins = this.coins;
    cpy.hero_position = this.hero_position.copy();

    cpy.map_data = new Map<string, PersistedMapData>();

    for (const [name, data] of this.map_data) {
      cpy.map_data.set(name, data.copy());
    }

    cpy.current_map_name = this.current_map_name;
    return cpy;
  }
}

class PersonalInfos {
  lang: string;
  // visa?
}

export class Labyrinth {
  public pressed: Map<string, boolean>;
  private readonly engine: Engine;
  readonly char_width: number;
  private current_status: string;
  private is_throwing: boolean;
  private is_menu_open: boolean;
  private is_main_menu: boolean;
  private menu_position: number;
  private main_menu: Array<any>;
  private game_menu: Array<any>;

  game_over_message: string;
  personal_info: PersonalInfos;
  last_save: PersistedData;
  persisted_data: PersistedData;
  initial_persisted_data: PersistedData;
  fps: number;

  current_map: LevelMap;
  current_map_data: PersistedMapData;

  static load_save(l: Labyrinth, save: PersistedData) {
    l.persisted_data = save;

    l.is_main_menu = false;
    l.is_menu_open = false;

    l.change_map(l.persisted_data.current_map_name, false);
    l.is_menu_open = false;

    l.save_to_memory();
  }
  static load_from_storage(l: Labyrinth): void {
    Labyrinth.load_save(l, Labyrinth.get_from_storage());
  }
  static save_to_storage(l: Labyrinth): void {
    const save_data = JSON.stringify(l.persisted_data.print());
    window.localStorage.setItem('save', save_data);
    l.is_menu_open = false;
  }
  static clear_storage() {
    window.localStorage.clear();
  }
  static get_from_storage(): PersistedData {
    const save_data = window.localStorage.getItem('save');

    if (save_data === undefined) {
      return null;
    }

    const persisted_data = PersistedData.parse(JSON.parse(save_data));

    if (persisted_data === null) {
      return null;
    }

    return persisted_data;
  }
/*  static toggle_language(l: Labyrinth): void {
    if (l.personal_info.lang === 'en') {
      l.personal_info.lang = 'fr';
    } else {
      l.personal_info.lang = 'en';
    }

    l.save_personal_infos();
    l.refresh_menu(false);
    l.draw();
  }*/
  static open_main_menu(l: Labyrinth) {
    l.refresh_menu(true);
    l.is_main_menu = true;
  }
  static clear_and_start_rt(l: Labyrinth): void {
    const new_save = l.initial_persisted_data.copy();
    Labyrinth.load_save(l, new_save);
  }
  parse_all_maps(): void {
    this.initial_persisted_data = new PersistedData();
    this.initial_persisted_data.map_data = new Map<string, PersistedMapData>();

    for (const [key, map] of AllMaps) {
      map.parse(key);

      const map_data = new PersistedMapData();
      map_data.items = new Map<string, Array<ObjPos>>();
      map_data.projectiles = [];
      map_data.spawner = new SpawnerState([], 0);

      for (const [item, positions] of map.initial_item_positions) {
        const item_positions: Array<ObjPos> = [];

        for (let i = 0; i < positions.length; i++) {
          item_positions.push(positions[i].copy());
        }

        map_data.items.set(item, item_positions);
      }

      this.initial_persisted_data.map_data.set(key, map_data);
    }

    // Default values for production
    const initial_map = 'bateau';
    this.initial_persisted_data.coins = 0;
    this.initial_persisted_data.weapon = '';
    this.initial_persisted_data.rocks = 0;

    // TODO: Remove, here are debugging values
  //  initial_map = 'hit_sword';
//    this.initial_persisted_data.weapon = '\\';
   // this.initial_persisted_data.rocks = 0;
    // TODO: END

    this.initial_persisted_data.current_map_name = initial_map;
    this.initial_persisted_data.hero_position = AllMaps.get(initial_map).start;
  }
  draw(): void {
    if (this.is_main_menu) {
      this.engine.clear(consts.DefaultBackgroundColor);
      this.draw_main_menu();
    } else {
      this.engine.clear(this.current_map.background_color);
      this.draw_all();
    }
  }
  do_update(): void {
    if (this.is_menu_open || this.is_main_menu) {
      this.update_menu();
    } else {
      this.update_on_map();
    }
  }
  get_string_from(x, y, length): string {
    return this.current_map.map.substr(y * (consts.char_per_line + 1) + x, length);
  }
  to_screen_coord(x, y, dx = 0, dy = 0): Pos {
    return new Pos(this.char_width * x + dx, 16 * y + dy);
  }
  update_current_status(hero_pos): void {
    let status_set = false;
    let current_status = this.current_status;
    const lang = this.personal_info.lang;

    for (const [item, positions] of this.current_map_data.items) {
      for (let i = 0 ; i < positions.length; i++) {
        if (positions[i].equals(hero_pos)) {
          if (item === '$') {
            this.persisted_data.coins++;
            positions.splice(i, 1);
            current_status = '> 1 $' + translations.pris[lang]['M'];
          } else {
            const description = translations.item2description[lang][item];
            current_status = translations.take[lang] + description.text;

            if (positions[i].usage > 1) {
              current_status += ' (x' + positions[i].usage + ')';
            }
          }

          status_set = true;
          break;
        }
      }

      if (status_set) {
        break;
      }
    }

    if (!status_set) {
      this.current_status = '';
    } else {
      this.current_status = current_status;
    }

    if (this.persisted_data.current_map_name === 'treasure') {
      this.current_status = '> Merci d\'avoir joué!';
      return;
    }
  }
  drop_current_slot_item_at(pos: Pos, symbol: string, usage: number) {
    // Drop item on the ground if any
    if (symbol !== '') {
      if (!this.current_map_data.items.has(symbol)) {
        this.current_map_data.items.set(symbol, []);
      }

      this.current_map_data.items.get(symbol).push(new ObjPos(pos.x, pos.y, usage));
    }
  }
  try_pick_or_drop_item(hero_pos): boolean {
    const lang = this.personal_info.lang;

    if (this.pressed.get('Enter')) {
      let item_picked = false;
      let current_status = this.current_status;

      for (const [item, positions] of this.current_map_data.items) {
        const description = translations.item2description[lang][item];

        for (let i = 0 ; i < positions.length; i++) {
          if (positions[i].equals(hero_pos)) {
            if (consts.weapon_items.indexOf(item) > -1) {
              if (this.persisted_data.weapon !== '') {
                this.drop_current_slot_item_at(positions[i], this.persisted_data.weapon, -1);
              }

              this.persisted_data.weapon = item;
            } else if (consts.throwable_items.indexOf(item) > -1) {
              this.persisted_data.rocks++;
            }

            const upper = make_first_letter_upper(description.text);
            current_status = '> ' + upper;

            if (positions[i].usage > 1) {
              current_status += ' (x' + positions[i].usage + ')';
            }

            current_status += translations.pris[lang][description.genre];
            positions.splice(i, 1);

            item_picked = true;
            break;
          }
        }

        if (item_picked) {
          break;
        }
      }

      if (!item_picked) {
        this.current_status = '';
      } else {
        this.current_status = current_status;
      }

      return true;
    }

    return false;
  }
  try_enter_or_exit(hero_pos): [boolean, Pos, string] {
    const symbol = this.get_symbol_at(hero_pos);

    if (symbol !== '>' && symbol !== '<') {
      return [false, undefined, undefined];
    }

    return this.do_teleport(symbol, hero_pos, hero_pos, hero_pos);
  }
  move_hero(hero_pos: Pos, walkable_pos: Pos, aim_pos: Pos): [Pos, boolean] {
    const ret = this.try_teleport(hero_pos, walkable_pos);

    if (ret[0]) {
      this.change_map(ret[2], true);
      hero_pos = ret[1];
      this.persisted_data.hero_position = ret[1];
      return [hero_pos, true];
    } else {
      const [evt, symbol] = this.try_hit_target(hero_pos, aim_pos);

      if (evt === '') {
        hero_pos = walkable_pos;
        this.update_current_status(hero_pos);
      } else if (evt === 'hit') {
        // this.current_status = translations.hit[lang][symbol];
      }

      return [hero_pos, false];
    }

  }
  collides_with_obstacle(hero_pos: Pos): boolean {
    if (this.current_map.obstacle_visible === undefined) {
      return false;
    }

    for (const [chr, positions] of this.current_map.obstacles) {
      if (this.current_map.obstacle_visible(this, chr)) {
        for (const pos of positions) {
          if (hero_pos.equals(pos)) {
            return true;
          }
        }
      }
    }

    return false;
  }
  // We get:
  // (1) The walkable future position,
  // (2) The real future direction (for aiming) and
  // (3) the new status, if we hit something
  get_future_position(hero_pos): [Pos, Pos, string] {
    let x = hero_pos.x;
    let y = hero_pos.y;

    if (this.pressed.get('ArrowDown')) {
      y++;
    }

    if (this.pressed.get('ArrowUp')) {
      y--;
    }

    if (this.pressed.get('ArrowLeft')) {
      x--;
    }

    if (this.pressed.get('ArrowRight')) {
      x++;
    }

    const future_pos: Pos = new Pos(x, y);
    const allowed_walking_symbols = consts.walkable_symbols;

    let symbol = this.get_symbol_at(future_pos);

    if (allowed_walking_symbols.indexOf(symbol) > -1) {
      return [future_pos, future_pos, ''];
    }

    if (hero_pos.y !== future_pos.y) {
      symbol = this.current_map.get_symbol_at(hero_pos.x, future_pos.y);

      if (allowed_walking_symbols.indexOf(symbol) > -1) {
        return [new Pos(hero_pos.x, future_pos.y), future_pos, ''];
      } else {
        if (future_pos.x !== hero_pos.x) {
          symbol = this.current_map.get_symbol_at(future_pos.x, hero_pos.y);
        }

        if (allowed_walking_symbols.indexOf(symbol) > -1) {
          return [new Pos(future_pos.x, hero_pos.y), future_pos, ''];
        } else {
          return [hero_pos, future_pos, ''];
        }
      }
    } else {
      symbol = this.current_map.get_symbol_at(future_pos.x, hero_pos.y);

      if (allowed_walking_symbols.indexOf(symbol) > -1) {
        return [new Pos(future_pos.x, hero_pos.y), future_pos, ''];
      } else {
        return [ hero_pos, future_pos, '' ];
      }
    }
  }
  change_map(map_name: string, reset_targets: boolean): void {
    this.current_map = AllMaps.get(map_name);
    this.persisted_data.current_map_name = map_name;
    this.current_map_data = this.persisted_data.map_data.get(map_name);

    if (reset_targets) {
      this.current_map_data.spawner.reset();
    }
  }
  save_to_memory(): void {
    this.last_save = this.persisted_data.copy();
  }
  load_last_save() {
    this.persisted_data = this.last_save.copy();
    this.change_map(this.persisted_data.current_map_name, false);
  }
  try_teleport(hero_pos, future_pos): [boolean, Pos, string] {
    for (const [chr, teleports_for_char] of this.current_map.teleports) {
      if (chr === '<' || chr === '>') { // These are treated separately
        continue;
      }

      for (let j = 0; j < teleports_for_char.length; j++) {
        const pos = teleports_for_char[j];

        if (pos.equals(future_pos)) {
          return this.do_teleport(chr, pos, hero_pos, future_pos);
        }
      }
    }

    return [
      false,
      undefined,
      undefined,
    ];
  }
  do_teleport(chr, pos, hero_pos, future_pos): [boolean, Pos, string] {
    const new_map_name = this.current_map.teleport_map.get(chr);
    const new_map = AllMaps.get(new_map_name);
    let teleports_of_other_map;
    let id;

    if (chr === '>') {
      teleports_of_other_map = new_map.teleports.get('<');
      id = 0;
    } else if (chr === '<') {
      teleports_of_other_map = new_map.teleports.get('>');
      id = 0;
    } else {
      teleports_of_other_map = new_map.teleports.get(chr);
      id = pos.id;
    }

    const tp = teleports_of_other_map[id];

    let new_x = tp.x + (future_pos.x - hero_pos.x);
    let new_y = tp.y + (future_pos.y - hero_pos.y);

    // Fix the case where teleport + mouvement ends up in a wall!
    if (new_map.get_symbol_at(new_x, new_y) === '#') {
      if (new_map.get_symbol_at(tp.x, new_y) === '#') {
        new_y = tp.y;
      } else {
        new_x = tp.x;
      }
    }

    return [
      true,
      new Pos(new_x, new_y),
      new_map_name,
    ];
  }
  try_hit_target(hero_pos: Pos, aim_pos: Pos): [string, string] {
    if (this.current_map.target_spawner === undefined) {
      return [ '', '' ];
    }

    const targets = this.current_map_data.spawner.targets;

    for (let i = 0; i < targets.length;) {
      const target = targets[i];

      if (target.pos.equals(aim_pos)) {
        const dmg = this.get_weapon_damage();

        if (target.symbol === 'O' && dmg !== 0) {
          target.pv -= dmg;

          if (target.pv <= 0) {
            targets.splice(i, 1);
            return [ 'hit', target.symbol ];
          } else {
            return [ 'push', target.symbol ];
          }
        } else {
          return [ 'push', target.symbol ];
        }
      }

      i++;
    }

    return [ '', '' ];
  }
  update_targets(hero_pos: Pos): Pos {
    if (this.current_map.target_spawner !== undefined) {
      return this.current_map.target_spawner.update(this, this.current_map_data.spawner, hero_pos);
    }

    return hero_pos;
  }
  move_projectiles() {
    for (let i = 0; i < this.current_map_data.projectiles.length;) {
      const proj = this.current_map_data.projectiles[i];

      const newprojx = proj.x + proj.vx;
      const newprojy = proj.y + proj.vy;

      // If we go outside of the room, teleport the item to it!
      if (newprojy >= consts.map_lines || newprojy < 0
        || newprojx < 0 || newprojx >= consts.char_per_line)  {
        const [can_teleport, where, map_name] = this.try_teleport(proj, proj);

        if (can_teleport) {
          const map_data = this.persisted_data.map_data.get(map_name);
          this.projectile2item(map_data, new Pos(where.x + proj.vx, where.y + proj.vy), i);
          continue;
        }
      }

      // If we hit a wall or water in the same room
      const symbol = this.current_map.get_symbol_at(newprojx, newprojy);

      if (consts.walkable_symbols.indexOf(symbol) === -1) {
        this.projectile2item(this.current_map_data, proj, i);
        continue;
      }

      proj.x = newprojx;
      proj.y = newprojy;

      i++;
    }
  }
  move_targets_or_die(hero_pos: Pos) {
    hero_pos = this.update_targets(hero_pos);
    const lang = this.personal_info.lang;
    const symbol = this.get_symbol_at(hero_pos);

    if (consts.walkable_symbols.indexOf(symbol) === -1) {
      this.game_over_message = translations.symbol2gameover[lang][symbol];
    } else {
      this.persisted_data.hero_position = hero_pos;
    }

  }
  update_menu() {
    let current_menu: Array<any>;

    if (this.is_main_menu) {
      current_menu = this.main_menu;
    } else {
      current_menu = this.game_menu;
    }

    if (this.pressed.get('ArrowUp')) {
      let new_p = this.menu_position;

      if (new_p > 0) {
        do {
          new_p--;
        }
        while (new_p !== -1 && !current_menu[new_p][2]);
      }

      if (new_p !== -1) {
        this.menu_position = new_p;
      }
    }

    if (this.pressed.get('ArrowDown')) {
      let new_p = this.menu_position;

      if (new_p < current_menu.length) {
        do {
          new_p++;
        }
        while (new_p !== current_menu.length && !current_menu[new_p][2]);
      }

      if (new_p !== current_menu.length) {
        this.menu_position = new_p;
      }
    }

    if (this.pressed.get('Enter')) {
      current_menu[this.menu_position][1](this);
    }

    if (!this.is_main_menu && this.pressed.get('Escape')) {
      this.is_menu_open = false;
    }
  }
  update_on_map() {
    if (this.game_over_message !== '') {
      if (this.pressed.get(' ')) {
        this.game_over_message = '';
        this.load_last_save();
      }

      return;
    }

    if (this.pressed.get('Shift') && this.persisted_data.rocks > 0) {
      this.is_throwing = !this.is_throwing;
      return;
    }

    if (this.pressed.get('Escape')) {
      this.is_menu_open = true;
      this.menu_position = 0;
      this.refresh_menu(false); // This is to update the availability of Load()
      return;
    }

    const future_pos = this.get_future_position(this.persisted_data.hero_position);
    const lang = this.personal_info.lang;

    const ret = this.try_enter_or_exit(future_pos[0]);

    if (ret !== undefined) {
      if (ret[0]) {
        this.change_map(ret[2], true);
        this.persisted_data.hero_position = ret[1];
        this.save_to_memory();
        return;
      }
    }

    if (this.try_pick_or_drop_item(this.persisted_data.hero_position)) {
      this.move_projectiles();
      this.move_targets_or_die(this.persisted_data.hero_position);
      return;
    }

    if (this.is_throwing) {
      if (this.persisted_data.rocks > 0) {
        const item = translations.item2description[lang]['*'];

        this.current_status = '> ' + make_first_letter_upper(item.text + translations.lance[lang][item.genre]);

        const x = this.persisted_data.hero_position.x;
        const y = this.persisted_data.hero_position.y;
        const vx = future_pos[1].x - x;
        const vy = future_pos[1].y - y;

        if (vx !== 0 || vy !== 0) {
          this.current_map_data.projectiles.push(new ProjPos(x, y, vx, vy, '*', 1));
          this.persisted_data.rocks--;

          this.is_throwing = false;
          this.move_projectiles();
          this.move_targets_or_die(this.persisted_data.hero_position);
        }

        return;
      }
    }

    if (future_pos[2] !== '') {
      this.current_status = future_pos[2];
      this.move_projectiles();
      this.move_targets_or_die(this.persisted_data.hero_position);
      return;
    }

    if (this.collides_with_obstacle(future_pos[0])) {
      return;
    }

    const [new_pos, map_changed] = this.move_hero(this.persisted_data.hero_position, future_pos[0], future_pos[1]);
    this.persisted_data.hero_position = new_pos;

    if (!map_changed) {
      this.move_projectiles();
    }

    this.move_targets_or_die(this.persisted_data.hero_position);

    if (map_changed && this.game_over_message === '') {
      this.save_to_memory();
    }
  }
  draw_map() {
    for (let y = 0; y < consts.map_lines; y++) {
      for (let x = 0; x < consts.char_per_line;) {
        let length = 0;
        const val = this.current_map.get_symbol_at(x, y);

        if (val === ' ' || val === '\n' || val === undefined) {
          x++;
          continue;
        }

        while (true) {
          length++;

          const chr = this.current_map.get_symbol_at(x + length, y);

          if (chr !== val) {
            break;
          }
        }

        const coord = this.to_screen_coord(x, y + consts.header_size);
        const str = this.get_string_from(x, y, length);
        let color;

        if (this.current_map.tile2color !== undefined) {
          color = this.current_map.tile2color.get(val);
        }

        if (color === undefined) {
          color = consts.globalTile2color[val];
        }

        if (color === undefined) {
          color = this.current_map.text_color;
        }

        this.engine.rect(coord, str.length * this.char_width, 16, this.current_map.background_color);
        this.engine.text(str, coord, color);
        x += length;
      }
    }

    if (this.current_map.texts !== undefined) {
      const lang = this.personal_info.lang;
      const texts = this.current_map.texts[lang];

      for (const key in texts) {
        if (texts.hasOwnProperty(key)) {
          const pos = texts[key];
          this.engine.text(key, this.to_screen_coord(pos.x, pos.y), this.current_map.text_color);
        }
      }
    }
  }
  draw_projectiles() {
    for (const proj of this.current_map_data.projectiles) {
      const coord = this.to_screen_coord(proj.x, proj.y + consts.header_size);

      this.engine.rect(coord, this.char_width, 16, this.current_map.background_color);
      this.engine.text(proj.symbol, coord, consts.projectile2color[proj.symbol]);
    }
  }
  draw_targets() {
    if (this.current_map.target_spawner !== undefined) {
      for (const target of this.current_map_data.spawner.targets) {
        const coord = this.to_screen_coord(target.pos.x, target.pos.y + consts.header_size);

        this.engine.rect(coord, this.char_width, 16, this.current_map.background_color);
        this.engine.text(target.symbol, coord, this.current_map.target_spawner.pv2color(target.pv));
      }
    }
  }
  draw_obstacles() {
    if (this.current_map.obstacle_visible === undefined) {
      return false;
    }

    for (const [ chr, positions ] of this.current_map.obstacles) {
      if (this.current_map.obstacle_visible(this, chr)) {
        for (const pos of positions) {
          const coord = this.to_screen_coord(pos.x, pos.y + consts.header_size);
          this.engine.rect(coord, this.char_width, 16, this.current_map.background_color);
          this.engine.text(chr, coord, this.current_map.obstacle_color);
        }
      }
    }
  }
  draw_character(chr: string, coord: Pos, color: string) {
    this.engine.rect(coord, this.char_width, 16, this.current_map.background_color);
    this.engine.text(chr, coord, color);
  }
  draw_hero() {
    this.draw_character('@',
      this.to_screen_coord(this.persisted_data.hero_position.x, this.persisted_data.hero_position.y + consts.header_size),
      consts.pnj2color['@']);
  }
  draw_items() {
    for (const [item, positions] of this.current_map_data.items) {

      for (let i = 0; i < positions.length; i++) {
        const coord = this.to_screen_coord(positions[i].x, positions[i].y + consts.header_size);
        const color = consts.item2color[item];

        this.engine.rect(coord, this.char_width, 16, this.current_map.background_color);
        this.engine.text(item, coord, color);
      }
    }
  }
  get_weapon_damage() {
    return consts.weapon2damage[this.persisted_data.weapon];
  }
  get_symbol_at(pos: Pos): string {
    return this.current_map.get_symbol_at(pos.x, pos.y);
  }
  hits_projectile(pos: Pos): [number, number] {
    for (let i = 0; i < this.current_map_data.projectiles.length; i++) {
      const proj = this.current_map_data.projectiles[i];

      if (proj.equals(pos)) {
        return [i, proj.power];
      }
    }

    return [-1, 0];
  }
  projectile2item(map_data: PersistedMapData, where: Pos, projectile_position: number) {
    const proj = this.current_map_data.projectiles[projectile_position];

    if (!map_data.items.has(proj.symbol)) {
      map_data.items.set(proj.symbol, []);
    }

    const items = map_data.items.get(proj.symbol);
    let found_item = false;

    for (let i = 0; i  < items.length; i++) {
      if (items[i].equals(proj)) {
        items[i].usage++;
        found_item = true;
        break;
      }
    }

    if (!found_item) {
      items.push(new ObjPos(where.x, where.y, 1));
    }

    this.current_map_data.projectiles.splice(projectile_position, 1);
  }
  draw_overlay() {
    const lang = this.personal_info.lang;

    this.engine.text(this.current_status, this.to_screen_coord(2, 1), consts.White);

    const speed = 'FPS: ' + this.fps;

    const money = currencyFormatter.format(this.persisted_data.coins) + ' $';
    this.engine.text(money, this.to_screen_coord(consts.char_per_line - money.length - 7, 1), item2color['$']);
    this.engine.text('[esc]', this.to_screen_coord(consts.char_per_line - 6, 1), consts.OverlayNormal);

    const h = consts.map_lines + consts.header_size + 1;

    for (const [chr, pos] of charToCommand) {
      if (this.is_throwing) {
        this.engine.text(pos[0], this.to_screen_coord(pos[1].x, pos[1].y + h), consts.OverlaySelected);
      } else if (this.pressed.get(chr)) {
        this.engine.text(pos[0], this.to_screen_coord(pos[1].x, pos[1].y + h), consts.OverlayHighlight);
      } else {
        this.engine.text(pos[0], this.to_screen_coord(pos[1].x, pos[1].y + h), consts.OverlayNormal);
      }
    }

    if (this.persisted_data.weapon !== '') {
      this.engine.text('- ' +
        make_first_letter_upper(translations.item2description[lang][this.persisted_data.weapon].text),
        this.to_screen_coord(3, h), consts.OverlayHighlight);
    }

    if (this.persisted_data.rocks !== 0) {
      this.engine.text('- ' +
        make_first_letter_upper(translations.item2description[lang]['*'].text) + ' (x' + this.persisted_data.rocks + ')',
        this.to_screen_coord(3, h + 1), consts.OverlayHighlight);
    }

    if (this.persisted_data.rocks > 0) {
      const txt = '⇧ ' + translations.lancer[lang];

      if (this.is_throwing) {
        this.engine.text(txt, this.to_screen_coord(29, h + 1, -2), consts.OverlaySelected);
      } else {
        this.engine.text(txt, this.to_screen_coord(29, h + 1, -2), consts.OverlayHighlight);
      }
    }
  }
  draw_message(): void {
    if (this.game_over_message !== '') {
      const lang = this.personal_info.lang;
      const retry = translations.retry[lang];

      this.engine.rect(this.to_screen_coord(consts.char_per_line / 2 - 15, 10),
        30 * this.char_width, 16 * 7, this.current_map.background_color);
      this.engine.text(' **************************** ',
        this.to_screen_coord(consts.char_per_line / 2 - 15, 10), consts.OverlayHighlight);

      for (let i = 11; i < 16; i++) {
        this.engine.text('*                            *',
           this.to_screen_coord(consts.char_per_line / 2 - 15, i), consts.OverlayHighlight);
      }

      this.engine.text(' **************************** ',
        this.to_screen_coord(consts.char_per_line / 2 - 15, 16), consts.OverlayHighlight);

      this.engine.text(this.game_over_message,
        this.to_screen_coord(consts.char_per_line / 2 - this.game_over_message.length / 2, 12), consts.OverlayHighlight);
      this.engine.text(retry, this.to_screen_coord(consts.char_per_line / 2 - retry.length / 2, 14), consts.OverlayHighlight);
    }
  }
  draw_main_menu(): void {
    let i = 0;

    for (const [text, func, enabled] of this.main_menu) {
      let txt: string;
      let x = consts.char_per_line / 2 - 7;
      let color: string;

      if (this.menu_position === i) {
        txt = '> ' + text;
      } else {
        txt = text;
        x += 2;
      }

      if (enabled) {
        color = consts.OverlayHighlight;
      } else {
        color = consts.OverlayNormal;
      }

      this.engine.text(txt, this.to_screen_coord(x, 12 + i), color);
      i++;
    }
  }
  draw_menu(): void {
    if (this.is_menu_open) {
      let i;

      this.engine.rect(this.to_screen_coord(consts.char_per_line / 2 - 15, 10),
        30 * this.char_width, 16 * 7, this.current_map.background_color);
      this.engine.text(' **************************** ',
        this.to_screen_coord(consts.char_per_line / 2 - 15, 10), consts.OverlayHighlight);

      for (i = 11; i < 16; i++) {
        this.engine.text('*                            *',
          this.to_screen_coord(consts.char_per_line / 2 - 15, i), consts.OverlayHighlight);
      }

      this.engine.text(' **************************** ',
        this.to_screen_coord(consts.char_per_line / 2 - 15, 16), consts.OverlayHighlight);

      i = 0;

      for (const [text, func, enabled] of this.game_menu) {
        let txt: string;
        let x = consts.char_per_line / 2 - 5;
        let color: string;

        if (this.menu_position === i) {
          txt = '> ' + text;
        } else {
          txt = text;
          x += 2;
        }

        if (enabled) {
          color = consts.OverlayHighlight;
        } else {
          color = consts.OverlayNormal;
        }

        this.engine.text(txt, this.to_screen_coord(x, 12 + i), color);
        i++;
      }
    }
  }
  draw_all(): void {
    this.draw_map();
    this.draw_items();
    this.draw_hero();
    this.draw_projectiles();
    this.draw_targets();
    this.draw_obstacles();
    this.draw_overlay();
    this.draw_message();
    this.draw_menu();
  }
  resize(width, height): void {
    this.engine.resize(width, height);
    this.draw();
  }
  refresh_menu(reset_position: boolean): void {
    const save = Labyrinth.get_from_storage();
    const lang = this.personal_info.lang;

    // Throw away incompatible saves :)
    // TODO

    this.main_menu = [
      [ translations.new_game_rt[lang], (l: Labyrinth) => Labyrinth.clear_and_start_rt(l), true ],
      [ translations.load[lang], (l: Labyrinth) => Labyrinth.load_save(l, save), save !== null ],
      // [ translations.lang[lang], (l: Labyrinth) => Labyrinth.toggle_language(l), true ],
    ];

    this.game_menu = [
      [ translations.save[lang], (l: Labyrinth) => Labyrinth.save_to_storage(l), true ],
      [ translations.load[lang], (l: Labyrinth) => Labyrinth.load_from_storage(l), save !== null ],
      [ translations.exit[lang], (l: Labyrinth) => Labyrinth.open_main_menu(l), true],
    ];

    if (reset_position) {
      if (this.main_menu[1][2]) {
        this.menu_position = 1;
      } else {
        this.menu_position = 0;
      }
    }
  }
  load_personal_infos() {
    this.personal_info = JSON.parse(window.localStorage.getItem('personal'));

    if (this.personal_info === null) {
      this.personal_info = new PersonalInfos();
      this.personal_info.lang = 'fr';
    }
  }
  save_personal_infos() {
    window.localStorage.setItem('personal', JSON.stringify(this.personal_info));
  }
  constructor() {
    this.engine = new Engine(
      'canvas',
      460,
      480,
      16,
      'Inconsolata, monospace');

    this.pressed = new Map([
      [ 'ArrowUp', false ],
      [ 'ArrowDown', false ],
      [ 'ArrowLeft', false ],
      [ 'ArrowRight', false ],
      [ 'Enter', false ],
      [ ' ', false ],
      [ 'Shift', false ],
      [ 'Escape', false ],
    ]);

    this.current_status = '';
    this.char_width = this.engine.get_char_width();
    this.is_throwing = false;
    this.game_over_message = '';
    this.is_menu_open = false;
    this.is_main_menu = true;
    this.fps = 30;

    this.load_personal_infos();
    this.parse_all_maps();
    this.refresh_menu(true);
  }
}
