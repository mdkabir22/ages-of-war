# Ages of War - Game Design Document

## 1. Vision
- Genre: 2D strategy game (real-time).
- Target: mobile-first playability with short sessions and strategic depth.
- Pillars: age progression, resource economy, building choices, army counters.

## 2. Core Loop
1. Gather resources (Food, Wood, Stone, Gold).
2. Build and upgrade economy/military structures.
3. Train units and control lanes/frontlines.
4. Advance to next age through tech and economy milestones.
5. Destroy enemy castle or win via age-advancement objective (mode dependent).

## 3. Perspective and Presentation
- Camera: top-down 2D (planned evolution from current side-lane combat).
- Rendering: HTML5 Canvas with optimization (culling, pooling, batching roadmap).
- UI: HUD-first strategy interface (resources top bar, actions bottom panel, minimap planned).

## 4. Ages and Progression
- Stone Age (Tribal)
- Bronze Age (City Building)
- Iron Age (Empire)
- Medieval (Castles)
- Industrial (Factories)
- Modern (Tanks/Air)

Each age defines:
- Unit roster
- Building unlocks
- Economy multipliers
- Tech tree branches

## 5. Resources
- Food: population support and basic unit training.
- Wood: construction and ranged infrastructure.
- Stone: fortifications and defensive upgrades.
- Gold: advanced units, elite upgrades, age transitions.

## 6. Buildings
- Town Center
- Barracks
- Farm
- Mine
- Temple
- Blacksmith

System rules:
- Build time
- Hit points / armor
- Upgrade levels
- Production queues

## 7. Units
- Villager
- Warrior
- Archer
- Cavalry
- Siege

Combat goals:
- Clear rock-paper-scissors counters
- Frontline/backline logic
- Ability cooldown windows

## 8. Modes
- Campaign (scripted progression and objectives)
- Skirmish (custom AI matches)
- Endless (survival scaling)

## 9. Win Conditions
- Primary: destroy enemy castle.
- Alternate: age advancement victory (configurable mode rules).

## 10. Technical Foundations
- State: Zustand
- Routing: `/`, `/menu`, `/game`, `/settings`, `/profile`
- Offline: localforage
- PWA: service worker + manifest
- Telemetry: Sentry + analytics

## 11. Non-Goals (Current Milestone)
- Full multiplayer
- Deterministic lockstep netcode
- Procedural map editor

## 12. Milestone Definition of Done
- Economy + buildings + tech tree integrated in playable flow.
- AI executes at least 2 distinct strategic personalities.
- Campaign tutorial can teach complete loop in 10 minutes.
