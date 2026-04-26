# Phase C Guided Test Run Order

This is a fast, deterministic manual test flow for the current RTS build.
Follow in order and mark pass/fail.

## Pre-Run

1. Start app and enter gameplay.
2. Keep HUD visible.
3. Note initial values:
   - resources
   - age
   - population
   - mission status
   - AI plan

Expected:
- No crash on load.
- Mission tracker visible.
- Camera controls responsive.

## Pass 1: Economy + Build Controls (3-5 min)

1. Left-click ground 3 times (far apart) -> places farms.
2. Shift+click ground 2 times -> places houses.
3. Alt+click ground 2 times -> places mines.
4. Wait 20-30 seconds.

Expected:
- Food increases steadily from farms + villagers.
- Gold increases from mine/town center + villagers.
- Population cap increases by +5 per house.
- No resource goes negative.

## Pass 2: Unit Production + Population Rules (2-4 min)

1. Select player building (town center).
2. Queue villagers until near cap.
3. Queue warriors.
4. Try queueing when at cap.
5. Build one more house and queue again.

Expected:
- Buttons disable when unaffordable.
- At cap, training blocks and HUD warns.
- After new house, training resumes.
- Queue progress percentages move correctly.

## Pass 3: Combat Pacing + Counter Feel (4-6 min)

1. Let AI spawn 2-3 waves.
2. Move player army to engage using right-click.
3. Observe clumped fights and HP bars.
4. Focus enemy town center with multiple units.

Expected:
- No instant unit wipes in one volley.
- Counter interactions are noticeable.
- Building damage is slower than unit damage.
- Enemy pressure rises but remains playable.

## Pass 4: Age Progression + Scaling (4-8 min)

1. Advance through ages as resources allow.
2. At each age, check unit button costs.
3. Train at least 1 new warrior per age.
4. Compare new warrior effectiveness.

Expected:
- Age-up blocked until costs met.
- Age-up succeeds and updates HUD text.
- Warrior scaling matches stronger later-age output.
- Costs increase by age as shown in HUD.

## Pass 5: Mission Validation (5-10 min)

### Survival
1. Keep mission as survival.
2. Survive until 10 waves.

Expected:
- Tracker reaches `10/10`.
- Status flips to `success`.
- Reward applied once.

### Conquest
1. Switch mission to conquest (if exposed in your current debug flow).
2. Destroy enemy town center.

Expected:
- `Enemy TC HP` reaches destroyed state.
- Status flips to `success`.

### Economy
1. Switch mission to economy.
2. Reach 1000 gold before 300s.

Expected:
- Success before timeout, fail after timeout if below target.

## Pass 6: Regression Sweep (2-4 min)

1. Drag-select multiple units.
2. Right-click move command.
3. Rally point set from selected building.
4. Check minimap updates.
5. Check fog-of-war reveal behavior while moving.

Expected:
- Input behavior stays stable.
- No frame-stutter spikes from repeated commands.
- Fog/minimap still synced to camera and unit movement.

## Failure Logging Template

Use this format for each issue:

- Step:
- Expected:
- Actual:
- Severity: blocker/high/medium/low
- Repro frequency:
- Screenshot/video:

## Exit Criteria

Ready for sign-off when:
- No blockers
- No high-severity economy/combat bugs
- Mission success/fail logic verified
- Controls + HUD feedback verified
