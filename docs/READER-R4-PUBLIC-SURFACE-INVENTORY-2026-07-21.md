# Reader R4 public-surface inventory

- Routes: **76**
- Missing profiles: **0**
- Missing/unknown route types: **6**
- Exact SeriesReaderChrome routes: **41**
- Exact book-config routes: **24**
- Historical implementation leaks: **0**
- Profiles without declared surface: **76**

## Candidate surface counts

- `article`: 2
- `page`: 9
- `series`: 51
- `special`: 14

## Candidate series shapes

- `<missing>`: 25
- `book`: 24
- `flat`: 27

## Classification gaps

- `/about/`
- `/baptisty-rossii/`
- `/izbrannoe/`
- `/karty/`
- `/konfessii/`
- `/nagornaya/`

## Routes

| Route | routeType | candidate | shape | basis | façade d | book d | config source | mobile |
|---|---|---|---|---|---:|---:|---|---|
| `/` | home | **page** |  | page-fallback:home |  |  |  |  |
| `/about/` |  | **page** |  | page-fallback:missing-routeType |  |  |  |  |
| `/articles/` | articles-index | **page** |  | page-fallback:articles-index |  |  |  | {"engine":"page","adapter":"default-page","mount":"registry"} |
| `/articles/20-antisovetov-pastoru/` | article | **series** | flat | resolved-import:SeriesReaderChrome | 2 |  | src/components/article-pilots/_shared/series/pastorSeriesConfig.ts<br>src/components/article-pilots/_shared/series/seriesConfig.ts |  |
| `/articles/chto-bibliya-nazyvaet-serdcem/` | article | **series** | book | resolved-import:SeriesReaderChrome | 2 | 2 | src/components/article-pilots/_shared/series/hardTextsSeriesConfig.ts<br>src/components/article-pilots/_shared/series/seriesConfig.ts |  |
| `/articles/dzhon-gill-chast-1-chelovek/` | article | **series** | flat | resolved-import:SeriesReaderChrome | 2 |  | src/components/article-pilots/_shared/series/seriesConfig.ts | {"engine":"series","adapter":"gill","mount":"static"} |
| `/articles/dzhon-gill-chast-2-uchenyi/` | article | **series** | flat | resolved-import:SeriesReaderChrome | 2 |  | src/components/article-pilots/_shared/series/seriesConfig.ts | {"engine":"series","adapter":"gill","mount":"static"} |
| `/articles/dzhon-gill-chast-3-nasledie/` | article | **series** | flat | resolved-import:SeriesReaderChrome | 2 |  | src/components/article-pilots/_shared/series/seriesConfig.ts | {"engine":"series","adapter":"gill","mount":"static"} |
| `/articles/dzhon-gill-chast-4-ekzeget/` | article | **series** | flat | resolved-import:SeriesReaderChrome | 2 |  | src/components/article-pilots/_shared/series/seriesConfig.ts | {"engine":"series","adapter":"gill","mount":"static"} |
| `/articles/dzhon-gill-istoricheskiy-kontekst/` | article | **series** | flat | resolved-import:SeriesReaderChrome | 2 |  | src/components/article-pilots/_shared/series/seriesConfig.ts | {"engine":"series","adapter":"gill","mount":"static"} |
| `/articles/dzhon-gill-spravochnik/` | article | **series** | flat | resolved-import:SeriesReaderChrome | 2 |  | src/components/article-pilots/_shared/series/seriesConfig.ts | {"engine":"series","adapter":"gill","mount":"static"} |
| `/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/` | article | **article** |  | routeType:article |  |  |  | {"engine":"article","adapter":"hermenevtika","mount":"static"} |
| `/articles/kak-hranit-serdce/` | article | **series** | book | resolved-import:SeriesReaderChrome | 2 | 1 | src/components/article-pilots/_shared/series/hardTextsSeriesConfig.ts<br>src/components/article-pilots/_shared/series/seriesConfig.ts |  |
| `/articles/kak-menyaetsya-serdce/` | article | **series** | book | resolved-import:SeriesReaderChrome | 2 | 1 | src/components/article-pilots/_shared/series/hardTextsSeriesConfig.ts<br>src/components/article-pilots/_shared/series/seriesConfig.ts |  |
| `/articles/kod-da-vinchi/` | article | **article** |  | routeType:article |  |  |  |  |
| `/articles/krajne-li-isporcheno-serdce/` | article | **series** | book | resolved-import:SeriesReaderChrome | 2 | 2 | src/components/article-pilots/_shared/series/hardTextsSeriesConfig.ts<br>src/components/article-pilots/_shared/series/seriesConfig.ts |  |
| `/articles/myslennaya-zhizn-serdca/` | article | **series** | book | resolved-import:SeriesReaderChrome | 2 | 1 | src/components/article-pilots/_shared/series/hardTextsSeriesConfig.ts<br>src/components/article-pilots/_shared/series/seriesConfig.ts |  |
| `/articles/novoe-serdce/` | article | **series** | book | resolved-import:SeriesReaderChrome | 2 | 2 | src/components/article-pilots/_shared/series/hardTextsSeriesConfig.ts<br>src/components/article-pilots/_shared/series/seriesConfig.ts |  |
| `/articles/osvobozhdennoe-serdce/` | article | **series** | book | resolved-import:SeriesReaderChrome | 2 | 1 | src/components/article-pilots/_shared/series/hardTextsSeriesConfig.ts<br>src/components/article-pilots/_shared/series/seriesConfig.ts |  |
| `/articles/religioznoe-serdce/` | article | **series** | book | resolved-import:SeriesReaderChrome | 2 | 1 | src/components/article-pilots/_shared/series/hardTextsSeriesConfig.ts<br>src/components/article-pilots/_shared/series/seriesConfig.ts |  |
| `/articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy/` | article | **series** | book | resolved-import:SeriesReaderChrome | 2 | 2 | src/components/article-pilots/_shared/series/hardTextsSeriesConfig.ts<br>src/components/article-pilots/_shared/series/seriesConfig.ts |  |
| `/articles/serdce-hrista-k-nemoshchnym/` | article | **series** | book | resolved-import:SeriesReaderChrome | 2 | 1 | src/components/article-pilots/_shared/series/hardTextsSeriesConfig.ts<br>src/components/article-pilots/_shared/series/seriesConfig.ts |  |
| `/articles/serdce-i-duh/` | article | **series** | book | resolved-import:SeriesReaderChrome | 2 | 2 | src/components/article-pilots/_shared/series/hardTextsSeriesConfig.ts<br>src/components/article-pilots/_shared/series/seriesConfig.ts |  |
| `/articles/serdce-i-iskushenie/` | article | **series** | book | resolved-import:SeriesReaderChrome | 2 | 1 | src/components/article-pilots/_shared/series/hardTextsSeriesConfig.ts<br>src/components/article-pilots/_shared/series/seriesConfig.ts |  |
| `/articles/serdce-i-sokrovishche/` | article | **series** | book | resolved-import:SeriesReaderChrome | 2 | 1 | src/components/article-pilots/_shared/series/hardTextsSeriesConfig.ts<br>src/components/article-pilots/_shared/series/seriesConfig.ts |  |
| `/articles/serdce-i-telo/` | article | **series** | book | resolved-import:SeriesReaderChrome | 2 | 1 | src/components/article-pilots/_shared/series/hardTextsSeriesConfig.ts<br>src/components/article-pilots/_shared/series/seriesConfig.ts |  |
| `/articles/serdce-i-yazyk/` | article | **series** | book | resolved-import:SeriesReaderChrome | 2 | 1 | src/components/article-pilots/_shared/series/hardTextsSeriesConfig.ts<br>src/components/article-pilots/_shared/series/seriesConfig.ts |  |
| `/articles/serdce-ne-v-odinochku/` | article | **series** | book | resolved-import:SeriesReaderChrome | 2 | 1 | src/components/article-pilots/_shared/series/hardTextsSeriesConfig.ts<br>src/components/article-pilots/_shared/series/seriesConfig.ts |  |
| `/articles/serdce-pod-skorbyu/` | article | **series** | book | resolved-import:SeriesReaderChrome | 2 | 1 | src/components/article-pilots/_shared/series/hardTextsSeriesConfig.ts<br>src/components/article-pilots/_shared/series/seriesConfig.ts |  |
| `/articles/serdce-spravochnik/` | article | **series** | book | resolved-import:SeriesReaderChrome | 2 | 2 | src/components/article-pilots/_shared/series/hardTextsSeriesConfig.ts<br>src/components/article-pilots/_shared/series/seriesConfig.ts |  |
| `/articles/skrytye-idoly-serdca/` | article | **series** | book | resolved-import:SeriesReaderChrome | 2 | 1 | src/components/article-pilots/_shared/series/hardTextsSeriesConfig.ts<br>src/components/article-pilots/_shared/series/seriesConfig.ts |  |
| `/articles/sovest-vnutrenniy-sud/` | article | **series** | book | resolved-import:SeriesReaderChrome | 2 | 1 | src/components/article-pilots/_shared/series/hardTextsSeriesConfig.ts<br>src/components/article-pilots/_shared/series/seriesConfig.ts |  |
| `/articles/starye-dorozhki-serdca/` | article | **series** | book | resolved-import:SeriesReaderChrome | 2 | 1 | src/components/article-pilots/_shared/series/hardTextsSeriesConfig.ts<br>src/components/article-pilots/_shared/series/seriesConfig.ts |  |
| `/articles/strah-bozhij-rabskij-ili-synovnij/` | article | **series** | book | resolved-import:SeriesReaderChrome | 2 | 1 | src/components/article-pilots/_shared/series/hardTextsSeriesConfig.ts<br>src/components/article-pilots/_shared/series/seriesConfig.ts |  |
| `/articles/svoboda-vo-hriste/` | article | **series** | book | resolved-import:SeriesReaderChrome | 2 | 1 | src/components/article-pilots/_shared/series/hardTextsSeriesConfig.ts<br>src/components/article-pilots/_shared/series/seriesConfig.ts |  |
| `/articles/tma-na-serdce/` | article | **series** | book | resolved-import:SeriesReaderChrome | 2 | 1 | src/components/article-pilots/_shared/series/hardTextsSeriesConfig.ts<br>src/components/article-pilots/_shared/series/seriesConfig.ts |  |
| `/baptisty-rossii/` | unknown | **series** | flat | explicit-series-index |  |  |  |  |
| `/baptisty-rossii/dva-sezda-1884/` | series-article | **series** | flat | routeType:series-article | 2 |  | src/components/article-pilots/_shared/series/baptistSeriesConfig.ts<br>src/components/article-pilots/_shared/series/seriesConfig.ts |  |
| `/baptisty-rossii/goneniya-i-sovest/` | series-article | **series** | flat | routeType:series-article | 2 |  | src/components/article-pilots/_shared/series/baptistSeriesConfig.ts<br>src/components/article-pilots/_shared/series/seriesConfig.ts |  |
| `/baptisty-rossii/iniciativnaya-gruppa/` | series-article | **series** | flat | routeType:series-article | 2 |  | src/components/article-pilots/_shared/series/baptistSeriesConfig.ts<br>src/components/article-pilots/_shared/series/seriesConfig.ts |  |
| `/baptisty-rossii/noch-na-kure/` | series-article | **series** | flat | routeType:series-article | 2 |  | src/components/article-pilots/_shared/series/baptistSeriesConfig.ts<br>src/components/article-pilots/_shared/series/seriesConfig.ts |  |
| `/baptisty-rossii/peterburgskaya-liniya/` | series-article | **series** | flat | routeType:series-article | 2 |  | src/components/article-pilots/_shared/series/baptistSeriesConfig.ts<br>src/components/article-pilots/_shared/series/seriesConfig.ts |  |
| `/baptisty-rossii/podpolnaya-pechat/` | series-article | **series** | flat | routeType:series-article | 2 |  | src/components/article-pilots/_shared/series/baptistSeriesConfig.ts<br>src/components/article-pilots/_shared/series/seriesConfig.ts |  |
| `/baptisty-rossii/sovetskaya-noch/` | series-article | **series** | flat | routeType:series-article | 2 |  | src/components/article-pilots/_shared/series/baptistSeriesConfig.ts<br>src/components/article-pilots/_shared/series/seriesConfig.ts |  |
| `/baptisty-rossii/spravochnik/` | series-article | **series** | flat | routeType:series-article | 2 |  | src/components/article-pilots/_shared/series/baptistSeriesConfig.ts<br>src/components/article-pilots/_shared/series/seriesConfig.ts |  |
| `/baptisty-rossii/vsehib-1944/` | series-article | **series** | flat | routeType:series-article | 2 |  | src/components/article-pilots/_shared/series/baptistSeriesConfig.ts<br>src/components/article-pilots/_shared/series/seriesConfig.ts |  |
| `/baptisty-rossii/yuzhnaya-shtunda/` | series-article | **series** | flat | routeType:series-article | 2 |  | src/components/article-pilots/_shared/series/baptistSeriesConfig.ts<br>src/components/article-pilots/_shared/series/seriesConfig.ts |  |
| `/biografii/` | biographies-index | **page** |  | page-fallback:biographies-index |  |  |  | {"engine":"page","adapter":"default-page","mount":"registry"} |
| `/hard-texts/` | hard-texts-index | **page** |  | page-fallback:hard-texts-index |  |  |  | {"engine":"page","adapter":"default-page","mount":"registry"} |
| `/izbrannoe/` |  | **page** |  | page-fallback:missing-routeType |  |  |  |  |
| `/karty/` | unknown | **page** |  | page-fallback:unknown |  |  |  | {"engine":"page","adapter":"default-page","mount":"registry"} |
| `/karty/avraam/` | map | **special** |  | routeType:map |  |  |  |  |
| `/karty/early-church/` | map | **special** |  | routeType:map |  |  |  |  |
| `/karty/ishod/` | map | **special** |  | routeType:map |  |  |  |  |
| `/karty/maccabim/` | map | **special** |  | routeType:map |  |  |  |  |
| `/karty/melachim/` | map | **special** |  | routeType:map |  |  |  |  |
| `/karty/pavel/` | map | **special** |  | routeType:map |  |  |  |  |
| `/karty/revelation/` | map | **special** |  | routeType:map |  |  |  |  |
| `/karty/shoftim/` | map | **special** |  | routeType:map |  |  |  |  |
| `/karty/shvatim/` | map | **special** |  | routeType:map |  |  |  |  |
| `/karty/yeshua/` | map | **special** |  | routeType:map |  |  |  |  |
| `/konfessii/` | unknown | **page** |  | page-fallback:unknown |  |  |  | {"engine":"page","adapter":"default-page","mount":"registry"} |
| `/konfessii/russkij-baptizm/` | confession | **special** |  | routeType:confession |  |  |  |  |
| `/konfessii/russkij-baptizm/_app/` | confession | **special** |  | owner:built-app |  |  |  |  |
| `/map/` | map-landing | **special** |  | routeType:map-landing |  |  |  |  |
| `/nagornaya/` | unknown | **series** | flat | explicit-series-index |  |  |  |  |
| `/nagornaya/chast-1/` | series-chapter | **series** | flat | routeType:series-chapter |  |  |  |  |
| `/nagornaya/chast-2/` | series-chapter | **series** | flat | routeType:series-chapter |  |  |  |  |
| `/nagornaya/chast-3/` | series-chapter | **series** | flat | routeType:series-chapter |  |  |  |  |
| `/nagornaya/chast-4/` | series-chapter | **series** | flat | routeType:series-chapter |  |  |  |  |
| `/nagornaya/chast-5/` | series-chapter | **series** | flat | routeType:series-chapter |  |  |  |  |
| `/nagornaya/istochniki/` | series-chapter | **series** | flat | routeType:series-chapter |  |  |  |  |
| `/nagornaya/nakhodki/` | series-chapter | **series** | flat | routeType:series-chapter |  |  |  |  |
| `/nagornaya/seriya/` | series-chapter | **series** | flat | routeType:series-chapter |  |  |  |  |
| `/pastor-series/` | pastor-index | **page** |  | page-fallback:pastor-index |  |  |  |  |
| `/rodosloviye/` | genealogy | **special** |  | routeType:genealogy |  |  |  | {"engine":"page","adapter":"default-page","mount":"registry"} |
