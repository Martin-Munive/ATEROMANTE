# Renaming Protocol

## Purpose
Make the future product rename simple, reviewable and safe.

The project currently publishes as `ATEROMANTE`. Future renames must stay reviewable across docs, code, package metadata and UI.

## Rename Inputs
Before renaming, define:

- old public name;
- new public name;
- new slug;
- package name;
- repository name;
- app display name;
- tagline;
- license impact, if any;
- whether the folder name changes.

## Files To Check
- `README.md`
- `package.json` or equivalent package metadata
- desktop app config
- installer metadata
- docs under `docs/`
- UI constants
- test snapshots
- examples
- license and notices
- GitHub repository description

## Suggested Routine
1. Create a branch or checkpoint.
2. Run a search for the old name and slug.
3. Update centralized identity constants first.
4. Update package/app metadata.
5. Update documentation.
6. Update UI copy.
7. Run tests and lint.
8. Run a final search for the old name.
9. Commit the rename alone.

## Search Commands

```powershell
rg -n "ATEROMANTE|ateromante|P-AJEDREZ-GM" .
```

After choosing a final name, run the same search for both old and new names to verify that only intentional historical references remain.

## Automation Target
A future script may implement:

```powershell
scripts/rename-project.ps1 -OldName "ATEROMANTE" -NewName "NewName" -NewSlug "new-name"
```

The script should:
- refuse to run with uncommitted changes unless explicitly forced;
- update known metadata files;
- update identity constants;
- update docs;
- print remaining matches;
- never rewrite private or external material folders.

## Safety Rules
- Do not rename unrelated folders.
- Do not rewrite binary files.
- Do not touch private study material.
- Do not mix a rename commit with feature work.
- Keep one commit only for the rename.
