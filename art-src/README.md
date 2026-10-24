# Generated art goes here

Put pictures made with ChatGPT (or any image tool) in this folder, using the file names from the art brief
(`tools/art-manifest.js` lists all 135, with the size to ask for and the prompt). Then run:

```
npm run art     # fits every picture found here into assets/ (the rest keep the drawn art)
npm run build   # -> dist/index.html
```

The importer (`tools/art/import.js`):
- **Backgrounds:** uses transparency when the picture has it. Otherwise it removes a flat background touching
  the edges (magenta #FF00FF, white, or any even colour).
- **Grids:** splits characters, animals, seasons and icons into cells, using the gaps between items.
- **Sizing:** trims each picture, scales it to its in-game size, and puts feet and bases on the ground line.
- **Textures:** blends the edges of ground textures so they tile without seams.

A single icon can be redone on its own as `icons/<icon name>.png` (for example `icons/turnip.png`).

Pictures that are too big to upload in one zip can come in several smaller zips: only the file names matter.
The importer reads them one at a time, so big pictures are fine.
