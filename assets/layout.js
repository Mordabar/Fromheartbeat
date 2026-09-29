// Floor plan of the studio. Everything is placed on a ring around the hub (0, 0, 0).
// Azimuth 0° is straight ahead (-Z); positive angles turn clockwise seen from above (toward +X).
import * as THREE from './vendor/three.module.js';

export const RAD = Math.PI / 180;
export const ROOM_RADIUS = 34;
export const RING = 25;                       // distance of the stations from the hub
export const STAGE_R = 23;                    // the main stage (logo) sits a little further out

export const AZIMUTH = {
  stage: 0,        // logo, REC / PLAY buttons, mood halo, checkout ticket
  genre: 48,       // console
  story: 96,       // lounge
  about: 138,      // information plaques
  products: 180,   // three experience podiums (behind the hub)
  session: -138,   // private terminal
  samples: -96,    // vinyl wall
  voice: -48,      // booth
};

export const polar = (azDeg, r) => new THREE.Vector3(r * Math.sin(azDeg * RAD), 0, -r * Math.cos(azDeg * RAD));

// A group at the given azimuth whose local +Z points back at the hub (so "front" always faces the visitor).
export function stationGroup(azDeg, r = RING) {
  const g = new THREE.Group();
  g.position.copy(polar(azDeg, r));
  g.rotation.y = -azDeg * RAD;
  return g;
}

// The view a camera needs to look at a station head-on: heading (yaw) = azimuth of the station.
export const headingOf = azDeg => azDeg * RAD;
