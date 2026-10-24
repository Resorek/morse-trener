# Morse Trainer

A browser app for learning Morse code – no install, no build step, works on phones too.

**Live version:** https://resorek.github.io/morse-trener/

## Features

- **Character groups** in a sliding sidebar (lessons 1–6: E T → I M S O → A N R W → D K G U → L P J B X C Y Z → Q F H V). Pick the lessons to draw characters from; click a letter to hear it.
- **Practice** – the app plays a character and you press the letter. Correct: it lights up green and the next one follows. Wrong: it turns red, shows the correct letter and plays it again. Session stats and per-letter accuracy.
- **Test** – choose how many characters and the gap between them, write down what you hear, and get a score, a character-by-character comparison and a list of mistakes at the end. A skipped character doesn't mark everything after it as wrong.
- **Phone** – a built-in on-screen keyboard (QWERTY, or big keys with only the selected letters).
- Light and dark theme (follows the system by default), adjustable speed (WPM), tone and volume. Settings are remembered in the browser.

## Run locally

Just open `index.html` in a browser. Or serve the folder:

```
py -m http.server 3040
```

and go to http://localhost:3040.

On an iPhone there's no sound while the silent switch is on.
