# Data credits

The world grid (`src/data/geo/tiles.json`, built by `scripts/geo/build-tiles.mjs`) is derived from:

- **Natural Earth** (public domain): land, lakes, rivers, glaciated areas, named physical regions,
  populated places, countries and provinces. https://www.naturalearthdata.com/
- **Köppen-Geiger climate classification** at 0.5 degrees, via the `koppen-climate-lookup` npm
  package (Beck et al. 2018, CC BY 4.0).
- **Elevation** from the Mapzen / Tilezen terrain tiles (zoom 4), used at build time to classify
  relief. Required attribution for those tiles:
  - ArcticDEM terrain data DEM(s) were created from DigitalGlobe, Inc., imagery and funded under
    National Science Foundation awards 1043681, 1559691, and 1542736;
  - Australia terrain data © Commonwealth of Australia (Geoscience Australia) 2017;
  - Austria terrain data © offene Daten Österreichs – Digitales Geländemodell (DGM) Österreich;
  - Canada terrain data contains information licensed under the Open Government Licence – Canada;
  - Europe terrain data produced using Copernicus data and information funded by the European
    Union - EU-DEM layers;
  - Global ETOPO1 terrain data U.S. National Oceanic and Atmospheric Administration;
  - Mexico terrain data source: INEGI, Continental relief, 2016;
  - New Zealand terrain data Copyright 2011 Crown copyright (c) Land Information New Zealand and
    the New Zealand Government (All rights reserved);
  - Norway terrain data © Kartverket;
  - United Kingdom terrain data © Environment Agency copyright and/or database right 2015. All
    rights reserved;
  - United States 3DEP (formerly NED) and global GMTED2010 and SRTM terrain data courtesy of the
    U.S. Geological Survey.

Unit models: see `src/assets/raw-models/README.md`.
