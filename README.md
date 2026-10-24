# Trener Morse'a

Aplikacja w przeglądarce do nauki alfabetu Morse'a – bez instalacji, działa też na telefonie.

**Wersja online:** https://resorek.github.io/morse-trener/

## Co potrafi

- **Grupy znaków** w wysuwanym panelu (lekcje 1–6: E T → I M S O → A N R W → D K G U → L P J B X C Y Z → Q F H V). Zaznaczasz, z których liter mają być losowane znaki; kliknięcie litery ją odtwarza.
- **Trening** – program gra znak, a Ty naciskasz literę. Dobrze: zielono i następny znak. Źle: czerwono, pokazana i odtworzona prawidłowa litera. Statystyki i skuteczność każdej litery.
- **Test** – wybierasz liczbę znaków i przerwę między nimi, zapisujesz, co słyszysz, a na końcu dostajesz wynik, porównanie znak po znaku i listę błędów.
- **Telefon** – własna klawiatura ekranowa (QWERTY albo duże klawisze tylko z zaznaczonymi literami).
- Jasny i ciemny motyw, regulacja prędkości (WPM), tonu i głośności. Ustawienia zapamiętują się w przeglądarce.

## Uruchomienie lokalnie

Wystarczy otworzyć `index.html` w przeglądarce. Albo:

```
py -m http.server 3040
```

i wejść na http://localhost:3040.

Na iPhonie dźwięk nie zagra przy włączonym przełączniku wyciszenia.
