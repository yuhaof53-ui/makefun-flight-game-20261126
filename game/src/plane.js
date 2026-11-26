// Ridge Runner — the aeroplane: a low-poly bush plane built from primitives.
// Orange fuselage, cream wings, a spinning prop and wingtip nav lights. The
// nose points along +Z, so rotation.y = heading flies it where it points.
import * as THREE from '../vendor/three.module.min.js';
import { PALETTE } from './config.js';

function lambert(color) {
  return new THREE.MeshLambertMaterial({ color });
}

function phong(color, shininess = 60) {
  return new THREE.MeshPhongMaterial({ color, shininess });
}

/** Build the plane. Returns { group, prop, dashPanel, body } for the renderer. */
export function buildPlane() {
  const group = new THREE.Group();
  const orange = lambert(PALETTE.planeOrange);
  const cream = lambert(PALETTE.planeCream);
  const dark = lambert(PALETTE.planeDark);
  const glass = phong(0x16242e, 140);

  const body = new THREE.Group();

  // Fuselage: a tapered tube with a rounded nose.
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.62, 4.6, 12), orange);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.set(0, 0, -0.4);
  body.add(fuselage);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.3, 12), orange);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0, 2.55);
  body.add(nose);
  const tailCone = new THREE.Mesh(new THREE.ConeGeometry(0.62, 1.6, 12), orange);
  tailCone.rotation.x = -Math.PI / 2;
  tailCone.position.set(0, 0.05, -3.4);
  body.add(tailCone);

  // Cabin with dark glass.
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.95, 2.0), glass);
  cabin.position.set(0, 0.55, 0.35);
  body.add(cabin);
  const cabinRoof = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.22, 1.9), cream);
  cabinRoof.position.set(0, 1.1, 0.35);
  body.add(cabinRoof);

  // Main wings with a slight dihedral, cream on top.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.16, 1.9), cream);
  wing.position.set(0, 0.25, 0.5);
  body.add(wing);
  const wingTipL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 1.9), orange);
  wingTipL.position.set(-5.7, 0.32, 0.5);
  body.add(wingTipL);
  const wingTipR = wingTipL.clone();
  wingTipR.position.x = 5.7;
  body.add(wingTipR);

  // Tail: horizontal stabiliser and vertical fin.
  const stab = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.12, 1.1), cream);
  stab.position.set(0, 0.25, -3.9);
  body.add(stab);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.5, 1.3), orange);
  fin.position.set(0, 0.85, -3.9);
  body.add(fin);

  // Fixed landing gear: two struts and wheels.
  for (const side of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 6), dark);
    strut.position.set(side * 0.85, -0.95, 0.9);
    strut.rotation.z = side * 0.35;
    body.add(strut);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.28, 12), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 1.15, -1.45, 0.9);
    body.add(wheel);
  }

  // Propeller: hub, two blades and a faint blur disc when it spins fast.
  const prop = new THREE.Group();
  const hub = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.8, 10), dark);
  hub.rotation.x = Math.PI / 2;
  hub.position.set(0, 0, 3.35);
  prop.add(hub);
  const bladeMat = lambert(0x1c1e22);
  for (const angle of [0, Math.PI]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.6, 0.08), bladeMat);
    blade.position.set(0, 0, 3.3);
    blade.rotation.z = angle;
    prop.add(blade);
  }
  const blur = new THREE.Mesh(
    new THREE.CircleGeometry(1.35, 24),
    new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.16, side: THREE.DoubleSide }),
  );
  blur.position.set(0, 0, 3.28);
  prop.add(blur);
  prop.userData.blur = blur;
  body.add(prop);

  // Wingtip navigation lights: red left, green right.
  const navL = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xff2a2a }),
  );
  navL.position.set(-5.85, 0.3, 0.5);
  body.add(navL);
  const navR = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0x2aff5a }),
  );
  navR.position.set(5.85, 0.3, 0.5);
  body.add(navR);

  group.add(body);

  // Cockpit dashboard: a dark panel with four lit gauge discs, shown in cockpit view.
  const dashPanel = new THREE.Group();
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 0.95, 0.12),
    new THREE.MeshLambertMaterial({ color: 0x14171c }),
  );
  dashPanel.add(panel);
  const gaugeColors = [0xffc861, 0x7ee2a8, 0x6fb7ff, 0xff8a5c];
  for (let i = 0; i < 4; i += 1) {
    const gauge = new THREE.Mesh(
      new THREE.CircleGeometry(0.3, 20),
      new THREE.MeshBasicMaterial({ color: gaugeColors[i] }),
    );
    gauge.position.set(-1.2 + i * 0.8, 0.05, 0.07);
    dashPanel.add(gauge);
  }
  dashPanel.position.set(0, -0.35, 2.05);
  dashPanel.visible = false;
  group.add(dashPanel);

  return { group, prop, dashPanel, body };
}
