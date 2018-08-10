import { Component } from '@angular/core';
import * as $ from 'jquery';
import { Labyrinth } from './labyrinth';

let labyrinth;

function step() {
  labyrinth.do_update();
  labyrinth.draw();
}

$(document).ready(function() {
  // document.fonts.ready.then(function () {
    labyrinth = new Labyrinth();

    $(window).resize(function () {
      labyrinth.resize($(window).width(), $(window).height());
    });

    labyrinth.resize($(window).width(), $(window).height());

    $(document).on('keydown', function (event) {
      let update = false;

      if (event.key === 'i') {
        labyrinth.open_inventory = !labyrinth.open_inventory;
        update = true;
      } else if (event.key === 'h') {
        labyrinth.open_help = !labyrinth.open_help;
        update = true;
      } else if (event.key === 'p') {
        labyrinth.pickup = true;
        update = true;
      } else {
        if (event.key === 'ArrowLeft' || event.key === '4' || event.key === '7' || event.key === '1') {
          labyrinth.left = 1;
          update = true;
        }

        if (event.key === 'ArrowRight' || event.key === '6' || event.key === '9' || event.key === '3') {
          labyrinth.right = 1;
          update = true;
        }

        if (event.key === 'ArrowUp' || event.key === '8' || event.key === '7' || event.key === '9') {
          labyrinth.up = 1;
          update = true;
        }

        if (event.key === 'ArrowDown' || event.key === '2' || event.key === '3' || event.key === '1') {
          labyrinth.down = 1;
          update = true;
        }

        if (event.key === '.' || event.key === '5') {
          update = true;
        }
      }

      if (update) {
        step();
      }
    });

    $(document).on('keyup', function (event) {
      if (event.key === 'ArrowLeft' || event.key === '4' || event.key === '7' || event.key === '1') {
        labyrinth.left = 0;
      }

      if (event.key === 'ArrowRight' || event.key === '6' || event.key === '9' || event.key === '3') {
        labyrinth.right = 0;
      }

      if (event.key === 'ArrowUp' || event.key === '8' || event.key === '7' || event.key === '9') {
        labyrinth.up = 0;
      }

      if (event.key === 'ArrowDown' || event.key === '2' || event.key === '3' || event.key === '1') {
        labyrinth.down = 0;
      }
    });

    step();
  // });
});

@Component({
  selector: 'app-text-adventure',
  templateUrl: './text-adventure.component.html',
  styleUrls: ['./text-adventure.component.css'],
})
export class TextAdventureComponent {
}
