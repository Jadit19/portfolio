/**
 * The AstroClub route: a star chart of my projects with the Astronomy Club, IIT Kanpur.
 * Content is drawn from the READMEs under references/projects/astroclubiitk/.
 */

import type { Stop } from "./types";

export interface StarStop extends Stop {
  /** The star (or other sky object) this project is on the star chart. */
  star: string;
}

export const ASTRO_INTRO =
  "At the Astronomy Club, IIT Kanpur, I wrote the software, the courses and the competitions: a " +
  "solar-flare detector for ISRO's Inter IIT challenge that became a PyPI package, two summer " +
  "projects I mentored, a national case-study contest, and the club's 150-page wiki.";

const ORG = "https://github.com/astroclubiitk";

export const ASTRO_STOPS: StarStop[] = [
  {
    id: "astro/inter-iit-tech-meet-2022",
    title: "Inter IIT Tech Meet 2022: Solar X-ray Burst Detector",
    star: "Sol · the star behind every flare",
    tagline: "Automatic solar-flare detection on Chandrayaan-2 X-ray data",
    art: "inter-iit-tech-meet-2022",
    period: "Mar 2022",
    role: "Core team member",
    facts: [
      { label: "Event", value: "Inter IIT Tech Meet 10.0, ISRO problem" },
      { label: "Data", value: "Chandrayaan-2 XSM light curves" },
      { label: "Commits", value: "9 of 16, the most on the team" },
      { label: "Stack", value: "Python, Astropy, scikit-learn" },
    ],
    body: [
      {
        kind: "p",
        text:
          "ISRO asked the IITs for a system that finds solar flares in X-ray light curves from " +
          "the Solar X-ray Monitor on Chandrayaan-2. I wrote the moving-average min-max pipeline " +
          "that became JuX's main detection algorithm, and I owned and maintained the " +
          "repository. The team shipped it as an installable Python package with a live demo.",
      },
      {
        kind: "list",
        items: [
          "Reads XSM Level-2 FITS light curves and smooths each Good Time Interval on its own, " +
            "so data gaps never blur signals together.",
          "A six-level filter cascade pairs peaks with their starts, then prunes by slope, " +
            "height and spacing to find each flare's start, peak and end.",
          "Fits every decay with a stretched exponential, A·e^(−b·√t), to estimate the true end " +
            "time and a fit error.",
          "Rejects false positives with PCA and an Isolation Forest over five shape features.",
        ],
      },
    ],
    tech: ["Python", "Astropy", "SciPy", "scikit-learn", "pandas", "Signal processing"],
    links: [
      { label: "GitHub", href: `${ORG}/Inter-IIT-Tech-Meet-2022`, kind: "github" },
      { label: "Project site", href: "https://jux-tool.web.app", kind: "live" },
      {
        label: "Presentation and demo",
        href: "https://youtu.be/NgTuupeuetw?t=10710",
        kind: "video",
      },
    ],
  },
  {
    id: "astro/jux",
    title: "Jux",
    star: "Algol · the classic variable star",
    tagline: "A PyPI package for exoplanets and solar flares in light curves",
    art: "jux",
    period: "2022",
    facts: [
      { label: "Install", value: "pip install jux" },
      { label: "Release", value: "v1.0.0 on PyPI" },
      { label: "Commits", value: "7 of 8" },
      { label: "Data", value: "Chandrayaan-2 XSM, transit and RV sets" },
    ],
    body: [
      {
        kind: "p",
        text:
          "Jux is the club's official Python package for light curves, grown out of our Inter " +
          "IIT work and the XUVI summer project. I wrote the exoplanet subpackage, designed the " +
          "modular solar-flare pipeline, and packaged and documented it for PyPI. A few lines of " +
          "code take a raw Chandrayaan-2 file to a table of classified flares.",
      },
      {
        kind: "list",
        items: [
          "A Flares facade over three stages: Preprocessing, DetectFlares and ModelFlares, each " +
            "open for inspection and plotting.",
          "Fits the rise and decay of each flare and extrapolates both to background level to " +
            "estimate true start and end times.",
          "Assigns every flare a GOES-style A, B, C, M or X class with a decimal subclass.",
          "Finds several exoplanets in one radial-velocity signal by splitting its FFT into one " +
            "component per planet.",
          "Estimates planet radius, period and transit duration from transit photometry.",
        ],
      },
    ],
    tech: ["Python", "NumPy", "SciPy", "Astropy", "setuptools", "PyPI"],
    links: [
      { label: "GitHub", href: `${ORG}/jux`, kind: "github" },
      { label: "PyPI", href: "https://pypi.org/project/Jux/", kind: "pypi" },
    ],
  },
  {
    id: "astro/xuvi-2022",
    title: "XUVI (Summer Project 2022)",
    star: "HR 8799 · a star with imaged planets",
    tagline: "A 5-week computational astronomy course on real mission data",
    art: "xuvi-2022",
    period: "May–Jul 2022",
    role: "Mentor (one of three)",
    facts: [
      { label: "Format", value: "5-week mentored summer project" },
      { label: "Material", value: "11 notebooks, 5 lecture decks" },
      { label: "Commits", value: "26 of 28" },
      { label: "Data", value: "11 Chandrayaan-2 XSM light curves, K2" },
    ],
    body: [
      {
        kind: "p",
        text:
          "XUVI took mentees from Python basics to finding exoplanets and solar flares in real " +
          "space-mission data. As one of three mentors, I wrote every notebook in the course and " +
          "the object-oriented reference solutions. It carried our Inter IIT flare approach into " +
          "a teaching setting.",
      },
      {
        kind: "list",
        items: [
          "Recovered 4 exoplanets from one star's wobble, with mass, orbital radius and period " +
            "for each.",
          "Measured a planet's radius, 4.16-day period and transit time from K2 data for " +
            "EPIC 206103150.",
          "Built a flare pipeline on Chandrayaan-2 data that detects, models and classifies " +
            "flares on the A to X scale.",
          "Mentees also built a spectroscope from a cardboard box and a CD to observe the solar " +
            "spectrum.",
        ],
      },
    ],
    tech: ["Python", "NumPy", "SciPy", "Astropy", "Jupyter", "Teaching"],
    links: [{ label: "GitHub", href: `${ORG}/XUVI-2022`, kind: "github" }],
  },
  {
    id: "astro/blast-off-2022",
    title: "Blast Off! (Summer Project 2022)",
    star: "Altair · the flying eagle",
    tagline: "A rocketry course from rocket equations to a real launch",
    art: "blast-off-2022",
    period: "May–Jul 2022",
    role: "Lead mentor (one of three)",
    facts: [
      { label: "Mentees", value: "16 students over 5 weeks" },
      { label: "Optimiser", value: "Within 1.38% of a real mission's payload" },
      { label: "Launch", value: "Model rocket at the IIT Kanpur airstrip" },
      { label: "Commits", value: "26 of 26" },
    ],
    body: [
      {
        kind: "p",
        text:
          "Blast Off! taught 16 mentees how rockets are designed, flown and optimised, and ended " +
          "with a model rocket built and launched at the IIT Kanpur airstrip. As lead mentor I " +
          "ran the course repository end to end and wrote every reference solution. The " +
          "optimiser's best rocket came within 1.4% of a real mission's payload and cost.",
      },
      {
        kind: "list",
        items: [
          "Built a single-stage-to-orbit trajectory simulator from first principles, with thrust " +
            "curves, a gravity turn, atmosphere and drag.",
          "Wrote a multi-objective genetic algorithm that evolves 100 rockets to maximise " +
            "payload and minimise cost with Pareto sorting.",
          "Best design: 52,818 kg for 159.04 M$, against a real mission's 52,100 kg for 157.3 M$.",
          "Delivered 10 lectures, 5 assignments and a 37-page final report.",
          "Took it to hardware: an OpenRocket-optimised model with an altimeter and " +
            "accelerometer payload.",
        ],
      },
    ],
    tech: ["Python", "NumPy", "SciPy", "pygmo", "OpenRocket", "Genetic algorithms"],
    links: [
      { label: "GitHub", href: `${ORG}/Blast-Off-2022`, kind: "github" },
      { label: "Mentee submissions", href: "https://github.com/Jadit19/Blast-Off", kind: "github" },
    ],
  },
  {
    id: "astro/hyperion-2022",
    title: 'Hyperion 2022: "Dance of Heavenly Bodies"',
    star: "Mars · at opposition, Dec 2022",
    tagline: "A national case study on black-hole mergers and gravitational waves",
    art: "hyperion-2022",
    period: "Dec 2022",
    role: "Coordinator (one of four)",
    facts: [
      { label: "Format", value: "Pan-India case-study challenge" },
      { label: "Data", value: "3 detector streams × 10,000 samples" },
      { label: "Recovered masses", value: "37.33 and 28.0 M☉ (injected 36, 29)" },
      { label: "Commits", value: "8 of 8" },
    ],
    body: [
      {
        kind: "p",
        text:
          "Hyperion 2022 asked teams across India to work from orbital mechanics up to " +
          "gravitational waves, then weigh a binary black-hole merger from noisy detector data. " +
          "I coordinated the contest and wrote all of its code: the synthetic data generator and " +
          "the reference solution.",
      },
      {
        kind: "list",
        items: [
          "Generated a gravitational-wave chirp for a 36 + 29 solar-mass binary from " +
            "post-Newtonian physics, with realistic coloured noise.",
          "Simulated three detectors with different arrival times and one flipped polarity, so " +
            "teams had to align and stack the streams.",
          "The reference solution aligns, averages, extracts the envelope with a Hilbert " +
            "transform and fits the chirp model.",
          "A 7-question, 100-mark problem, from two-body motion to detector design.",
        ],
      },
    ],
    tech: ["Python", "NumPy", "SciPy", "pandas", "Signal processing"],
    links: [
      { label: "GitHub", href: `${ORG}/Hyperion-2022`, kind: "github" },
      {
        label: "Source paper",
        href: "https://arxiv.org/abs/1602.03837",
        kind: "docs",
      },
    ],
  },
  {
    id: "astro/hyperion-2021",
    title: 'Hyperion 2021: "Lightening up Dark Matter"',
    star: "Hyperion · a moon of Saturn",
    tagline: "A 48-hour national case study on measuring dark matter",
    art: "hyperion-2021",
    period: "Oct 2021",
    role: "Club secretary, organising team",
    facts: [
      { label: "Reach", value: "1,000+ students from 26+ institutes" },
      { label: "IITs", value: "23" },
      { label: "Format", value: "48-hour case study, teams of 1 to 3" },
      { label: "Based on", value: "A 2018 arXiv paper on dark matter" },
    ],
    body: [
      {
        kind: "p",
        text:
          "Hyperion is the club's flagship case-study competition, and its 2021 edition drew " +
          "more than 1,000 students from 26+ institutes, including 23 IITs, to estimate the " +
          "local dark-matter density from synthetic stellar data. As a secretary on the " +
          "organising team, I published the competition archive and turned its code into " +
          "documented notebooks.",
      },
      {
        kind: "list",
        items: [
          "A 7-question, 100-mark case covering Gauss's law, Oort constants and uncertainty " +
            "analysis.",
          "Synthetic datasets: 10,000 radial-velocity samples mixing exoplanet signals, a " +
            "dark-matter trend and noise.",
          "A reference solution that uses an FFT to strip out the exoplanet signals and recover " +
            "the acceleration.",
          "An open archive of the problem, data, code and the three winning reports.",
        ],
      },
    ],
    tech: ["Python", "NumPy", "SciPy", "Jupyter", "Event organising"],
    links: [
      { label: "GitHub", href: `${ORG}/Hyperion-2021`, kind: "github" },
      { label: "Source paper", href: "https://arxiv.org/abs/1812.07578", kind: "docs" },
    ],
  },
  {
    id: "astro/wiki",
    title: "Astronomy Club, IIT Kanpur Wiki",
    star: "Andromeda · the galaxy next door",
    tagline: "The club's open-source encyclopedia of the night sky",
    art: "wiki",
    period: "Oct 2023 – 2025",
    role: "Founder and lead maintainer",
    facts: [
      { label: "Content", value: "154 pages, ~43,000 words" },
      { label: "Commits", value: "253 of 313" },
      { label: "Community", value: "21 contributors, Hacktoberfest 2024" },
      { label: "Stack", value: "Jekyll, GitHub Actions, GitHub Pages" },
    ],
    body: [
      {
        kind: "p",
        text:
          "I founded the club's wiki to collect everything we know in one searchable place, from " +
          "star hopping and astrophotography to orbital mechanics and how the club runs. I chose " +
          "the stack, built the custom features, wrote most of the content and set up CI/CD and " +
          "the custom domain. In 2024 I opened it to outside contributors for Hacktoberfest.",
      },
      {
        kind: "list",
        items: [
          "Created 159 of its 160 Markdown pages, with LaTeX derivations rendered by MathJax.",
          "A per-page contributors footer built on the GitHub REST API.",
          "A random-page explorer, share and print buttons and a / search shortcut.",
          "CI builds every pull request, and every push to main deploys to wiki.astroclubiitk.in.",
          "Reviewed and merged community PRs from the Hacktoberfest 2024 drive.",
        ],
      },
    ],
    tech: ["Jekyll", "Ruby", "JavaScript", "SCSS", "MathJax", "GitHub Actions"],
    links: [
      { label: "Live site", href: "https://wiki.astroclubiitk.in", kind: "live" },
      { label: "GitHub", href: `${ORG}/wiki`, kind: "github" },
    ],
  },
  {
    id: "astro/nasa-apod-discord-bot",
    title: "NASA APOD Discord Bot",
    star: "Venus · the morning star",
    tagline: "A Discord bot that posts NASA's picture of the day every morning",
    art: "nasa-apod-discord-bot",
    period: "May 2023",
    facts: [
      { label: "Runtime", value: "Node.js, discord.js" },
      { label: "Archive", value: "Any APOD since 1 January 2015" },
      { label: "Rewrite", value: "Python to Node.js, +1,858 lines" },
    ],
    body: [
      {
        kind: "p",
        text:
          "The club's Discord bot shares NASA's Astronomy Picture of the Day each morning. I " +
          "took it over, added on-demand lookups by date, and then rewrote the whole bot in " +
          "Node.js. Every JavaScript file in the current codebase is mine.",
      },
      {
        kind: "list",
        items: [
          "Posts each day's picture or video with its title, credits and the astronomer's " +
            "explanation.",
          "$APOD dd/mm/yy looks up the picture for any date back to 2015.",
          "Checks each page before replying, so bad dates get a clean error message.",
          "A clock-based scheduler, so restarts never shift or repeat the daily post.",
          "An Express keep-alive server keeps it online on free hosting.",
        ],
      },
    ],
    tech: ["Node.js", "discord.js", "cheerio", "axios", "Express"],
    links: [{ label: "GitHub", href: `${ORG}/NASA-APOD-Discord-Bot`, kind: "github" }],
  },
  {
    id: "astro/ip-mail",
    title: "IP Mail",
    star: "Polaris · the North Star",
    tagline: "A C++ tool that emails the observatory Pi's IP address on boot",
    art: "ip-mail",
    period: "Aug 2023",
    role: "Sole author",
    facts: [
      { label: "Language", value: "C++17" },
      { label: "Runs on", value: "The observatory's Raspberry Pi" },
      { label: "Built", value: "In one day" },
    ],
    body: [
      {
        kind: "p",
        text:
          "After a power cut, the observatory's Raspberry Pi could come back with a new IP " +
          "address, and finding it meant plugging in a monitor. I wrote IP Mail to run on boot " +
          "and email the new address to the club, so anyone can SSH straight in.",
      },
      {
        kind: "list",
        items: [
          "Finds the outbound IP with a UDP connect and getsockname, without sending a packet.",
          "Sends mail over TLS-encrypted Gmail SMTP with libcurl, streaming the message through " +
            "a read callback.",
          "Clean Network, Time and Email classes, built with modern CMake.",
        ],
      },
    ],
    tech: ["C++17", "libcurl", "SMTP", "POSIX sockets", "CMake", "Raspberry Pi"],
    links: [{ label: "GitHub", href: `${ORG}/ip_mail`, kind: "github" }],
  },
];
