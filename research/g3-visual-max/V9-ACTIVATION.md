# V9 activation contract (MAX 0 only)
Research #632 authorized merge f49d20d31931ec389690b3033cefbb66cda67522; exact bounded manifest read and compared. New typed source module and JSON only in assigned namespace. Existing immutable Product seals untouched. No route import or registration of new source IDs here.

History parent after adding gnl-2018 and gnl-2021 to typed G3_HISTORY_SOURCES:
```astro
---
import Matrix from './g3-visual/G3SpeakerMatrix.astro';
import { adoptedMatrixData, adoptedMatrixClaim } from './g3-visual/adopted-visual-inputs';
import type { G3HistorySourceId } from '@/data/journal/g3HistorySources';
const sourceIds = {2013:'gnl-2013',2014:'gnl-2014',2015:'gnl-2015',2016:'gnl-2016',2017:'gnl-2017',2018:'gnl-2018',2019:'gnl-2019',2020:'gnl-2020',2021:'gnl-2021'} satisfies Record<number,G3HistorySourceId>;
---
<Matrix data={adoptedMatrixData()} sourceIds={sourceIds} claimId={adoptedMatrixClaim}/>
```
Do not cast missing source IDs or add duplicate bibliography. Default remains selected base 37 pairs. New title 'Имена в каталогах G3' avoids claiming every catalogue participant delivered a sermon (including Martha Peace and joint discussion). Short selection disclaimer retained.

Crisis parent after extending authority contract G3-PUB-017 and reader projection (G3-S002/G3-S028 with EIN-specific ProPublica locator in canonical bibliography):
```astro
---
import Annual from './g3-visual/G3AnnualFinance.astro';
import { adoptedAnnualFinance } from './g3-visual/adopted-visual-inputs';
---
<Annual projection={adoptedAnnualFinance()}/>
```
No review banner in adopted mode; both modes enforce exact authorization/data boundaries. Retain graph of 2023 net change (G3-PUB-002) only once, not another copy of existing three bars. Exact adopted mode must undergo separate full Product route build, source/SEO/print/browser tests. No media approval inferred. Historical review fixtures unchanged.
