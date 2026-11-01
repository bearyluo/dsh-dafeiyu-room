# Runtime artwork inventory

All PNGs below are shipped runtime files. Decoration and garden prompts are retained under `docs/artwork/`. Earlier cabin/walk/pose source prompts were not all retained. Geometry and atlas selection live in `web/home.js`, `web/motion.cjs` and `web/camera.js`.

The character design notice remains in `LO_SPRITE_LICENSE.txt`; project-generated scenery/decorations are covered by the project license to the extent rights can be granted. See `THIRD_PARTY_NOTICES.md`.

| Asset | Origin / retained prompt |
|---|---|
| `cabin-v2.png` | Project-generated cabin; original generation prompt not retained. |
| `home-decor-v1.png` | Project-generated home decoration. Prompts: `docs/artwork/`. |
| `home-duvet-v1.png` | Project-generated home decoration. Prompts: `docs/artwork/`. |
| `home-extras-v1.png` | Project-generated home decoration. Prompts: `docs/artwork/`. |
| `home-linen-v1.png` | Project-generated home decoration. Prompts: `docs/artwork/`. |
| `home-switch-v1.png` | Project-generated home decoration. Prompts: `docs/artwork/`. |
| `home-washstand-v1.png` | Project-generated home decoration. Prompts: `docs/artwork/`. |
| `lo-life-v3.png` | Project-generated adaptation of the MIT character design. Life animation prompt: `docs/artwork/character-life-prompt.txt`. |
| `lo-poses.png` | Project-generated adaptation of the MIT character design. Life animation prompt: `docs/artwork/character-life-prompt.txt`. |
| `lo-sit-side.png` | Project-generated adaptation of the MIT character design. Life animation prompt: `docs/artwork/character-life-prompt.txt`. |
| `lo-walk.png` | Project-generated adaptation of the MIT character design. Life animation prompt: `docs/artwork/character-life-prompt.txt`. |
| `outdoor-garden-v1.png` | Project-generated garden. Prompt: `docs/artwork/garden-prompt.md`. |

No original Stardew Valley game files are included. Runtime uses only the checked-in bitmaps; it does not contact an image-generation service.

## Registration and layering

The duvet is a transparent cloth-only sprite registered to the bed; its foreground hides the lower body while preserving the head/pillow. Rugs and table masking are composited from the approved atlases. The garden is a continuous overhead ground plate; daylight tint and outdoor precipitation are drawn locally, outside the room mask. Source bitmaps are unchanged from the reviewed assets.

SHA-256 values: `docs/artwork/SHA256SUMS.txt`.
