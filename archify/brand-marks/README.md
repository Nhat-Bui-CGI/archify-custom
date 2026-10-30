# Built-in brand marks

Archify ships a bounded catalogue of 148 commonly used brands for architecture,
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

Three marks were added locally to the installed package, and a package update may
overwrite them. `microsoft-fabric` comes from Microsoft's Fabric icon set.
`boomi` (`brand-marks/boomi/`) comes from the boomi.com site header; no logo licence
was found. `dynamics-ax-2012` has no artwork of its own: no official AX icon was
found, so it reuses the Dynamics 365 icon. See `THIRD_PARTY_NOTICES.md`. The generator
is not part of the installed package, so these entries were added to `catalog.json`
and the bundle by hand in the generator's output shape.

Edit `catalog.json`, then regenerate the committed zero-runtime-dependency bundle:

```bash
npm run generate:brand-marks
npm run check:brand-marks
```

Do not hand-edit `renderers/shared/generated-brand-marks.mjs`.
