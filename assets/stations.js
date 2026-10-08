import {buildConsole} from './st-console.js';
import {buildVoice} from './st-voice.js';
import {buildMood} from './st-mood.js';
import {buildLounge} from './st-lounge.js';
import {buildRecords} from './st-records.js';
import {buildProducts} from './st-products.js';
import {buildAbout} from './st-rooms.js';
import {buildLibrary} from './st-library.js';
import {buildCockpit} from './st-cockpit.js';
// Every station registers itself in studio.stations and pushes its own updater.
export function buildStations(s) {
  buildConsole(s);
  buildVoice(s);
  buildMood(s);
  buildLounge(s);
  buildRecords(s);
  buildProducts(s);
  buildLibrary(s);
  buildCockpit(s);
  buildAbout(s);
}
