# Mahden Saleh — Software Engineer Portfolio

A fast, responsive, accessible portfolio site built with **plain HTML, CSS, and JavaScript** — no frameworks, no build step, nothing to install. Served by **GitHub Pages** directly from this repository's `main` branch.

**Live site:** https://smahden.github.io/

> This is the deployed copy of [smahden/Portfolio](https://github.com/smahden/Portfolio) — make content edits there (or here, and mirror them) so the two stay in sync.

## Features

- 🗂 Portfolio covering five disciplines — ML & AI, software engineering, front end, back end, and cybersecurity — filterable in place and deep-linkable (`?focus=security`)
- 🖼 Every project card carries a real screenshot of the project running
- 🌗 Dark/light theme with system-preference detection and persistence
- 📱 Fully responsive (mobile menu, fluid type, grid layouts)
- ♿ Accessible: semantic HTML, skip link, keyboard navigation, reduced-motion support
- ⚡ Zero dependencies — loads instantly, easy to maintain
- 🚀 CI/CD: every project's test suite runs on push, and the site auto-deploys to GitHub Pages

## Project structure

```
├── index.html                    # All page content (edit your info here)
├── styles.css                    # Theme, layout, responsive styles
├── script.js                     # Theme toggle, mobile menu, project filtering
├── cv.pdf                        # Downloadable résumé
├── resume/Mahden_Saleh_Resume.md # Editable résumé source
├── assets/covers/                # SVG covers for projects without a live UI
├── projects/                     # Six complete, tested projects ↓
│   ├── recolab/                  # ML & AI     — recommender, 56 pytest tests
│   ├── sentinel/                 # Security    — audit toolkit, 90 pytest tests
│   ├── uikit/                    # Front End   — a11y components, 27 Playwright tests
│   ├── taskflow/                 # Software Eng — Kanban app, 22 Jest tests
│   ├── shoplite/                 # Back End    — e-commerce API, 22 pytest tests
│   └── devmetrics/               # Front End   — GitHub analytics, zero deps
├── scripts/split-projects.sh     # Promote each project to its own GitHub repo
└── .github/workflows/            # deploy.yml (Pages) + ci.yml (all five test suites)
```

## The projects

Nine portfolio entries across five disciplines. Six are complete applications in `projects/`, each self-contained with its own README, test suite, `.gitignore`, and CI workflow:

| Project | Track | Stack | Tests | Live |
|---|---|---|---|---|
| **RecoLab** | 🧠 ML & AI | Python (stdlib only), JS | 56 pytest | [demo](projects/recolab/web/) |
| **Sentinel** | 🛡️ Cybersecurity | Python (stdlib only) | 90 pytest | [sample report](projects/sentinel/docs/report.html) |
| **UIKit** | 🎨 Front End | JavaScript, ARIA | 27 Playwright | [demo](projects/uikit/) |
| **TaskFlow** | ⚙️ Software Engineering | Node, Express, SQLite | 22 Jest | — |
| **ShopLite** | 🗄️ Back End | FastAPI, SQLAlchemy | 22 pytest | — |
| **DevMetrics** | 🎨 Front End | Vanilla JS, GitHub API | browser-verified | [demo](projects/devmetrics/) |

**195 tests in total**, all run by the root CI workflow on every push.

Two further entries — **IDA** (thesis) and the **Employee Management System** (ToonCity internship) — are described on the site with SVG covers rather than screenshots, since their source is not public.

The site's Portfolio section filters by discipline, and the filter is deep-linkable: `?focus=security` opens it pre-filtered, which is useful when applying to a role in one specific area.

**To give each project its own GitHub repository** (separate repos look better on a profile): install the [GitHub CLI](https://cli.github.com), run `gh auth login`, then:

```bash
./scripts/split-projects.sh
```

Each new repo ships its own CI workflow and goes green on the first push. Afterwards, point the `Code ↗` links in `index.html` at the new repo URLs.

## Keeping it up to date

All content lives in plain HTML in `index.html` (experience, education, certifications, and projects are real, synced from smahden.github.io). When something changes:

- **New job or project** — add a timeline item or project card in `index.html`, and mirror it in `resume/Mahden_Saleh_Resume.md`.
- **Résumé** — `cv.pdf` at the repo root is the canonical download; the Markdown copy in `resume/` is the editable source.
- **Splitting projects into their own repos** — run `./scripts/split-projects.sh`, then point the `Code ↗` links at the new repos.

## Local preview

No build step — just open the file, or serve it:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```
