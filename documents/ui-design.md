# Gärngschee UI- und Layout-System

## Zweck

Dieses Dokument definiert die verbindlichen Regeln für Aufbau, Layout
und Darstellung des Gärngschee-Frontends.

Ziel ist kein individuelles Design jeder einzelnen Page. Pages werden
aus wenigen, konsistenten Bausteinen zusammengesetzt. Wenn diese
Bausteine korrekt verwendet werden, entstehen automatisch einheitliche,
responsive und wartbare Oberflächen.

Das System ergänzt Angular Material. Angular Material stellt die
UI-Controls bereit; das Gärngschee-Layout-System bestimmt deren
räumliche Anordnung.

> **Das Child kennt seinen Inhalt. Der Parent kennt den Raum.**

------------------------------------------------------------------------

## Farbsystem

Das Gärngschee-Farbsystem verwendet eine helle rosa Grundstimmung, einen
dunklen Pflaumenton für Text und Aktionen sowie klar unterscheidbare
Statusfarben. Farben werden nach ihrer semantischen Rolle verwendet und
nicht seiten- oder komponentenspezifisch frei gewählt.

| Rolle | Farbe | Verwendung |
|---|---|---|
| Seitenhintergrund | `#fff7fb` | Globaler Seitenhintergrund |
| Oberfläche | `#fff8fc` | Karten, E-Mail-Flächen und Inhaltsbereiche |
| Header / Primärcontainer | `#f5b6d3` | E-Mail-Header und hervorgehobene Markenbereiche |
| Primärfarbe | `#8a2858` | Links, Buttons und primäre Aktionen |
| Haupttext | `#000000` | Überschriften und normale Textinhalte |
| Sekundärtext | `#6f6069` | Beschreibungen und ergänzende Informationen |
| Rahmen | `#8c7b85` | Grenzen und Trennlinien |
| Erfolg-Hintergrund | `#dff4e8` | Erfolgs- und Bestätigungsbereiche |
| Erfolg-Text | `#276749` | Text und Hervorhebungen in Erfolgsbereichen |
| Warnung-Hintergrund | `#fff2b7` | Warnungen und offene Prüfungen |
| Warnung-Text | `#6b5700` | Text in Warnungsbereichen |
| Information-Hintergrund | `#d8e9f7` | Neutrale Informationsbereiche |
| Information-Text | `#2c5d78` | Text in Informationsbereichen |
| Fehler-Hintergrund | `#ffdad6` | Fehlermeldungen und blockierende Probleme |
| Fehler-Text | `#b3261e` | Text, Rahmen und Hervorhebungen in Fehlerbereichen |

Rosa ist die Marken- und Primärcontainerfarbe, nicht die Farbe für
Informationen. Links und primäre Aktionen verwenden `#8a2858`; ein beliebiger
roter Link ist nicht Teil des Farbsystems.

Die Rahmenfarbe erreicht auf den hellen Oberflächen einen ausreichenden
Kontrast für sichtbare UI-Grenzen. Frontend und E-Mail-Vorlagen verwenden für
den Marken-Header den gemeinsamen Wert `#f5b6d3`. Die semantischen
Statusfarben für Information, Warnung, Erfolg und Fehler sind systemweit
einheitlich.

Für ausreichende Lesbarkeit werden Text und Hintergrund immer als Paar
verwendet. Eine Information darf nicht ausschließlich durch Farbe vermittelt
werden, sondern benötigt zusätzlich Text, eine Beschriftung oder ein
geeignetes Symbol.

Bei `InfoBoxComponent`-Varianten kennzeichnet die Statusfarbe den Rahmen und
das Icon. Der Inhaltstext bleibt bewusst in der gut lesbaren Haupttextfarbe.
Jede Statusmeldung muss deshalb zusätzlich eine verständliche Überschrift oder
Nachricht enthalten; die Farbe allein ist niemals die Bedeutung der Meldung.

Die E-Mail-Vorschauen unter `frontend/public/test/index.html` zeigen die
Farbrollen und ihre praktische Verwendung.

### Farben der Home-Karten

Die beiden Home-Karten verwenden Rosa und Mintgrün als Kategorienfarben:

-   Die Karte zum Erfüllen eines Weihnachtswunsches verwendet den primären Container und damit die
    Markenfarbe Rosa.
-   Die Karte zum Erhalten von Weihnachtswünsche verwendet den sekundären Container
    und damit Mintgrün.

Diese Farben beschreiben unterschiedliche Einstiege, aber keinen Status. Sie
stehen weder für Erfolg noch für eine abgeschlossene oder verfügbare Aktion.
Die Bedeutung wird immer durch die klare Überschrift, den Beschreibungstext
und die beschriftete Aktion vermittelt und darf nicht allein aus der Farbe
abgeleitet werden.

------------------------------------------------------------------------

# 1. Grundprinzipien

## Mobile First

Mobile ist das Standardlayout.

Layouts werden zuerst für schmale Bildschirme definiert. Bei
ausreichender Bildschirmbreite dürfen sie erweitert werden,
beispielsweise indem zwei Sections nebeneinander dargestellt werden.

Desktop-Layouts sind progressive Erweiterungen des mobilen Layouts und
keine eigenständigen Layouts.

## Accessibility First

Semantisches HTML wird bevorzugt.

HTML-Elemente werden nach ihrer Bedeutung und nicht nach ihrer
gewünschten Darstellung gewählt.

Insbesondere:

-   `main` kennzeichnet den Hauptinhalt der Anwendung.
-   `nav` wird für Navigation verwendet.
-   `section` wird für fachlich zusammengehörige Inhaltsbereiche
    verwendet.
-   Überschriften bilden eine korrekte Hierarchie.
-   Interaktive Aktionen verwenden dafür vorgesehene HTML- bzw.
    Angular-Material-Elemente.
-   Klickbare `div`- oder `span`-Elemente werden vermieden.
-   Angular Material übernimmt soweit möglich Fokusverhalten,
    Tastaturbedienung und Accessibility der Controls.

## Composition over individual Design

Eine Page wird nicht individuell gestaltet, sondern aus vorhandenen
UI-Komponenten und Layout-Primitives zusammengesetzt.

Bevor neues Layout-CSS geschrieben wird, ist zu prüfen:

1.  Kann das Layout mit einem vorhandenen Layout-Primitive umgesetzt
    werden?
2.  Kann ein bestehendes Primitive sinnvoll erweitert werden?
3.  Gibt es tatsächlich ein neues wiederverwendbares Layout-Muster?
4.  Erst danach ist komponentenspezifisches Layout-CSS zulässig.

Keine neue Abstraktion wird nur für einen hypothetischen zukünftigen
Anwendungsfall eingeführt.

------------------------------------------------------------------------

# 2. Verantwortlichkeiten

Das UI-System besteht aus vier Ebenen:

1.  Page Shell
2.  Layout-Primitives
3.  UI-Komponenten
4.  Fachliche Komponenten

## Page Shell

Die Page Shell definiert den globalen Seitenrahmen der Anwendung.

## Layout-Primitives

Layout-Primitives bestimmen:

-   verfügbare Breite
-   Abstände
-   vertikale und horizontale Anordnung
-   Spalten
-   responsives Verhalten

Reine Layout-Primitives werden grundsätzlich als globale CSS-Klassen
umgesetzt und nicht als Angular Components.

## UI-Komponenten

Angular Material und gemeinsame Gärngschee-Komponenten stellen
wiederverwendbare UI-Funktionalität bereit.

Beispiele:

-   Angular Material Form Fields
-   Buttons
-   Selects
-   Dialoge
-   `InfoBoxComponent`
-   `ControlErrorComponent`
-   Loading Spinner
-   Empty State

Ein wiederverwendbares Verhalten oder eine eigenständige UI-Bedeutung
kann eine Angular Component rechtfertigen.

Reines Layout rechtfertigt keine Angular Component.

## Fachliche Komponenten

Fachliche Komponenten kennen ihren Inhalt und ihr internes Layout.

Sie bestimmen nicht ihre Position oder Breite innerhalb der
übergeordneten Page.

------------------------------------------------------------------------

# 3. Globaler Seitenrahmen

Der globale Seitenrahmen wird ausschliesslich in `app.html` definiert.

Er enthält in dieser Reihenfolge:

1.  Header
2.  Navigation
3.  Hauptinhalt (`main`)
    -   Seitencontainer
    -   sichtbare `h1`
    -   zentrale Informationszone
    -   `router-outlet`

Schematisch:

``` text
Header
Navigation
main
└── gl-container
    └── gl-stack
        ├── h1
        ├── Informationszone
        └── router-outlet
```

Geroutete Komponenten erzeugen:

-   keinen eigenen globalen Header
-   keine globale Navigation
-   kein eigenes `main`
-   keine eigene `h1`

Sie liefern ausschliesslich den fachlichen Inhalt der jeweiligen Page.

------------------------------------------------------------------------

# 4. Überschriften und Semantik

Jede normale Page besitzt genau eine sichtbare `h1`.

Die `h1` befindet sich im globalen Seitenrahmen oberhalb der
Informationszone und des `router-outlet`.

Geroutete Komponenten beginnen bei Bedarf mit `h2`.

Weitere Unterteilungen verwenden entsprechend `h3`, `h4` usw.

Die Wahl des Heading-Levels richtet sich ausschliesslich nach der
semantischen Dokumentstruktur. Eine Überschrift darf nicht nur deshalb
als anderes HTML-Element umgesetzt werden, weil eine andere
Schriftgrösse gewünscht ist.

Sections sollen verwendet werden, wenn ein Inhalt einen eigenständigen
fachlichen Abschnitt bildet. Eine Section besitzt in der Regel eine
passende Überschrift.

------------------------------------------------------------------------

# 5. Informationszone

Direkt nach der Seitenüberschrift und vor dem `router-outlet` befindet
sich die zentrale Informationszone.

Sie stellt Meldungen aus dem globalen State dar.

Dazu gehören insbesondere:

-   Informationen
-   Erfolgsmeldungen
-   Warnungen
-   Fehlermeldungen

Für deren Darstellung wird die bestehende `InfoBoxComponent` verwendet.

Die Info-Box unterstützt die vorgesehenen Varianten wie `info`,
`success`, `warning` und `error`.

Geroutete Komponenten rendern seitenweite Meldungen nicht selbst. Sie
stellen diese über den vorgesehenen Store-/Action-Mechanismus bereit.

Die Informationszone ist Teil des globalen Seitenrahmens und besitzt auf
jeder Page dieselbe Position und Darstellung.

------------------------------------------------------------------------

# 6. Feldbezogene Validierungsfehler

Validierungsfehler eines einzelnen Form-Controls werden unmittelbar
unterhalb des zugehörigen Controls dargestellt.

Dafür wird ausschliesslich die bestehende `ControlErrorComponent`
verwendet.

Die Komponente erhält das zugehörige Control bzw. den zugehörigen
Field-State, liest dessen Fehler selbst aus und zeigt immer den ersten
relevanten Fehler an.

Bei Signal Forms wird der jeweilige `FieldState` über `[control]`
übergeben und der passende Übersetzungspfad über `translationPrefix`
gesetzt.

Inline implementierte Feldfehlermeldungen in Page-Templates sind nicht
erlaubt.

Feldbezogene Validierungsfehler und seitenweite Meldungen sind zwei
unterschiedliche Konzepte:

-   Feldfehler gehören direkt zum Control.
-   Seitenweite Meldungen gehören in die zentrale Informationszone.

------------------------------------------------------------------------

# 7. Breite und externe Positionierung

Komponenten und Sections bestimmen ihre externe Breite nicht selbst.

Sie beanspruchen grundsätzlich die gesamte Breite des vom Parent
bereitgestellten Layout-Bereichs.

Feste Breiten, prozentuale Komponentenbreiten und individuelle
`max-width`-Definitionen innerhalb fachlicher Komponenten sind
grundsätzlich zu vermeiden.

Wenn mehrere Bereiche nebeneinander dargestellt werden sollen, bestimmt
der gemeinsame Parent die Aufteilung.

Eine fachliche Komponente darf insbesondere nicht durch eigene Regeln
wie diese positioniert werden:

``` scss
.my-component {
  width: 50%;
  margin-left: 2rem;
  margin-top: 1rem;
}
```

Die räumliche Beziehung zu Geschwisterelementen ist Aufgabe des Parents.

Komponenten dürfen dagegen ihr internes Layout selbst bestimmen,
beispielsweise:

-   internes Padding
-   Anordnung eigener Unterelemente
-   Abstand zwischen intern zusammengehörigen Elementen

------------------------------------------------------------------------

# 8. Layout-Primitives

Für Standardlayouts werden globale `gl-*` CSS-Klassen verwendet.

Die Anzahl der Layout-Primitives soll bewusst klein bleiben.

## `gl-container`

`gl-container` definiert den äusseren Inhaltsrahmen.

Es ist verantwortlich für:

-   maximale Inhaltsbreite
-   horizontale Zentrierung
-   Abstand des Inhalts zum Viewport

Untergeordnete Komponenten erzeugen keinen eigenen Abstand zum
Bildschirmrand.

### Kontrast bei dekorativen Hintergrundbildern

Ein dekoratives Hintergrundbild darf niemals dafür verantwortlich sein,
dass Text und Bedienelemente ausreichend lesbar sind.

Wenn eine Page ein Bild als Hintergrund verwendet, muss der globale
Content-Bereich selbst einen ausreichenden, vom jeweiligen Bildausschnitt
unabhängigen Kontrast gewährleisten. Dies gilt für alle Bildschirmgrössen
und responsiven Bildausschnitte.

Die kontrastsichernde Fläche gehört zum globalen Layout und nicht zu den
einzelnen fachlichen Komponenten. Sie umfasst den zusammengehörigen
Seiteninhalt innerhalb des Seitenrahmens, insbesondere:

-   Seitenüberschrift
-   Informationszone
-   gerouteten Seiteninhalt

Die Fläche darf beispielsweise einen hellen oder leicht transparenten
Hintergrund besitzen. Sie ist jedoch keine `mat-card` und soll nicht wie
eine fachliche Card behandelt werden.

Rundungen, Schatten oder andere dekorative Card-Effekte sind für diese
Fläche nicht erforderlich. Ihr Zweck ist die zuverlässige Lesbarkeit des
Inhalts unabhängig vom Hintergrundbild.

Der notwendige Textkontrast muss durch die Content-Fläche selbst
sichergestellt sein und darf nicht davon abhängen, welcher Teil des
Hintergrundbildes sich gerade hinter einem Element befindet.

## `gl-stack`

`gl-stack` ordnet seine direkten Children vertikal an.

Der Stack bestimmt den Abstand zwischen seinen Children. Die Children
selbst erzeugen dafür keine oberen oder unteren Margins.

Der normale Stack verwendet den Standardabstand für zusammengehörige
Elemente.

Semantische Varianten dürfen für klar definierte Beziehungen vorgesehen
werden, beispielsweise:

-   normaler Zusammenhang
-   getrennte Gruppen
-   Sections

Varianten sollen eine Bedeutung ausdrücken und nicht lediglich eine
gewünschte Pixelgrösse.

Bevorzugt werden daher Namen wie:

``` text
gl-stack
gl-stack--group
gl-stack--section
```

anstelle beliebiger Grössenvarianten wie `small`, `medium`, `large` oder
`xlarge`.

## `gl-cluster`

`gl-cluster` ordnet zusammengehörige Elemente horizontal an.

Bei zu wenig Platz dürfen die Elemente umbrechen.

Typische Anwendungen sind beispielsweise mehrere zusammengehörige
Actions.

## `gl-section-layout`

`gl-section-layout` ordnet fachliche Sections an.

Mobile werden Sections standardmässig untereinander dargestellt.

Bei ausreichender Bildschirmbreite können zwei zusammengehörige Sections
in zwei gleich breite Spalten aufgeteilt werden.

Schematisch:

``` text
Mobile

Section A
████████████████

Section B
████████████████


Breiter Bildschirm

Section A           Section B
████████████        ████████████
████████████        ████████████
```

Die Sections selbst wissen nicht, ob sie ein- oder zweispaltig
dargestellt werden.

------------------------------------------------------------------------

# 9. Spacing-System

Es werden nur wenige definierte Abstände verwendet.

Ausgangspunkt ist folgende Skala:

``` scss
:root {
  --gl-space-sm: 0.5rem;
  --gl-space-md: 1rem;
  --gl-space-lg: 1.5rem;
  --gl-space-xl: 2rem;
}
```

Die konkreten Werte können zentral angepasst werden. Fachliche
Komponenten dürfen daraus keine eigenen parallelen Spacing-Systeme
ableiten.

Die Abstände besitzen folgende Bedeutung:

  Abstand   Bedeutung
  --------- --------------------------------------------------------------
  `sm`      enger Zusammenhang, beispielsweise Hilfetext oder Feldfehler
  `md`      normaler Abstand zwischen zusammengehörigen Elementen
  `lg`      Abstand zwischen getrennten Gruppen
  `xl`      Abstand zwischen grossen Inhaltsbereichen oder Sections

Der Entwickler bzw. Agent soll die semantische Beziehung der Elemente
ausdrücken und nicht einen individuellen Pixelabstand auswählen.

Beliebige Werte wie `13px`, `22px` oder ähnliche komponentenspezifische
Abstände sind zu vermeiden.

------------------------------------------------------------------------

# 10. Sections und responsive Darstellung

Sections werden Mobile grundsätzlich untereinander dargestellt.

Wenn genügend Platz vorhanden ist, dürfen zwei zusammengehörige Sections
durch den Parent 50:50 nebeneinander angeordnet werden.

Der Breakpoint wird zentral im Layout-System definiert.

Fachliche Komponenten implementieren keine eigenen Breakpoints für ihre
externe Positionierung.

Responsive Verhalten folgt dem Prinzip:

> Das mobile Layout ist vollständig funktionsfähig. Zusätzlicher Platz
> verbessert die Anordnung, verändert aber nicht das fachliche
> Bedienkonzept.

------------------------------------------------------------------------

# 11. Formulare

Alle Formulare verwenden Angular Signal Forms gemäss den
Frontend-Konventionen des Projekts.

Angular Material stellt die Form Controls bereit.

Standardmässig sind Formulare Mobile einspaltig.

Form Controls beanspruchen die gesamte vom Parent bereitgestellte
Breite.

Beispiel:

``` text
Name
████████████████

E-Mail
████████████████

Telefon
████████████████
```

Auf breiteren Bildschirmen dürfen fachlich eng zusammengehörige Felder
nebeneinander dargestellt werden.

Beispiele:

``` text
Vorname                 Nachname
████████████████        ████████████████

Strasse
████████████████████████████████████████

PLZ                     Ort
████████████████        ████████████████
```

Die zweispaltige Darstellung ist eine Entscheidung des gemeinsamen
Layout-Parents und keine Eigenschaft der einzelnen Form Controls.

Formulare werden nicht automatisch zweispaltig, nur weil genügend
Bildschirmbreite vorhanden ist. Felder werden nur dann gruppiert, wenn
die gemeinsame Darstellung fachlich sinnvoll ist.

Für Angular-Material-Controls gelten deren Standarddarstellung und
Standardzustände. Eigene Styles für Borders, Focus-, Error- oder
ähnliche Zustände werden nicht implementiert, wenn Angular Material
diese bereits bereitstellt.

------------------------------------------------------------------------

# 12. Angular Material

Angular Material ist das primäre UI-Component-System.

Angular Material ist insbesondere verantwortlich für:

-   Form Controls
-   Buttons
-   Checkboxen
-   Selects
-   Dialoge
-   Icons
-   Fokuszustände
-   Tastaturbedienung
-   Control-Zustände
-   grundlegende Accessibility
-   Theme-basierte Darstellung

Das Gärngschee-UI-System ergänzt Angular Material um Layout und
projektspezifische UI-Komponenten.

Material-interne Klassen wie `.mat-mdc-*` oder `.mdc-*` sollen nicht für
projektspezifische Layout-Anpassungen überschrieben werden.

Bevor eigenes CSS geschrieben wird, ist zu prüfen, ob Angular Material
die benötigte Darstellung bereits bereitstellt.

------------------------------------------------------------------------

# 13. Cards

`mat-card` ist kein allgemeiner Page-Container.

Eine Page wird nicht automatisch in eine Card verpackt.

Cards werden nur verwendet, wenn der dargestellte Inhalt fachlich
tatsächlich einen abgegrenzten, eigenständigen Inhaltsblock darstellt.

Für die reine Strukturierung oder Gruppierung einer Page werden
semantisches HTML und die vorhandenen Layout-Primitives verwendet.

Insbesondere soll eine `section` nicht allein deshalb in eine `mat-card`
gelegt werden, um Abstand, Border oder Hintergrund zu erhalten.

------------------------------------------------------------------------

# 14. Actions und Buttons

Buttons verwenden grundsätzlich Angular Material.

Die Anordnung mehrerer zusammengehöriger Actions ist Aufgabe des Parents
und soll über ein vorhandenes Layout-Primitive wie `gl-cluster`
erfolgen.

Buttons definieren keine eigenen externen Margins, um Abstand zu
benachbarten Buttons oder anderen Komponenten zu erzeugen.

Auf kleinen Bildschirmen muss die Action-Anordnung ohne horizontales
Scrollen oder abgeschnittene Controls funktionieren.

Eine individuelle feste Button-Breite wird nur verwendet, wenn dafür ein
konkreter fachlicher oder ergonomischer Grund besteht.

------------------------------------------------------------------------

# 15. Komponenten-CSS

Komponentenspezifisches SCSS ist für das interne Layout und die
spezifische Darstellung einer Komponente vorgesehen.

Es ist nicht dafür vorgesehen, die Komponente innerhalb ihrer
Parent-Page zu positionieren.

Zulässig sind beispielsweise:

-   internes Padding
-   interne Grid-/Flex-Anordnung
-   spezifische Darstellung eigener Inhalte
-   stylespezifisches Verhalten einer echten UI-Komponente

Zu vermeiden sind insbesondere:

-   externe `margin-top`-/`margin-bottom`-Regeln zur Page-Gestaltung
-   individuelle Page-Breiten
-   individuelle Page-Breakpoints
-   Duplikate vorhandener `gl-*` Layout-Regeln
-   Überschreiben von Angular-Material-Styles ohne konkreten Bedarf

Wenn keine komponentenspezifischen Styles benötigt werden, bleibt die
SCSS-Datei leer.

------------------------------------------------------------------------

# 16. Neue UI-Komponenten

Gemeinsame UI-Patterns werden nicht automatisch zu Angular Components.

Vor der Erstellung einer neuen gemeinsamen Component ist zu prüfen:

-   Besitzt das Element eine eigenständige UI-Bedeutung?
-   Besitzt es Verhalten?
-   Besitzt es eine stabile, wiederverwendbare HTML-Struktur?
-   Wird es tatsächlich mehrfach benötigt?

Wenn lediglich Anordnung, Abstand oder Breite wiederverwendet werden
soll, ist ein Layout-Primitive zu verwenden.

Beispiele für sinnvolle gemeinsame Components:

-   `InfoBoxComponent`
-   `ControlErrorComponent`
-   Loading Spinner
-   Empty State

Beispiele für Dinge, die grundsätzlich keine Angular Component
benötigen:

-   Container
-   Stack
-   Cluster
-   zweispaltiges Section-Layout

------------------------------------------------------------------------

# 17. Regeln für AI-Assistenten

Bei Änderungen an Page-Templates oder UI-Styles ist in dieser
Reihenfolge vorzugehen:

1.  Bestehende semantische HTML-Struktur verwenden.
2.  Angular-Material-Komponente verwenden, wenn eine passende vorhanden
    ist.
3.  Bestehendes `gl-*` Layout-Primitive verwenden.
4.  Bestehende gemeinsame Gärngschee-UI-Komponente verwenden.
5.  Erst danach prüfen, ob neues komponentenspezifisches CSS oder ein
    neuer wiederverwendbarer Baustein notwendig ist.

AI-Assistenten dürfen nicht für jede Page ein individuelles Layout
entwickeln.

Insbesondere sollen sie nicht:

-   eigene Page-Container erfinden
-   individuelle Abstände festlegen
-   Components über externe Margins positionieren
-   fachlichen Components feste Breiten geben
-   ohne fachlichen Grund Cards verwenden
-   vorhandene Angular-Material-Darstellung nachbauen
-   reine Layout-Probleme durch neue Angular Components lösen
-   neue Breakpoints innerhalb fachlicher Komponenten einführen

Wenn eine Anforderung mit dem vorhandenen UI-System nicht sinnvoll
umgesetzt werden kann, soll dies gemeldet werden, bevor ein neues
Layout-Muster eingeführt wird.

------------------------------------------------------------------------

# 18. Kurzreferenz

## Page

``` text
Header
Navigation
main
└── gl-container
    └── gl-stack
        ├── h1
        ├── Info-Zone
        └── router-outlet
```

## Layout

``` text
gl-container        äusserer Inhaltsrahmen
gl-stack            vertikale Anordnung
gl-cluster          horizontale/wrappende Anordnung
gl-section-layout   Mobile 1 Spalte, breit optional 50:50
```

## Spacing

``` text
sm   enger Zusammenhang
md   normaler Zusammenhang
lg   getrennte Gruppen
xl   Sections / grosse Inhaltsbereiche
```

## Verantwortlichkeit

``` text
Parent
├── Breite
├── Position
├── Abstand zwischen Children
└── Responsive Anordnung

Child
├── Inhalt
├── internes Layout
└── eigene UI-Darstellung
```

> **Das Child kennt seinen Inhalt. Der Parent kennt den Raum.**
