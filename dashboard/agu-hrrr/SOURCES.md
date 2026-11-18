# HYDRA website sources

The homepage charts and score tables use the public release in [site/data.json](site/data.json). The [generator](build_site.py) checks the evaluation release against its cross-check record. The [narrative and figure renderer](story.py) draws each four-series, 18-lead MAE figure from that release. For each lead it calculates 100 × (1 − model MAE / matching NWM MAE) using the three-seed mean MAE for each network. Persistence and NWM use identical observed cases. Positive values indicate lower MAE. The [full scorecards](site/files/REPORT.md) include the other metrics. Archived publication times and USGS revision histories were unverified.

## Photography

- New River at Grandview, West Virginia. National Park Service photo by Dave Bieri. Used as regional scenery downstream of the study gauges. Locally resized WebP copies preserve the photograph and responsive crops are for display. [NPS source and photographer credit](https://www.nps.gov/places/grandview.htm) · [Agency image](https://www.nps.gov/common/uploads/cropped_image/primary/32A18302-B83B-5ED3-E6E4960F4647F044.jpg?width=2350&quality=90&mode=crop)
- Hurricane Helene, Gulf of Mexico, 25 September 2024. NASA, International Space Station Expedition 72, image ISS072-E-001649. Used only for the historical motivation. The evaluation ended in April 2023. Locally resized WebP. [NASA image record](https://images.nasa.gov/details/iss072e001649) · [Agency image](https://images-assets.nasa.gov/image/iss072e001649/iss072e001649~large.jpg)

## Author affiliations and meeting identification

The public institutional wordmarks appear in their original proportions and colors in the study-team section. University marks identify author affiliations. The AGU mark identifies the meeting venue. The original institutional marks remain their respective owners’ trademarks.

- University of Texas at Austin. Official primary horizontal wordmark from University Marketing and Communications. [Brand guide](https://umac.utexas.edu/brand-center/university-csu-wordmarks/) · [Public web asset](https://umac.utexas.edu/wp-content/themes/bellmont/dist/images/utexas-primary-horizontal-logo.svg)
- Appalachian State University. Primary Appalachian logo from University Communications' public identity guide. [Brand guide](https://uc.appstate.edu/brand-and-identity-guide/identity-guide/logos) · [Public web asset](https://uc.appstate.edu/sites/default/files/primary_appalachian_logo_black_2023.png)
- American Geophysical Union. The unmodified AGU logo image was published by DGOvwCWp under CC BY-SA 4.0. [Image, author and file history](https://commons.wikimedia.org/wiki/File:AGU_Logo.jpg) · [License](https://creativecommons.org/licenses/by-sa/4.0/) · [AGU annual meeting](https://www.agu.org/agu26)

## Typeface

Inter by Rasmus Andersson and contributors. The site serves the variable WOFF2 locally with its SIL Open Font License. [Project](https://github.com/rsms/inter) · [License included with the site](site/media/Inter-LICENSE.txt)
