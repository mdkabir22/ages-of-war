# Phase C QA Checklist

Use this checklist to validate final gameplay quality before release candidates.

## 1) Core Loop Sanity

- [ ] Start a fresh match and verify no runtime errors.
- [ ] Place `farm`, `house`, and `mine` using click modifiers.
- [ ] Confirm resources change every second from economy tick.
- [ ] Confirm villager auto-gather increases economy over time.

## 2) Economy and Population

- [ ] Verify `house` increases population cap by +5.
- [ ] Train units until cap is reached, then confirm training blocks.
- [ ] Build another house and verify training unlocks again.
- [ ] Verify mine-heavy setups do not produce runaway gold too quickly.

## 3) Combat and Balance

- [ ] Spawn mixed armies and verify counter relationships feel correct.
- [ ] Verify units do not instantly delete each other in clumped fights.
- [ ] Verify buildings take sustained damage and do not melt too fast.
- [ ] Verify enemy wave pressure scales without impossible spikes.

## 4) Age Progression

- [ ] Progress through Stone -> Bronze -> Iron -> Medieval -> Modern.
- [ ] Confirm age-up costs are enforced.
- [ ] Confirm warrior damage scales by age formula.
- [ ] Confirm training costs shown in HUD match behavior.

## 5) Mission System

- [ ] Survival: mission reaches success at 10 waves.
- [ ] Conquest: mission reaches success when enemy Town Center is destroyed.
- [ ] Economy: mission succeeds before 5 minutes at 1000 gold.
- [ ] Economy: mission fails if timer exceeds 5 minutes without target.

## 6) UX Validation

- [ ] HUD labels are readable at normal resolution.
- [ ] Mission tracker status updates in real time.
- [ ] AI plan indicator changes over match flow.
- [ ] Control hints match actual controls.

## 7) Regression Smoke

- [ ] Fog of war still reveals and obscures correctly.
- [ ] Minimap still renders units/buildings/viewport.
- [ ] Right-click commands still move selected units / set rally point.
- [ ] No linter errors after final polish edits.
