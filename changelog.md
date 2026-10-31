# Changelog

## [Version 3.0] - The "Hall of Fame" & Cutthroat Rules Update

### Added
*   **Advanced Leaderboard (Hall of Fame & Wall of Shame):** Now tracks individual and team career statistics including Win %, Sets Suffered, Bag-Outs, Nil Success Rate (Attempted vs. Caught), and Renegades.
*   **Leaderboard Import/Export:** Added a Base64 code generator to export career stats. Players can text this code to friends, and the "Import" function will mathematically merge the leaderboards together without overwriting existing data.
*   **"Rematch" Button:** Added a quick-restart option to the Winner screen that locks in the current teams, wipes the board, and drops players directly into Round 1.
*   **"Walk of Shame" Dealer Logic:** When hitting the Rematch button, the app automatically identifies the losing team and assigns them the dealer token for the first round of the new game.
*   **Auto-Capitalization (`formatName`):** Names are now automatically formatted into Title Case (e.g., "dan" becomes "Dan") to prevent duplicate database entries in the career stats.

### Changed
*   **Merged Trick Pools (Forgiving Nils):** Busted Nil tricks are no longer isolated. Any tricks caught by a busted Nil player now flow into the team's shared pool to help satisfy the board bid and avoid a set.
*   **Capped Sets:** A team can now only receive a maximum of 1 Set per hand. Failing a Nil and failing the board bid simultaneously will no longer cause a nuclear "double set" penalty.

### Fixed
*   **Checkbox GUI Alignment:** Overrode global CSS rules using inline Flexbox to stop the Nil and Renegade checkboxes from stretching to 100% width, fixing the misaligned player initials.
*   **Confusing History Markers:** Fixed an issue where the history table showed a double penalty (`5/5 ❌ N❌`). The generic red `❌` now only appears if the numerical board bid specifically fails, leaving `N❌` to indicate the busted Nil.