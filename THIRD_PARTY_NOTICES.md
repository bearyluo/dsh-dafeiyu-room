# Third-party notices and artwork

Project code is distributed under Apache-2.0; see LICENSE. The following notices remain applicable to referenced or derived materials.

## Dafeiyu / LO character design

- Design reference: https://github.com/PC2005-cloud/dsh-pet , also used by https://github.com/QCYTSN/dsh-dafeiyu . Both upstream repositories reported MIT licensing when checked on 2026-11-01.
- Preserve the complete MIT notice in `web/assets/LO_SPRITE_LICENSE.txt` (Copyright (c) 2026 PC2005-cloud).
- The shipped pose/walk/life sprite sheets are project-generated adaptations of that established design, rather than a claim to ownership of the upstream character. A retained life-sprite generation prompt is in `docs/artwork/character-life-prompt.txt`.

## Cabin, furniture, textiles and garden

The cabin and decorative/background bitmaps were produced for this project using image generation and integrated after review. The checked-in images are the runtime assets; no image-generation service is contacted at runtime. Decoration/duvet/fixture/garden prompts and the asset inventory are included under `docs/artwork/` and `web/assets/HOME_ART.md`.

Generated imagery is offered under the project license to the extent the project can grant rights; this does not claim exclusive rights to a general game style or to the upstream character design. The original cabin/walk/pose generation prompts were not all retained, and are not invented here. Every shipped PNG is identified by hash.

No original Stardew Valley game files are included. Stardew Valley is referenced as a visual/gameplay inspiration, not as an affiliation or endorsement.

## Dependencies and services

- DeepSeek Harness SDK: the pinned npm dependencies retain their own licenses. This repository does not vendor their node_modules.
- Android APIs and JDK: required to build the companion, not redistributed as SDK/tool binaries.
- Weather data by [Open-Meteo](https://open-meteo.com/), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Requests use the service from `src/weather.js`; only configured city coordinates/query terms are sent, not chat content. The default free endpoint is subject to Open-Meteo's [non-commercial service terms](https://open-meteo.com/en/terms); the code license does not waive service terms.
- Optional tunnel command in `bin/room-public-viewer.mjs`: requires separate third-party components/services and is not enabled by the LAN instructions. Their terms and network behavior apply when a user explicitly runs it.
