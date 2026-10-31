# Standaggs Spades Scorekeeper

A lightning-fast, progressive web app (PWA) designed for keeping score in cutthroat Spades. Built for mobile, this scorekeeper eliminates the math and arguments so you can focus on the game. 

## ♠️ Core Features

*   **Lightning-Fast Input:** Designed for speed at the table. Type in the bids and the tricks caught, and the app does the rest. 
*   **Cutthroat House Rules:**
    *   *First Hand Bids Itself:* Optional rule where the first hand has no bidding phase; you must catch a minimum of 4 books or you instantly lose the game.
    *   *Double Set Mercy Rule:* Getting set twice in a row results in an automatic loss.
    *   *Forgiving Nils:* If a player busts their Nil, the tricks they caught flow into the team pool to help the partner satisfy the board bid.
    *   *Capped Sets:* A team can only suffer a maximum of 1 Set per round, even if they miss both their Nil and their board bid.
*   **Advanced Career Leaderboard:** Under the hood, the app tracks your group's lifetime stats:
    *   **Hall of Fame:** Win Percentage, Average Points, and Nil Success Rates.
    *   **Wall of Shame:** Total Sets, Bag-Outs, and Renegades.
*   **Cross-Device Syncing:** Generate a text-friendly Base64 export code to merge your leaderboard with your friends' phones after game night.
*   **Smart Rematch:** Hit "Rematch" to keep the same teams and instantly start a new game—the app automatically forces the losing team to deal the first hand.
*   **Clipboard Export:** One-tap export to copy a cleanly formatted text summary of the match (round-by-round) to paste into your group chat.

## 🚀 Installation / Setup

This is a Progressive Web App (PWA). You do not need an app store to install it.

1. Navigate to the hosted GitHub Pages link on your mobile device (Safari for iOS, Chrome for Android).
2. Tap your browser's menu (Share button on iOS, three dots on Android).
3. Select **"Add to Home Screen"**.
4. The app will now function natively on your phone, complete with offline support and a clean, fullscreen interface.

## 🛠 Tech Stack

*   **HTML5 / CSS3** (Custom responsive grid layout, Dark/Light mode support)
*   **Vanilla JavaScript** (Zero dependencies, lightning-fast execution)
*   **Local Storage API** (Saves game state continuously so you never lose your score if the app is closed)
*   **Service Workers** (Allows for full offline capability)
