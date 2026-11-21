# Backend issue migration

All 30 issues from the archived `pirlouix-dev/PDLS-webapp-back` repository were
transferred into this repository. Open/closed state, labels and comments were
preserved. Each transferred issue has a comment pointing at its original
backend number.

Frontend issues kept their numbers; only backend issues were renumbered.

| Backend | Monorepo |
|---|---|
| #1 | #161 |
| #2 | #162 |
| #3 | #163 |
| #4 | #164 |
| #5 | #165 |
| #6 | #166 |
| #7 | #167 |
| #8 | #168 |
| #9 | #169 |
| #26 | #170 |
| #27 | #171 |
| #28 | #172 |
| #29 | #173 |
| #30 | #174 |
| #31 | #175 |
| #34 | #176 |
| #37 | #177 |
| #38 | #178 |
| #39 | #179 |
| #40 | #180 |
| #41 | #181 |
| #42 | #182 |
| #43 | #183 |
| #45 | #184 |
| #46 | #185 |
| #56 | #160 |
| #58 | #186 |
| #64 | #187 |
| #65 | #188 |
| #67 | #189 |

## Reference caveat

Commit messages written before the migration use shorthand references such as
`(#56)` or `(#58)`. Inside the monorepo those resolve to whichever issue or pull
request owns that number here, which is usually a frontend issue, not the
historical backend issue. Use this table when reading imported backend history.

Backend pull requests and releases were not transferred; they remain in the
archived backend repository.
