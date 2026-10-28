import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BIRD_R,
  BIRD_X,
  COURSES,
  FLAP_V,
  PX_PER_M,
  SEA_Y,
  START_Y,
  createRun,
  epitaph,
  flap,
  resetRun,
  step,
  type Difficulty,
  type Gate,
  type Run,
} from "./run.ts";

function launch(difficulty: Difficulty = "medium"): Run {
  const run = createRun();
  run.difficulty = difficulty;
  resetRun(run, "ready");
  flap(run);
  return run;
}

function hold(run: Run) {
  run.phase = "play";
  run.paused = false;
  run.y = START_Y;
  run.vy = 0;
}

function gate(run: Run, patch: Partial<Gate>): Gate {
  const made: Gate = {
    x: run.scroll,
    w: 48,
    gapY: START_Y,
    gapH: 160,
    lip: 20,
    side: "down",
    kind: "pier",
    passed: false,
    ...patch,
  };
  run.gates.push(made);
  return made;
}

describe("flap", () => {
  it("does nothing in the hangar", () => {
    const run = createRun();
    flap(run);
    assert.equal(run.phase, "hangar");
    assert.equal(run.vy, 0);
  });

  it("leaves the ramp and climbs", () => {
    const run = launch();
    assert.equal(run.phase, "play");
    assert.equal(run.vy, FLAP_V);
    assert.ok(run.wingT > 0);
  });

  it("does not climb while paused", () => {
    const run = launch();
    run.vy = 0;
    run.paused = true;
    flap(run);
    assert.equal(run.vy, 0);
    assert.equal(run.phase, "play");
  });

  it("starts the next climb from a wreck", () => {
    const run = launch();
    run.phase = "dead";
    run.metres = 40;
    flap(run);
    assert.equal(run.phase, "play");
    assert.equal(run.metres, 0);
    assert.equal(run.vy, FLAP_V);
  });
});

describe("step", () => {
  it("freezes the flight while paused", () => {
    const run = launch();
    const y = run.y;
    const scroll = run.scroll;
    run.paused = true;
    step(run, 0.5);
    assert.equal(run.y, y);
    assert.equal(run.scroll, scroll);
    assert.equal(run.metres, 0);
  });

  it("falls into the sea", () => {
    const run = launch();
    run.y = SEA_Y - BIRD_R + 1;
    run.vy = 0;
    step(run, 1 / 60);
    assert.equal(run.phase, "dead");
  });

  it("hits the top of the frame", () => {
    const run = launch();
    run.y = BIRD_R;
    run.vy = -400;
    step(run, 1 / 60);
    assert.equal(run.phase, "dead");
  });

  it("dies on a pier post and survives a clear gap", () => {
    const blocked = launch();
    gate(blocked, { x: blocked.scroll + BIRD_X - 10, side: "both", gapY: 40, gapH: 80 });
    step(blocked, 1 / 60);
    assert.equal(blocked.phase, "dead");

    const clear = launch();
    const passed = gate(clear, { x: clear.scroll, side: "down", lip: 24 });
    step(clear, 1 / 60);
    assert.equal(clear.phase, "play");
    assert.equal(passed.passed, true);
    assert.equal(clear.passChime, true);
  });

  it("marks fifty yards, then the purse, then the pier record", () => {
    const run = launch();
    run.scroll = 46 * PX_PER_M;
    hold(run);
    step(run, 1 / 60);
    assert.equal(run.mark, "46");
    assert.equal(run.mark46, true);
    assert.equal(run.mark100, false);

    run.scroll = 100 * PX_PER_M;
    hold(run);
    step(run, 1 / 60);
    assert.equal(run.mark, "100");

    run.scroll = 206 * PX_PER_M;
    hold(run);
    step(run, 1 / 60);
    assert.equal(run.mark, "206");
    assert.ok(run.metres >= 206);
  });

  it("caps speed on the hard course", () => {
    const run = launch("hard");
    run.scroll = 50_000;
    hold(run);
    const before = run.scroll;
    step(run, 1 / 60);
    const gained = run.scroll - before;
    assert.ok(gained <= COURSES.hard.maxSpeed / 60 + 0.001);
    assert.ok(gained > COURSES.hard.baseSpeed / 60);
  });

  it("uses one-sided hazards on easy and gates on hard", () => {
    for (const difficulty of ["easy", "hard"] as const) {
      const run = launch(difficulty);
      for (let i = 0; i < 240; i++) {
        hold(run);
        step(run, 1 / 60);
      }
      assert.ok(run.gates.length > 0);
      for (const hazard of run.gates) {
        assert.equal(hazard.side, difficulty === "hard" ? "both" : hazard.side);
        assert.notEqual(hazard.side, difficulty === "easy" ? "both" : "nope");
        assert.equal(hazard.w, difficulty === "hard" ? 54 : 48);
      }
    }
  });
});

describe("resetRun", () => {
  it("clears the distance and lines up the first hazard for that course", () => {
    const run = launch("easy");
    run.scroll = 800;
    run.metres = 40;
    run.paused = true;
    resetRun(run, "ready");
    assert.equal(run.phase, "ready");
    assert.equal(run.metres, 0);
    assert.equal(run.scroll, 0);
    assert.equal(run.gates.length, 0);
    assert.equal(run.nextX, COURSES.easy.firstGate);
    assert.equal(run.paused, false);
  });
});

describe("epitaph", () => {
  it("names the distance bands", () => {
    assert.equal(epitaph(0).title, "Splash");
    assert.equal(epitaph(12).title, "Off the pier");
    assert.equal(epitaph(46).title, "Fifty-yard line");
    assert.equal(epitaph(100).title, "Purse distance");
    assert.equal(epitaph(206).title, "Past the pier record");
  });
});
