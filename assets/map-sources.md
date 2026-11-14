# World map source and conversion

- Source package: [topojson/world-atlas](https://github.com/topojson/world-atlas), version 2.0.2 (the resolved `@2` version).
- Downloaded geometry: [countries-110m.json](https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json), retrieved 2026-11-14. A local copy is retained alongside this file.
- Package license: [ISC license](https://cdn.jsdelivr.net/npm/world-atlas@2/LICENSE), retained verbatim as `world-atlas-LICENSE.txt`.
- Underlying data: Natural Earth 4.1.0, Admin 0 countries, 1:110 million scale. [Natural Earth terms of use](https://www.naturalearthdata.com/about/terms-of-use/) state that its vector and raster map data are public domain.
- Output projection: equirectangular, `x=(longitude+180)/360*1000`, `y=(90-latitude)/180*500`. Antimeridian crossings are clipped at ±180°; the Antarctic coastline closes through the South Pole.
- SVG viewBox: `0 0 1000 500`; ocean `#f1f6f9`, land `#dce4e9`, country strokes `#fff`. Country boundaries are background geometry. No location markers or visited-country highlights are embedded.
- Country elements use `.map-country` and numeric ISO 3166-1 `data-country-code` values as supplied by world-atlas. Requested codes: China `156`, Switzerland `756`, France `250`, United Kingdom `826`. Country IDs not assigned by the source remain its supplied identifiers.
- `assets/world-map.js` only assigns the static SVG string to `window.EXPERIENCE_MAP_SVG`, for local `file://` use without fetch requests. The SVG has no JavaScript or external references.
- Conversion is reproducible by running the local `build_map.py`; it uses only the Python standard library.

Source data SHA-256: `2516c915867c7baf18ddec727aec46c315541a07cfb3d79a6559b05d5e94eee8`.
