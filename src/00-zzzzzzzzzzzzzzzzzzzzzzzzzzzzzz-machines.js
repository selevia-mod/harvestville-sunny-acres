// Bram's farm machines: the Tractor, the Seeder and the Harvester (the last part of the truck plan, owner 13 Nov 2026:
// "trucks, harvester and farm machines ... for a better planting"; 18 Nov: "build it now and I will create an art later").
// The numbers; the rules in 01-logicZZZZZZZZZZZZZZZZZZZZZZZZZZZ-machines.js; the Forge rows, the world and the tour in
// 19zzz...-machines.js. Each is held in a bag slot like a tool and used with the action button: a tap works the 3x3
// block ahead (as a Silver tool's charged swing), a held button a row of 9. A machine saves time, never energy: it costs
// 8 tiles' worth of what the same work costs by hand, the cheapest hand way (picking and planting cost nothing by hand,
// so they cost nothing here). One of each a farm.
// Icons: frames of the items texture past every sheet (C.MACHINE_ICON_BASE), drawn in code until the owner's pictures
// come: 'machine_icons' (3 cells of 128 in C.MACHINE_KINDS' order) and 'machine_<kind>' (each one side on, facing right).
(function (F) {
  'use strict';
  var C = F.Config;
  C.MACHINE_KINDS = ['tractor', 'seeder', 'harvester'];
  C.MACHINES = {
    save: 8 / 9, // energy: 8 tiles' worth for 9 by hand
    row: 9, // a held button: a row of up to 9 ahead
    clears: ['weed', 'branch', 'stone'], // what the Tractor clears on its way (stumps and boulders stay for the axe and hammer)
    most: 6, // room kept for one picked tile: the crop and up to 4 more (crop stars, a dish power, a skill, Double Drops)
    tractor: { name: 'Tractor', verb: 'Till', gold: 80000, lumber: 40, needs: [['ore_copper', 10], ['farm_cement', 4]],
      desc: 'Tills the 3x3 ahead in one go (hold: a row of 9), and clears its weeds, branches and stones.' },
    seeder: { name: 'Seeder', verb: 'Plant', gold: 120000, lumber: 40, needs: [['ore_silver', 10], ['rope', 4]],
      desc: 'Plants the seeds you held last on the 3x3 ahead (hold: a row of 9), one packet a pass.' },
    harvester: { name: 'Harvester', verb: 'Harvest', gold: 200000, lumber: 60, needs: [['ore_gold', 10], ['farm_cement', 6], ['rope', 6]],
      desc: 'Picks every ripe crop on the 3x3 ahead (hold: a row of 9) straight into the Silo.' },
  };
  C.MACHINE_ICON_BASE = 2700;
  C.machineIcon = function (k) { var i = C.MACHINE_KINDS.indexOf(k); return i < 0 ? -1 : C.MACHINE_ICON_BASE + i; };
  C.MACHINE_KINDS.forEach(function (k) {
    var R = C.MACHINES[k];
    C.ITEMS[k] = { name: R.name, kind: 'tool', machine: k, painted: true, icon: C.machineIcon(k), desc: R.desc };
  });
})(window.Farm = window.Farm || {});
