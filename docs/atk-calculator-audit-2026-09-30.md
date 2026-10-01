# ATK calculator audit: LR Super Saiyan 3 Goku

Audit date: 2026-09-30  
Scope: DokkanStats comparison for card 1034201, Unit Super Attack **Cooperation Between Rivals**. Investigation only; no calculator code changed.

## Reproduction

- Local: `http://127.0.0.1:4173/calculator.html?card=1034201`
- Reference calculator: <https://dokkanstats.com/en/atkcalculator/1034201>
- Reference card details: <https://dokkanstats.com/en/cards/1034201>
- Card: INT LR Super Saiyan 3 Goku, 100% build, non-EZA. Card details list 100% ATK 19,850. The card JSON lists maximum ATK 14,850 and the Unit SA text/condition.
- Locally select Unit SA #1, **Cooperation Between Rivals**. Its condition requires 18+ Ki and a same-turn ally whose name includes Vegeta, with listed exclusions. The user confirmed this is the intended effect; the condition is treated as satisfied in both runs.
- Comparison settings: 100% build, dual 220% leader skills, six active ATK links at Lv. 10 (+75% total), 24 Ki, active skill off, no support memory, zero prior SA stacks, the 24-Ki ATK +200% condition and attack additional enabled, and the “For every attack performed” passive set to three stacks. The Unit SA ally condition is treated as satisfied.
- DokkanStats’ result row only says `Unit SA`; its detail pane lists both conditional Unit SAs and does not name which one produced the generic result. Cooperation Between Rivals is first in the card’s attack list, so the reference output is a scenario match, not proof of the selected branch.

## Observations

The Unit SA text contains three target-specific effects: Goku gets ATK +100% infinitely and ATK +100% for one turn; allies get ATK +39% and DEF +39% for one turn, with Goku excluded. DokkanStats’ card page shows those as separate `SELF Infinite`, `SELF 1 Turn`, and two `ALLIES 1 Turn` entries. The +39% clauses therefore do not apply to Goku’s own ATK.

The local `parseSaEffect` in `js-calc/calc-ui.js:310` returns one scalar ATK value. For this text it resolves to +100%, so it cannot represent both self raises. `calculateDokkanStats` uses that value for the selected Unit SA in `js-calc/calc-engine.js:717-742`. The visible local ATK effect field is +100%, while the reference card details list both self effects.

There is a second multiplier discrepancy to resolve before attributing the whole output gap to the missing raise. The card is not EZA and its card details show a 470% Unit SA multiplier at SA Lv. 20. The local Unit SA row defaults to **EZA Mega-Colossal (590% base)**: `js-calc/calc-card-loader.js:1637-1638` assigns 590 to every LR Unit Ultra SA at 18+ Ki, regardless of `isEZA`, and ignores this card record’s `exact_multiplier` value (440). The runtime output labels the resulting total as 795% after its other bonuses. The exact card-data-to-calculator multiplier convention needs to be verified before changing that branch.

DokkanStats’ attack calculator displays `Unit ATK: 21,950` after computing the result, but its card details list the 100% stat as 19,850. The local calculator’s card-derived 100% ATK is 19,850. This audit matched the calculators’ displayed input numerically by temporarily overriding the local base ATK to 21,950; the local input was restored to 19,850 after the comparison.

| “For every attack performed” stacks | DokkanStats Unit SA | Local Unit Ultra SA at base ATK 21,950 | Difference |
| ---: | ---: | ---: | ---: |
| 0 | 37,088,037 | 39,577,167 | Local +6.71% |
| 3 | 74,176,074 | 69,260,018 | Local −6.63% |

Percentages are relative to DokkanStats and rounded to two decimals. The three-stack output is 2× the reference’s zero-stack output; the local output rises by about 1.75×. That sensitivity difference, plus the multiplier discrepancy, means the output gap cannot be isolated to just the second ATK raise yet.

## Follow-up candidate

Narrow regression case: parse `Massively raises ATK, further massively raises ATK for 1 turn and causes mega-colossal damage...` into two self-targeted ATK effects (+100% infinite and +100% one turn), while excluding the later allies-only +39% ATK/DEF from Goku’s own stat. Separately verify the non-EZA LR Unit SA multiplier mapping against the card’s SA level and `exact_multiplier` data. Re-run both calculators with the same numeric base ATK, links, leaders, Ki, and passive-stack settings before adjusting the calculator.

GitNexus was queried, but its index is dated 2026-09-27 and behind the current checkout by seven commits. Refresh was attempted and could not complete in this environment, so this investigation used direct source inspection for these findings. No tests were run; this markdown audit is the only file added, and no calculator code was changed.
