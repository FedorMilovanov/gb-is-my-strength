# Reader R4 public-surface inventory

- Routes: **76**
- Missing profiles: **0**
- Series façade routes: **47**
- Book routes: **41**
- Historical implementation leaks: **0**

## routeType counts

- `<missing>`: 2
- `article`: 33
- `articles-index`: 1
- `biographies-index`: 1
- `confession`: 2
- `genealogy`: 1
- `hard-texts-index`: 1
- `home`: 1
- `map`: 10
- `map-landing`: 1
- `pastor-index`: 1
- `series-article`: 10
- `series-chapter`: 8
- `unknown`: 4

## migrationMode counts

- `<missing>`: 1
- `strict-native`: 63
- `strict-native-app`: 12

## Routes

| Route | Owner/status | routeType | mode | series | book | mobile |
|---|---|---|---|---:|---:|---|
| `/` | astro/production-dist | home | strict-native |  |  |  |
| `/about/` | astro/production-dist |  | strict-native |  |  |  |
| `/articles/` | astro/production-dist | articles-index | strict-native | yes |  | {"engine":"page","adapter":"default-page","mount":"registry"} |
| `/articles/20-antisovetov-pastoru/` | astro/production-dist | article | strict-native | yes | yes |  |
| `/articles/chto-bibliya-nazyvaet-serdcem/` | astro/production-dist | article | strict-native | yes | yes |  |
| `/articles/dzhon-gill-chast-1-chelovek/` | astro/production-dist | article | strict-native | yes | yes | {"engine":"series","adapter":"gill","mount":"static"} |
| `/articles/dzhon-gill-chast-2-uchenyi/` | astro/production-dist | article | strict-native | yes | yes | {"engine":"series","adapter":"gill","mount":"static"} |
| `/articles/dzhon-gill-chast-3-nasledie/` | astro/production-dist | article | strict-native | yes | yes | {"engine":"series","adapter":"gill","mount":"static"} |
| `/articles/dzhon-gill-chast-4-ekzeget/` | astro/production-dist | article | strict-native | yes | yes | {"engine":"series","adapter":"gill","mount":"static"} |
| `/articles/dzhon-gill-istoricheskiy-kontekst/` | astro/production-dist | article | strict-native | yes | yes | {"engine":"series","adapter":"gill","mount":"static"} |
| `/articles/dzhon-gill-spravochnik/` | astro/production-dist | article | strict-native | yes | yes | {"engine":"series","adapter":"gill","mount":"static"} |
| `/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/` | astro/production-dist | article | strict-native |  |  | {"engine":"article","adapter":"hermenevtika","mount":"static"} |
| `/articles/kak-hranit-serdce/` | astro/production-dist | article | strict-native | yes | yes |  |
| `/articles/kak-menyaetsya-serdce/` | astro/production-dist | article | strict-native | yes | yes |  |
| `/articles/kod-da-vinchi/` | astro/production-dist | article | strict-native |  |  |  |
| `/articles/krajne-li-isporcheno-serdce/` | astro/production-dist | article | strict-native | yes | yes |  |
| `/articles/myslennaya-zhizn-serdca/` | astro/production-dist | article | strict-native | yes | yes |  |
| `/articles/novoe-serdce/` | astro/production-dist | article | strict-native | yes | yes |  |
| `/articles/osvobozhdennoe-serdce/` | astro/production-dist | article | strict-native | yes | yes |  |
| `/articles/religioznoe-serdce/` | astro/production-dist | article | strict-native | yes | yes |  |
| `/articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy/` | astro/production-dist | article | strict-native | yes | yes |  |
| `/articles/serdce-hrista-k-nemoshchnym/` | astro/production-dist | article | strict-native | yes | yes |  |
| `/articles/serdce-i-duh/` | astro/production-dist | article | strict-native | yes | yes |  |
| `/articles/serdce-i-iskushenie/` | astro/production-dist | article | strict-native | yes | yes |  |
| `/articles/serdce-i-sokrovishche/` | astro/production-dist | article | strict-native | yes | yes |  |
| `/articles/serdce-i-telo/` | astro/production-dist | article | strict-native | yes | yes |  |
| `/articles/serdce-i-yazyk/` | astro/production-dist | article | strict-native | yes | yes |  |
| `/articles/serdce-ne-v-odinochku/` | astro/production-dist | article | strict-native | yes | yes |  |
| `/articles/serdce-pod-skorbyu/` | astro/production-dist | article | strict-native | yes | yes |  |
| `/articles/serdce-spravochnik/` | astro/production-dist | article | strict-native | yes | yes |  |
| `/articles/skrytye-idoly-serdca/` | astro/production-dist | article | strict-native | yes | yes |  |
| `/articles/sovest-vnutrenniy-sud/` | astro/production-dist | article | strict-native | yes | yes |  |
| `/articles/starye-dorozhki-serdca/` | astro/production-dist | article | strict-native | yes | yes |  |
| `/articles/strah-bozhij-rabskij-ili-synovnij/` | astro/production-dist | article | strict-native | yes | yes |  |
| `/articles/svoboda-vo-hriste/` | astro/production-dist | article | strict-native | yes | yes |  |
| `/articles/tma-na-serdce/` | astro/production-dist | article | strict-native | yes | yes |  |
| `/baptisty-rossii/` | astro/production-dist | unknown | strict-native |  |  |  |
| `/baptisty-rossii/dva-sezda-1884/` | astro/production-dist | series-article | strict-native | yes | yes |  |
| `/baptisty-rossii/goneniya-i-sovest/` | astro/production-dist | series-article | strict-native | yes | yes |  |
| `/baptisty-rossii/iniciativnaya-gruppa/` | astro/production-dist | series-article | strict-native | yes | yes |  |
| `/baptisty-rossii/noch-na-kure/` | astro/production-dist | series-article | strict-native | yes | yes |  |
| `/baptisty-rossii/peterburgskaya-liniya/` | astro/production-dist | series-article | strict-native | yes | yes |  |
| `/baptisty-rossii/podpolnaya-pechat/` | astro/production-dist | series-article | strict-native | yes | yes |  |
| `/baptisty-rossii/sovetskaya-noch/` | astro/production-dist | series-article | strict-native | yes | yes |  |
| `/baptisty-rossii/spravochnik/` | astro/production-dist | series-article | strict-native | yes | yes |  |
| `/baptisty-rossii/vsehib-1944/` | astro/production-dist | series-article | strict-native | yes | yes |  |
| `/baptisty-rossii/yuzhnaya-shtunda/` | astro/production-dist | series-article | strict-native | yes | yes |  |
| `/biografii/` | astro/production-dist | biographies-index | strict-native | yes |  | {"engine":"page","adapter":"default-page","mount":"registry"} |
| `/hard-texts/` | astro/production-dist | hard-texts-index | strict-native | yes |  | {"engine":"page","adapter":"default-page","mount":"registry"} |
| `/izbrannoe/` | astro/production-dist |  | strict-native |  |  |  |
| `/karty/` | astro/production-dist | unknown | strict-native | yes |  | {"engine":"page","adapter":"default-page","mount":"registry"} |
| `/karty/avraam/` | astro/production-dist | map | strict-native-app |  |  |  |
| `/karty/early-church/` | astro/production-dist | map | strict-native-app |  |  |  |
| `/karty/ishod/` | astro/production-dist | map | strict-native-app |  |  |  |
| `/karty/maccabim/` | astro/production-dist | map | strict-native-app |  |  |  |
| `/karty/melachim/` | astro/production-dist | map | strict-native-app |  |  |  |
| `/karty/pavel/` | astro/production-dist | map | strict-native |  |  |  |
| `/karty/revelation/` | astro/production-dist | map | strict-native-app |  |  |  |
| `/karty/shoftim/` | astro/production-dist | map | strict-native-app |  |  |  |
| `/karty/shvatim/` | astro/production-dist | map | strict-native-app |  |  |  |
| `/karty/yeshua/` | astro/production-dist | map | strict-native-app |  |  |  |
| `/konfessii/` | astro/production-dist | unknown | strict-native | yes |  | {"engine":"page","adapter":"default-page","mount":"registry"} |
| `/konfessii/russkij-baptizm/` | astro/production-dist | confession | strict-native-app |  |  |  |
| `/konfessii/russkij-baptizm/_app/` | built-app/copy-as-built-asset | confession |  |  |  |  |
| `/map/` | astro/production-dist | map-landing | strict-native-app |  |  |  |
| `/nagornaya/` | astro/production-dist | unknown | strict-native |  |  |  |
| `/nagornaya/chast-1/` | astro/production-dist | series-chapter | strict-native |  |  |  |
| `/nagornaya/chast-2/` | astro/production-dist | series-chapter | strict-native |  |  |  |
| `/nagornaya/chast-3/` | astro/production-dist | series-chapter | strict-native |  |  |  |
| `/nagornaya/chast-4/` | astro/production-dist | series-chapter | strict-native |  |  |  |
| `/nagornaya/chast-5/` | astro/production-dist | series-chapter | strict-native |  |  |  |
| `/nagornaya/istochniki/` | astro/production-dist | series-chapter | strict-native |  |  |  |
| `/nagornaya/nakhodki/` | astro/production-dist | series-chapter | strict-native |  |  |  |
| `/nagornaya/seriya/` | astro/production-dist | series-chapter | strict-native |  |  |  |
| `/pastor-series/` | astro/production-dist | pastor-index | strict-native |  |  |  |
| `/rodosloviye/` | astro/production-dist | genealogy | strict-native-app | yes |  | {"engine":"page","adapter":"default-page","mount":"registry"} |
