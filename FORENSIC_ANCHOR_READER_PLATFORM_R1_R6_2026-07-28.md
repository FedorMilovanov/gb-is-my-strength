# Reader Platform R1–R6 forensic history anchor

Created: 2026-07-28
Purpose: preserve Git reachability of the content-audited Reader Platform implementation chain before normalizing old remote refs.

This commit is archive-only. Never merge it into `main`.

Current main parent:
- `0a5333f35010a8f2597c05cd958b36634342b61d`

Historical parents:
- R1 foundation / PR #100 closed-unmerged — `2166975236f027ff0672074159ede413ead0ae63`
- R1 final / PR #101 merged — `deca733ca2fd102f1cd81da7ac43ef9c6b207aec`
- R3 series facade / PR #102 merged — `a8b34b12130f51f7fb91641128031f1650cbd507`
- R4 public-surface registry / PR #103 merged — `e491bc8902aee6db69c5701c73a4433bd2b33298`
- R5 overlay runtime / PR #104 merged — `6e31ec540f47ab2b282e0850dddb2f0c008fa586`
- special overlay adapters / PR #106 merged — `a91505e70434ac436c7dc39f9cb3ba55d8940065`
- production verification / PR #107 closed-unmerged — `a519cd562ee710ebb44f41e739e5aa1b699f9260`
- R6 reader state / PR #191 merged — `2461198f45033d8cce5f2444a9492d9f8176fa01`

Recovery rule: inspect a historical parent against current main file-by-file. Recover only through a bounded successor from current main. Never merge this octopus archive commit.
