# Built-in brand marks

Archify ships a bounded catalogue of commonly used brands for architecture,
workflow, sequence, data-flow, and lifecycle nodes. The mark is optional authored
identity: it never replaces the node's semantic `type`, color, label, or
relationships.

Unknown sites are handled by an explicit two-stage workflow. Run
`node bin/archify.mjs brands capture <url> --json`, then author the returned
digest-pinned `brand` value. Normal render and validate commands do not perform
an unpinned capture, and changed or unavailable content fails closed.

Most vector paths and brand metadata are generated from Simple Icons 16.28.0.
The OpenAI mark is traced to OpenAI's official brand guidelines. Every generated
entry records its source and, when available upstream, its guidelines and license
metadata in `renderers/shared/generated-brand-marks.mjs`.

Brand names and logos may be trademarks of their respective owners. Simple
Icons' CC0 license covers its collection work, not every underlying trademark or
artwork. Contributors must review the recorded source, current brand guidelines,
and intended referential use before adding or updating a mark. Archify does not
imply sponsorship, endorsement, or partnership.

Full-colour official icon sets that cannot be reduced to one path without
altering the artwork use `svgFile` instead of `simpleIcon` or `custom`. The
`microsoft` category (Azure services, Dynamics 365, Dataverse, Power Apps, Power BI
and Microsoft Fabric) is stored in `brand-marks/azure/` from Microsoft's published
icon sets and embedded unaltered; the generator rejects files with script, event handlers, or external
references. Try `node bin/archify.mjs brands microsoft`.

Fork-specific marks are maintained in `catalog.local.json`. This includes
Microsoft service icons, Fabric, Boomi, and the Dynamics AX 2012 fallback.
The generator merges this file with the upstream `catalog.json`. See
`THIRD_PARTY_NOTICES.md` for their separate artwork terms.

The V25 additions cover containers, private networking, hybrid connectivity,
storage services, load balancing, network security groups, Foundry, OpenAI,
AI Search, and Managed Redis. Source filenames and checksums are recorded in
`azure/sources-v25.json`. Private DNS Zone shares the official DNS Zones
artwork; VPN Gateway uses Virtual Network Gateways; Blob Storage uses Blob Block.
Use the service label to make the intended resource clear.

Edit `catalog.local.json` for fork-specific additions, then regenerate the
committed bundle from the repository root:

```bash
npm --prefix archify run generate:brand-marks
npm --prefix archify run check:brand-marks
node archify/bin/archify.mjs brands microsoft --json
```

Do not hand-edit `renderers/shared/generated-brand-marks.mjs`.
