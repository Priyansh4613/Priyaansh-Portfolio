# Priyansh Chaudhary — portfolio

A 3D portfolio built with Vite, Three.js, GSAP and Lenis. Ready for Vercel: import the
repository and it builds with the settings in `vercel.json` (`npm run build` → `dist/`).

## Run it locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

## Where to edit

| What | File |
| --- | --- |
| The 12 projects in the 3D ring and their detail pages | `src/data.js` |
| Hero, intro, experience, skills, contact copy | `index.html` |
| ITSM pipeline steps | `src/pipeline.js` |
| Photos (black and white, already graded) | `src/assets/img/` |
| Résumé download | `src/assets/Priyansh_Chaudhary_Resume.pdf` (replace the file, keep the name) |
| Link-preview image | `public/og.jpg` |
| Colours and type | top of `src/style.css` |

Card artwork in the ring is drawn in code (`src/gl/cards.js`), so changing a title or metric in
`src/data.js` updates the card automatically.

## Notes

- Works without WebGL too: the ring falls back to a grid of cards.
- Respects reduced-motion settings.
- On Vercel, the share image URL is made absolute automatically from the production domain.
