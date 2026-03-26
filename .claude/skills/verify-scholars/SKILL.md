---
name: verify-scholars
description: Verify extracted scholar JSON against source 宋元學案 volume text. Finds missing/extra scholars, wrong metadata, and fixes issues. Use when asked to "verify scholars", "check extraction", "review volume", or after running pipeline:split.
---

# Verify Scholar Extraction

Quality-check extracted scholar JSON files against their source 宋元學案 volume texts. Uses local analysis + Codex for second opinion, then fixes any issues found.

## Usage

```
/verify-scholars [volume_number]    # e.g., /verify-scholars 001
/verify-scholars all                # verify all extracted volumes
```

## Process

### 1. Load files

- **Source**: `data/{NNN}_第{NNN}卷_*.txt`
- **Extracted**: `scripts/output/scholars-v{NNN}.json`

### 2. Parse the 學案表 (lineage table)

The lineage table is at the top of each volume, before the `◆` sections begin. It lists all scholars in the volume. Scholars marked `別為《...學案》` or `別見《...學案》` appear in OTHER volumes and should NOT be in the extracted JSON.

Extract:
- Expected scholars (those without 別為/別見 markers)
- The 學案 name from the volume header

### 3. Compare extraction vs source

Check:
- **Missing scholars**: In lineage table but not in JSON (excluding 別為/別見)
- **Extra scholars**: In JSON but not in lineage table
- **Wrong sections**: Scholar assigned to wrong `◆` section
- **Wrong metadata**: Name, courtesy name, title mismatches
- **Truncated text**: Text field suspiciously short for a major scholar
- **Empty entries**: Scholars with empty or near-empty text fields

### 4. Get Codex second opinion

Dispatch Codex with the comparison results for verification:

```bash
codex exec "Verify this scholar extraction comparison for 宋元學案 volume {NNN}.

Expected scholars from lineage table: [list]
Extracted scholars from JSON: [list]
Missing: [list]
Extra: [list]

Are these findings correct? Any additional issues?" -s read-only -o /tmp/codex-verify-v{NNN}.md
```

### 5. Fix issues

If missing scholars have biography text in the source:
- Extract the scholar entry from the source text
- Add it to the JSON with correct metadata
- Re-save the file

If scholars have wrong metadata:
- Correct the fields in place

If scholars have truncated text:
- Re-extract the full text from the source

### 6. Report

Output a summary:
```
Volume {NNN} ({學案 name}):
  Total scholars: X
  Missing (no bio text): [names] — OK, no text to extract
  Missing (has bio text): [names] — FIXED
  Wrong metadata: [details] — FIXED
  All checks passed: ✓/✗
```

## Batch mode (`all`)

When running on all volumes:
1. List all `scholars-v*.json` files
2. Run verification on each
3. Output summary table at the end
4. Report total issues found and fixed
