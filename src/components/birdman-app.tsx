import { useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { drawScene, type Art } from "@/game/draw";
import { createRun, epitaph, flap, resetRun, step, type Difficulty, type FlyerId, type Phase, type WingId } from "@/game/run";
import condorUrl from "@/assets/sprites/condor.png";
import penguinUrl from "@/assets/sprites/penguin.png";
import leonardoUrl from "@/assets/sprites/leonardo.png";
import balsaUrl from "@/assets/sprites/wing-balsa.png";
import gullUrl from "@/assets/sprites/wing-gull.png";
import carnivalUrl from "@/assets/sprites/wing-carnival.png";
import deckchairUrl from "@/assets/sprites/wing-deckchair.png";
import columnUrl from "@/assets/sprites/column.png";
import groyneUrl from "@/assets/sprites/groyne.png";
import boatUrl from "@/assets/sprites/boat.png";
import balloonsUrl from "@/assets/sprites/balloons.png";
import rampUrl from "@/assets/sprites/ramp.png";
import panoramaUrl from "@/assets/sprites/panorama.png";
import skyUrl from "@/assets/sprites/sky.png";
import seaUrl from "@/assets/sprites/sea.png";
import chickUrl from "@/assets/sprites/chick.png";
import swanUrl from "@/assets/sprites/swan.png";
import hawkUrl from "@/assets/sprites/hawk.png";

const SAVE_KEY = "birdman-bognor-v1";

const FLYERS: { id: FlyerId; name: string; note: string; src: string }[] = [
  { id: "condor", name: "Condor", note: "Helmet and goggles", src: condorUrl },
  { id: "penguin", name: "Kingfisher", note: "Fancy dress", src: penguinUrl },
  { id: "leonardo", name: "Leonardo", note: "Home workshop", src: leonardoUrl },
];

const WINGS: { id: WingId; name: string; note: string; src: string }[] = [
  { id: "balsa", name: "Balsa & canvas", note: "Spar and cloth", src: balsaUrl },
  { id: "gull", name: "Herring gull", note: "Channel feathers", src: gullUrl },
  { id: "carnival", name: "Carnival", note: "Fairground wing", src: carnivalUrl },
  { id: "deckchair", name: "Deckchair", note: "Seaside stripes", src: deckchairUrl },
];

const ART_URLS: Record<keyof Art, string> = {
  condor: condorUrl,
  penguin: penguinUrl,
  leonardo: leonardoUrl,
  balsa: balsaUrl,
  gull: gullUrl,
  carnival: carnivalUrl,
  deckchair: deckchairUrl,
  column: columnUrl,
  groyne: groyneUrl,
  boat: boatUrl,
  balloons: balloonsUrl,
  ramp: rampUrl,
  panorama: panoramaUrl,
  sky: skyUrl,
  sea: seaUrl,
};

type Save = { best: number; flyer: FlyerId; wings: WingId; muted: boolean; difficulty: Difficulty };

function isFlyer(v: unknown): v is FlyerId {
  return v === "condor" || v === "penguin" || v === "leonardo";
}
function isWing(v: unknown): v is WingId {
  return v === "balsa" || v === "gull" || v === "carnival" || v === "deckchair";
}
function isDifficulty(v: unknown): v is Difficulty {
  return v === "easy" || v === "medium" || v === "hard";
}

function readSave(): Save | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Save>;
    if (!isFlyer(p.flyer) || !isWing(p.wings) || typeof p.best !== "number") return null;
    return {
      best: Math.max(0, Math.floor(p.best)),
      flyer: p.flyer,
      wings: p.wings,
      muted: Boolean(p.muted),
      difficulty: isDifficulty(p.difficulty) ? p.difficulty : "medium",
    };
  } catch {
    return null;
  }
}

function loadArt(): Promise<Art> {
  const entries = Object.entries(ART_URLS) as [keyof Art, string][];
  return Promise.all(
    entries.map(
      ([key, url]) =>
        new Promise<[keyof Art, HTMLImageElement]>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            const done = () => resolve([key, img]);
            if (typeof img.decode === "function") img.decode().then(done).catch(done);
            else done();
          };
          img.onerror = () => reject(new Error(key));
          img.src = url;
        }),
    ),
  ).then((pairs) => {
    const art = {} as Art;
    for (const [key, img] of pairs) art[key] = img;
    return art;
  });
}

function makeAudio() {
  let ctx: AudioContext | null = null;
  const ac = () => {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  };
  const tone = (freq: number, dur: number, type: OscillatorType, gain = 0.045, slide = 0) => {
    const c = ac();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, c.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(48, freq + slide), c.currentTime + dur);
    g.gain.setValueAtTime(gain, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start();
    o.stop(c.currentTime + dur + 0.02);
  };
  return {
    unlock: () => ac(),
    flap: () => tone(620, 0.07, "square", 0.04, 160),
    gate: () => tone(860, 0.07, "square", 0.03),
    die: () => {
      tone(210, 0.24, "sawtooth", 0.045, -130);
      tone(88, 0.32, "triangle", 0.04);
    },
    mile: () => {
      tone(523, 0.08, "square", 0.04);
      window.setTimeout(() => tone(784, 0.12, "square", 0.04), 90);
    },
  };
}

const LEVELS: { id: Difficulty; name: string; bird: string; note: string; src: string }[] = [
  {
    id: "easy",
    name: "Easy",
    bird: "Easy",
    note: "Slow. Hazards drop from the sky or rise from the sea, never both.",
    src: chickUrl,
  },
  {
    id: "medium",
    name: "Normal",
    bird: "Normal",
    note: "Quicker. A mix of single posts and gates you have to thread.",
    src: swanUrl,
  },
  {
    id: "hard",
    name: "Hard",
    bird: "Hard",
    note: "Fast and tight. Every obstacle is a gate. Fly the gap.",
    src: hawkUrl,
  },
];

const MARK_COPY: Record<"46" | "100" | "206", string> = {
  "46": "Fifty-yard line",
  "100": "Hundred metres",
  "206": "Pier record",
};

export function BirdmanApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const shownMetres = useRef(0);
  const [metres, setMetres] = useState(0);
  const [phase, setPhase] = useState<Phase>("hangar");
  const [flyer, setFlyer] = useState<FlyerId>("condor");
  const [wings, setWings] = useState<WingId>("balsa");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [best, setBest] = useState(0);
  const [muted, setMuted] = useState(false);
  const [finalMetres, setFinalMetres] = useState(0);
  const [banner, setBanner] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [booting, setBooting] = useState(true);

  const flyerRef = useRef(flyer);
  const wingsRef = useRef(wings);
  const mutedRef = useRef(muted);
  const phaseRef = useRef(phase);
  const difficultyRef = useRef(difficulty);
  const bestRef = useRef(0);
  const saveSkip = useRef(true);
  const rampNow = useRef(false);
  const artRef = useRef<Art | null>(null);
  flyerRef.current = flyer;
  wingsRef.current = wings;
  mutedRef.current = muted;
  phaseRef.current = phase;
  difficultyRef.current = difficulty;

  useEffect(() => {
    let alive = true;
    const saved = readSave();
    if (saved) {
      bestRef.current = saved.best;
      flyerRef.current = saved.flyer;
      wingsRef.current = saved.wings;
      mutedRef.current = saved.muted;
      difficultyRef.current = saved.difficulty;
      setBest(saved.best);
      setFlyer(saved.flyer);
      setWings(saved.wings);
      setMuted(saved.muted);
      setDifficulty(saved.difficulty);
    }
    const wait = new Promise<void>((resolve) => window.setTimeout(resolve, 3000));
    Promise.all([loadArt().catch(() => null), wait]).then(([art]) => {
      if (!alive) return;
      if (art) artRef.current = art;
      setBooting(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (saveSkip.current) {
      saveSkip.current = false;
      return;
    }
    const record = Math.max(best, bestRef.current);
    bestRef.current = record;
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({ v: 1, best: record, flyer, wings, muted, difficulty } satisfies Save & { v: number }),
    );
  }, [best, flyer, wings, muted, difficulty]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;

    const run = createRun();
    const audio = makeAudio();
    let alive = true;
    let bannerTimer = 0;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ensureArt = () => {
      if (artRef.current) return;
      void loadArt().then((loaded) => {
        if (alive) artRef.current = loaded;
      });
    };

    const resize = () => {
      const rect = stage.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(stage);

    const publish = () => {
      const m = Math.floor(run.metres);
      if (m !== shownMetres.current) {
        shownMetres.current = m;
        setMetres(m);
      }
      if (run.phase !== phaseRef.current) {
        if (run.phase === "dead") {
          setFinalMetres(m);
          setBest((prev) => {
            const next = Math.max(prev, bestRef.current, m);
            bestRef.current = next;
            return next;
          });
          if (!mutedRef.current) audio.die();
        }
        phaseRef.current = run.phase;
        setPhase(run.phase);
      }
      if (run.passChime) {
        run.passChime = false;
        if (!mutedRef.current) audio.gate();
      }
      if (run.mark) {
        const text = MARK_COPY[run.mark];
        run.mark = null;
        setBanner(text);
        if (!mutedRef.current) audio.mile();
        window.clearTimeout(bannerTimer);
        bannerTimer = window.setTimeout(() => setBanner(null), 1600);
      }
    };

    const pauseRun = () => {
      if (run.paused) return;
      if (run.phase !== "play" && run.phase !== "ready") return;
      run.paused = true;
      run.acc = 0;
      setPaused(true);
    };
    const resumeRun = () => {
      if (!run.paused) return;
      run.paused = false;
      run.acc = 0;
      setPaused(false);
    };
    const quitRun = () => {
      run.paused = false;
      run.acc = 0;
      setPaused(false);
      if (run.phase === "hangar" || run.phase === "title") return;
      resetRun(run, "hangar");
      publish();
    };

    const doFlap = () => {
      audio.unlock();
      const before = run.phase;
      if (run.paused || before === "hangar" || before === "title") return;
      if (!mutedRef.current && before !== "dead") audio.flap();
      flap(run);
      if (before === "dead" && !mutedRef.current) audio.flap();
      publish();
    };

    const onPointer = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (target?.closest("[data-ui]")) return;
      if (run.paused) return;
      stage.focus({ preventScroll: true });
      doFlap();
    };
    const onKey = (event: KeyboardEvent) => {
      const esc = event.key === "Escape" || event.code === "Escape";
      if (esc || event.code === "KeyP") {
        if (event.repeat) return;
        event.preventDefault();
        event.stopPropagation();
        if (esc) {
          if ((run.phase === "play" || run.phase === "ready") && !run.paused) pauseRun();
          else if (run.phase !== "title") quitRun();
          return;
        }
        if (run.paused) resumeRun();
        else pauseRun();
        return;
      }
      if (run.paused) return;
      if (event.code !== "Space" && event.code !== "ArrowUp" && event.code !== "KeyW") return;
      if (event.repeat) return;
      if (event.code === "Space" || event.code === "ArrowUp") event.preventDefault();
      const target = event.target as Element | null;
      if (target?.closest("button, a, input, [data-ui]")) return;
      doFlap();
    };

    stage.tabIndex = 0;
    stage.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey, true);

    let last = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!document.hidden) {
        step(run, reduce ? Math.min(dt, 0.02) : dt);
        publish();
      }
      const ctx = canvas.getContext("2d");
      if (ctx) drawScene(ctx, canvas, run, artRef.current, flyerRef.current, wingsRef.current, reduce);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const onVis = () => {
      last = performance.now();
      if (!document.hidden) audio.unlock();
    };
    document.addEventListener("visibilitychange", onVis);

    const api = {
      begin: (level: Difficulty) => {
        run.difficulty = level;
        run.paused = false;
        setPaused(false);
        resetRun(run, "hangar");
        publish();
      },
      ramp: () => {
        ensureArt();
        setBest(bestRef.current);
        run.difficulty = difficultyRef.current;
        run.paused = false;
        setPaused(false);
        resetRun(run, "ready");
        publish();
      },
      hangar: () => {
        run.paused = false;
        setPaused(false);
        resetRun(run, "hangar");
        publish();
      },
      pause: () => {
        if (run.paused) resumeRun();
        else pauseRun();
      },
      quit: quitRun,
      flap: doFlap,
    };
    (window as unknown as { __birdman?: typeof api }).__birdman = api;
    if (rampNow.current) {
      rampNow.current = false;
      api.ramp();
    }

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      observer.disconnect();
      stage.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("visibilitychange", onVis);
      window.clearTimeout(bannerTimer);
      delete (window as unknown as { __birdman?: typeof api }).__birdman;
    };
  }, []);

  const words = epitaph(finalMetres);

  return (
    <main className="shell flex h-dvh w-full bg-ink text-cream">
      <aside className="hidden w-80 shrink-0 flex-col justify-between border-r border-cream/15 p-8 lg:flex">
        <div>
          <p className="text-xs text-sand">Bognor Regis Pier</p>
          <h1 className="mt-3 text-2xl leading-tight">Birdman</h1>
          <p className="mt-4 text-sm leading-relaxed text-cream/80">
            From 1971 to 2016, homemade flyers ran a ramp off this pier and tried to stay up over the
            Channel. Condor, Leonardo, and Kingfisher were the classes.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-cream/80">
            The wings are costume. Every set has the same glide. Tap or press space to climb.
          </p>
        </div>
        <dl className="text-sm leading-relaxed text-cream/75">
          <div className="flex justify-between gap-4 border-t border-cream/15 py-2">
            <dt>Fifty yards</dt>
            <dd className="text-sand">46 m</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-cream/15 py-2">
            <dt>Prize line</dt>
            <dd className="text-sand">100 m</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-cream/15 py-2">
            <dt>Pier record</dt>
            <dd className="text-sand">206 m</dd>
          </div>
        </dl>
      </aside>

      <div className="flex min-w-0 flex-1 items-center justify-center">
        <div ref={stageRef} tabIndex={0} className="stage relative overflow-hidden bg-sea outline-none">
          <canvas ref={canvasRef} className="absolute inset-0 z-0 h-full w-full" />
          <div className="pointer-events-none absolute inset-0 z-10">
            <header className="pointer-events-none relative z-30 grid grid-cols-3 items-start p-3">
              <div className="justify-self-start">
                {phase === "play" || phase === "ready" ? (
                  <button
                    type="button"
                    data-ui
                    className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full bg-ink/80 text-cream"
                    aria-label={paused ? "Resume" : "Pause"}
                    aria-pressed={paused}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      window.__birdman?.pause();
                    }}
                  >
                    {paused ? <Play size={18} /> : <Pause size={18} />}
                  </button>
                ) : null}
              </div>
              <div className="text-center">
                <p className="text-xs text-sand-deep">{LEVELS.find((level) => level.id === difficulty)?.name}</p>
                <p className="text-xl text-sand-deep">{metres} m</p>
              </div>
              <div className="justify-self-end">
                {phase === "play" || phase === "ready" ? (
                  <button
                    type="button"
                    data-ui
                    className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full bg-ink/80 text-cream"
                    aria-label={muted ? "Unmute" : "Mute"}
                    aria-pressed={muted}
                    onClick={() => setMuted((m) => !m)}
                  >
                    {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                  </button>
                ) : null}
              </div>
            </header>

            {phase === "hangar" ? null : (
              <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center">
                <span className="bg-ink px-2 py-1 text-xs text-cream">
                  best <span className="text-sand">{Math.max(best, bestRef.current)} m</span>
                </span>
              </p>
            )}

            {paused && (phase === "play" || phase === "ready") ? (
              <section
                data-ui
                className="pointer-events-auto absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-ink/80 px-6"
              >
                <h2 className="text-lg text-sand">Paused</h2>
                <p className="text-center text-sm leading-relaxed text-cream/80">
                  Esc leaves this flight. The ramp is still there.
                </p>
                <button
                  type="button"
                  className="mt-2 h-12 w-full max-w-xs rounded-lg bg-buoy text-sm text-ink"
                  onClick={() => window.__birdman?.pause()}
                >
                  Resume
                </button>
                <button
                  type="button"
                  className="h-12 w-full max-w-xs rounded-lg border border-cream/30 text-sm text-cream"
                  onClick={() => window.__birdman?.quit()}
                >
                  Quit
                </button>
              </section>
            ) : null}

            {banner ? (
              <p className="mt-2 text-center text-sm text-sand" role="status">
                {banner}
              </p>
            ) : null}

            {phase === "ready" ? (
              <div className="absolute inset-x-0 bottom-14 flex flex-col items-center gap-3 px-4">
                <p className="bg-ink/75 px-3 py-2 text-center text-sm text-cream">
                  Tap or space to leave the ramp
                </p>
                <button
                  type="button"
                  data-ui
                  className="pointer-events-auto h-11 px-4 text-sm text-cream underline decoration-sand"
                  onClick={() => window.__birdman?.hangar()}
                >
                  Back to the hangar
                </button>
              </div>
            ) : null}

            {phase === "hangar" ? (
              <section
                data-ui
                className="pointer-events-auto absolute inset-0 z-50 flex flex-col bg-ink/95 px-3 pt-4 pb-3"
              >
                <h2 className="text-sm leading-none text-sand">Difficulty</h2>
                <div className="mt-2 grid shrink-0 grid-cols-3 gap-1.5">
                  {LEVELS.map((level) => {
                    const on = difficulty === level.id;
                    return (
                      <button
                        key={level.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setDifficulty(level.id)}
                        className={`flex items-center gap-1 rounded-lg border px-1.5 py-1 ${
                          on ? "border-sand bg-sea/50" : "border-cream/20 bg-ink"
                        }`}
                      >
                        <img src={level.src} alt="" className="h-8 w-8 shrink-0 object-contain" />
                        <span className="text-xs leading-none">{level.name}</span>
                      </button>
                    );
                  })}
                </div>
                <h2 className="mt-3 text-sm leading-none text-sand">Choose a flyer</h2>
                <div className="mt-2 grid min-h-0 flex-1 grid-cols-3 gap-2">
                  {FLYERS.map((item) => {
                    const on = flyer === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setFlyer(item.id)}
                        className={`flex h-full min-h-11 flex-col items-center rounded-lg border px-1 py-2 ${
                          on ? "border-sand bg-sea/50" : "border-cream/20 bg-ink"
                        }`}
                      >
                        <span className="relative block min-h-0 w-full flex-1">
                          <img src={item.src} alt="" className="relative z-10 mx-auto h-full object-contain" />
                        </span>
                        <span className="mt-1 text-xs leading-none">{item.name}</span>
                        <span className="mt-1 text-[10px] leading-none text-cream/60">{item.note}</span>
                      </button>
                    );
                  })}
                </div>

                <h2 className="mt-3 text-sm leading-none text-sand">Wings, cosmetic only</h2>
                <div className="mt-2 grid shrink-0 grid-cols-2 gap-2">
                  {WINGS.map((item) => {
                    const on = wings === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setWings(item.id)}
                        className={`flex min-h-11 items-center gap-2 rounded-lg border px-2 py-1.5 text-left ${
                          on ? "border-sand bg-sea/50" : "border-cream/20 bg-ink"
                        }`}
                      >
                        <img src={item.src} alt="" className="h-7 w-12 shrink-0 object-contain" />
                        <span className="min-w-0">
                          <span className="block text-xs leading-none">{item.name}</span>
                          <span className="mt-1 block text-[10px] leading-none text-cream/60">{item.note}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[10px] leading-snug text-cream/70">
                  Same lift for every costume. The Channel does not care what you wore off the pier.
                </p>
                <button
                  type="button"
                  className="mt-2 h-12 w-full shrink-0 rounded-lg bg-buoy text-sm text-ink"
                  onClick={() => {
                    if (window.__birdman) window.__birdman.ramp();
                    else rampNow.current = true;
                  }}
                >
                  Take the ramp
                </button>
              </section>
            ) : null}

            {phase === "dead" ? (
              <section
                data-ui
                className="pointer-events-auto absolute inset-x-3 top-20 rounded-card border border-cream/20 bg-ink/92 p-4"
              >
                <h2 className="text-lg text-sand">{words.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-cream/80">{words.line}</p>
                <p className="mt-3 text-xl text-cream">{finalMetres} m</p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="h-12 rounded-lg bg-buoy text-sm text-ink"
                    onClick={() => window.__birdman?.flap()}
                  >
                    Fly again
                  </button>
                  <button
                    type="button"
                    className="h-12 rounded-lg border border-cream/30 text-sm text-cream"
                    onClick={() => window.__birdman?.hangar()}
                  >
                    Hangar
                  </button>
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </div>
      {phase === "title" ? (
        <div data-ui className="fixed inset-0 z-40 flex flex-col bg-ink text-cream">
          <div className="mx-auto flex w-full max-w-md flex-col px-4 py-5">
            <p className="text-xs text-sand">Bognor Regis Pier</p>
            <h1 className="mt-2 text-3xl leading-none">Birdman</h1>
            <p className="mt-3 text-sm leading-relaxed text-cream/80">
              Homemade wings off the pier. Tap or press space to climb. Pick how cruel the Channel is
              before you choose a flyer.
            </p>
            <h2 className="mt-4 text-sm leading-none text-sand">Difficulty</h2>
            <div className="mt-2 flex flex-col gap-1.5" role="radiogroup" aria-label="Difficulty">
              {LEVELS.map((level) => (
                <label
                  key={level.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-cream/20 bg-ink px-2 py-1.5 has-[:checked]:border-sand has-[:checked]:bg-sea/50"
                >
                  <input
                    type="radio"
                    name="course"
                    value={level.id}
                    defaultChecked={level.id === "medium"}
                    className="sr-only"
                    onChange={() => setDifficulty(level.id)}
                  />
                  <img src={level.src} alt="" className="h-10 w-10 shrink-0 object-contain" />
                  <span className="min-w-0">
                    <span className="block text-xs leading-none">
                      {level.name}
                      <span className="text-sand"> · {level.bird}</span>
                    </span>
                    <span className="mt-1 block text-xs leading-snug text-cream/70">{level.note}</span>
                  </span>
                </label>
              ))}
            </div>
            <button
              type="button"
              className="mt-3 h-12 w-full shrink-0 rounded-lg bg-buoy text-sm text-ink"
              onClick={() => {
                const picked = document.querySelector<HTMLInputElement>('input[name="course"]:checked');
                const level = isDifficulty(picked?.value) ? picked.value : difficulty;
                window.__birdman?.begin(level);
              }}
            >
              Enter the hangar
            </button>
          </div>
        </div>
      ) : null}
      {booting ? (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink px-6 text-cream">
          <p className="text-xs text-sand">Bognor Regis Pier</p>
          <h1 className="mt-2 text-3xl leading-none">Birdman</h1>
          <p className="mt-4 text-sm text-cream/80">Loading the pier</p>
          <div className="mt-4 h-2 w-48 overflow-hidden bg-cream/20">
            <div className="boot-bar h-full w-full bg-sand" />
          </div>
        </div>
      ) : null}
    </main>
  );
}

declare global {
  interface Window {
    __birdman?: {
      begin: (level: Difficulty) => void;
      ramp: () => void;
      hangar: () => void;
      pause: () => void;
      quit: () => void;
      flap: () => void;
    };
  }
}
