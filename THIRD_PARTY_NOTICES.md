# Third-party notices

Archify includes optional vector data for third-party brand marks. These marks
are provided only to identify technologies and services in user-authored
diagrams. Their inclusion does not imply sponsorship, endorsement, partnership,
or affiliation with Archify.

Archify's license and historical MIT grants are described in LICENSE, NOTICE,
and LICENSE-MIT. The software license does not
replace the copyright licenses, trademark policies, or brand guidelines that
apply to third-party marks. Users are responsible for confirming that their
particular use is permitted.

## Simple Icons

Most of the built-in vector paths and their metadata were generated from
[Simple Icons 16.28.0](https://github.com/simple-icons/simple-icons/tree/16.28.0).
Simple Icons makes its collection work available under
[CC0 1.0 Universal](https://github.com/simple-icons/simple-icons/blob/16.28.0/LICENSE.md).

As Simple Icons explains in its
[disclaimer](https://github.com/simple-icons/simple-icons/blob/16.28.0/DISCLAIMER.md),
CC0 for the collection does not mean that every underlying icon is CC0. License
and brand-guideline metadata may be incomplete or change over time. The absence
of an individual license entry is not a grant of permission.

Archify embeds the selected icons as vector-path data and may render them in a
user-selected color. The following individual licenses were recorded in the
pinned Simple Icons 16.28.0 metadata:

| Mark | Recorded source | Recorded license | Archify treatment |
|---|---|---|---|
| Angular | [Angular press kit](https://angular.dev/press-kit) | [`CC-BY-4.0`](https://creativecommons.org/licenses/by/4.0/) | Embedded as vector-path data; color may be changed by the authored diagram. |
| Apache Airflow | [Apache logos](https://apache.org/logos) | [`Apache-2.0`](https://www.apache.org/licenses/LICENSE-2.0) | Embedded as vector-path data; Apache trademarks remain subject to the [ASF trademark policy](https://www.apache.org/foundation/marks/). |
| Apache Kafka | [Apache logos](https://apache.org/logos) | [`Apache-2.0`](https://www.apache.org/licenses/LICENSE-2.0) | Embedded as vector-path data; Apache trademarks remain subject to the [ASF trademark policy](https://www.apache.org/foundation/marks/). |
| .NET | [.NET brand repository](https://github.com/dotnet/brand/blob/c7d0f51b8ec59531332d05fb27a5b758a7a3d689/logo/dotnet-logo.svg) | [`CC0-1.0`](https://creativecommons.org/publicdomain/zero/1.0/) | Embedded as vector-path data; color may be changed by the authored diagram. |
| JavaScript | [JS community logo](https://github.com/voodootikigod/logo.js/blob/1544bdeed6d618a6cfe4f0650d04ab8d9cfa76d9/js.svg) | [`MIT`](https://github.com/voodootikigod/logo.js/blob/1544bdeed6d618a6cfe4f0650d04ab8d9cfa76d9/LICENSE) | Embedded as vector-path data; color may be changed by the authored diagram. |
| Jenkins | [Jenkins artwork source](https://get.jenkins.io/art/) | [`CC-BY-SA-3.0`](https://creativecommons.org/licenses/by-sa/3.0/) | Embedded as vector-path data; color may be changed by the authored diagram. Jenkins retains its trademark rights. |
| Rust | [Rust project](https://www.rust-lang.org) | [`CC-BY-SA-4.0`](https://creativecommons.org/licenses/by-sa/4.0/) | Embedded as vector-path data; color may be changed by the authored diagram. See the [Rust media guide](https://www.rust-lang.org/policies/media-guide). |
| Vue.js | [Vue logo source](https://github.com/vuejs/art/blob/a1c78b74569b70a25300925b4eacfefcc143b8f6/logo.svg) | [`CC-BY-NC-SA-4.0`](https://creativecommons.org/licenses/by-nc-sa/4.0/) | Embedded as vector-path data; color may be changed by the authored diagram. The non-commercial and share-alike conditions remain applicable; see the [Vue artwork terms](https://github.com/vuejs/art/blob/a1c78b74569b70a25300925b4eacfefcc143b8f6/README.md). |

The source, guideline, and known license fields for every packaged mark are
preserved in `renderers/shared/generated-brand-marks.mjs`.

## Microsoft Azure Architecture Icons

The `microsoft` category marks (Azure services, Dynamics 365, Power BI) are the
official full-colour icons from the
[Azure Architecture Icons](https://learn.microsoft.com/azure/architecture/icons/)
set, plus the Dataverse and Power Apps icons from the
[Microsoft Power Platform icons](https://learn.microsoft.com/power-platform/guidance/icons)
set, stored unaltered in `brand-marks/azure/` and embedded as isolated SVG
images. Microsoft permits their use in architectural diagrams, training
materials, and documentation; do not crop, flip, rotate, distort, or recolour
them, and do not use them to represent your own product or service. Microsoft
reserves all other rights. Their inclusion does not state or imply endorsement
by Microsoft.

The additional container, networking, storage, and AI service icons are copied
without artwork changes from Microsoft's
[Azure Architecture Icons V25 archive](https://arch-center.azureedge.net/icons/Azure_Public_Service_Icons_V25.zip).
The source filenames and SHA-256 checksums are recorded in
`brand-marks/azure/sources-v25.json` within the Skill. Private DNS Zone uses the
official DNS Zones artwork, VPN Gateway uses Virtual Network Gateways, and Blob
Storage uses Blob Block. Catalogue notes identify these mappings. These assets
remain subject to Microsoft's icon terms above, separately from Archify's
Apache-2.0 licence.

## Microsoft Fabric icon

`brand-marks/azure/microsoft-fabric.svg` is `fabric_16_color.svg`, stored
unaltered, from the `Icons.zip` archive
(`@fabric-msft/svg-icons` 6.1.0) in
[microsoft/fabric-samples](https://github.com/microsoft/fabric-samples/blob/main/docs-samples/Icons.zip),
linked from the
[Microsoft Fabric icons](https://learn.microsoft.com/fabric/fundamentals/icons)
page. Fabric is not part of the Azure Architecture Icons set. Microsoft permits
use of these icons in architectural diagrams, training materials, or
documentation; do not crop, flip, rotate, distort, or change the icon shape, and
do not use it to represent your own product or service. Microsoft reserves all
other rights. The npm package also carries an MIT licence file; that file does not
grant trademark rights, so the page terms above are followed. Its inclusion does
not state or imply endorsement by Microsoft.

## Dynamics AX 2012 entry

No official Dynamics AX 2012 icon was found in Microsoft's published icon sets or
Simple Icons. The `dynamics-ax-2012` entry therefore reuses the Dynamics 365 icon
(`brand-marks/azure/dynamics-365.svg`) so that AX names resolve to a Microsoft
Dynamics mark. It is a fallback, not an AX-specific mark, and the Microsoft terms
above apply.

## Boomi mark

`brand-marks/boomi/boomi.svg` is stored unaltered from
<https://boomi.com/wp-content/uploads/BoomiMenuLogoIcon.svg>, the logo in the
boomi.com site header. No logo licence, press kit, or brand guidelines were found,
and Simple Icons has no Boomi mark. The site carries only a general copyright
notice with all rights reserved. **No licence for this mark is held or claimed.**
It is included for the same referential use as other catalogue marks, to identify
Boomi products in diagrams. Boomi and the Boomi logo are the property of their
owner. Clear any use beyond that with Boomi. Its inclusion does not state or imply
endorsement by Boomi.

## OpenAI mark

The OpenAI vector path is recorded from the
[OpenAI brand guidelines](https://openai.com/brand/), not from Simple Icons.
Use remains subject to those current guidelines and any applicable trademark
rights. Its inclusion does not state or imply endorsement by OpenAI.

## JetBrains Mono

Delivered Archify viewer artifacts embed the JetBrains Mono variable font
subsets served by Google Fonts. For characters covered by these subsets, font
selection does not depend on a network request or a locally installed copy.
Uncovered characters (including CJK) still use the system fallback stack;
browser and operating-system rasterization can differ.
JetBrains Mono is maintained at
[github.com/JetBrains/JetBrainsMono](https://github.com/JetBrains/JetBrainsMono)
and is distributed under the SIL Open Font License 1.1. The complete license
text is preserved in `assets/JetBrainsMono-OFL.txt` in the packaged Skill and
in the font CSS carried by standalone HTML and SVG exports.

## Pele

The explainer renders Mermaid chart fences with an unmodified subset of
[Pele 1.3.0](https://github.com/obsidianmd/pele), copyright (c) 2026 kepano,
distributed under the MIT License. The subset and its license text are in
`explainer/vendor/pele/` in the packaged Skill. Charts are rendered to static
SVG when a page is built; delivered pages contain no Pele code.

## No additional rights granted

Brand names, logos, and trademarks remain the property of their respective
owners. This notice records provenance and known terms; it does not grant rights
that Archify does not hold, and it does not state that every packaged mark has
been cleared for every commercial, promotional, or redistributive use.
