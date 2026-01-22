// --- 1. State & Persistence ---
const savedState = localStorage.getItem('spades_game_state');
let initialState = savedState ? JSON.parse(savedState) : null;

const state = {
    view: initialState?.view || 'setup',
    players: initialState?.players || ['', '', '', ''],
    goal: initialState?.goal || 500,
    nilValue: initialState?.nilValue || 100,
    bagLimit: initialState?.bagLimit || 10,
    bagPenalty: initialState?.bagPenalty || 100,
    setLimit: initialState?.setLimit || 3,
    dealerIndex: initialState?.dealerIndex || 0,
    darkMode: initialState?.darkMode || false,
    teams: initialState?.teams || [
        { name: "Team 1", members: [], score: 0, bags: 0, setCount: 0 },
        { name: "Team 2", members: [], score: 0, bags: 0, setCount: 0 }
    ],
    history: initialState?.history || [],
    winner: initialState?.winner || null,
    winReason: initialState?.winReason || "",
    statsRecorded: initialState?.statsRecorded || false
};

if (state.darkMode) document.body.classList.add('dark-mode');
const save = () => localStorage.setItem('spades_game_state', JSON.stringify(state));

// --- 2. Career Stats ---
function recordCareerStats() {
    if (state.statsRecorded || !state.winner) return;
    let career = JSON.parse(localStorage.getItem('spades_career_stats')) || {};
    state.players.forEach(name => {
        const n = name.trim(); if (!n) return;
        if (!career[n]) career[n] = { wins: 0, games: 0, sets: 0 };
        career[n].games++;
    });
    const winningTeam = state.teams.find(t => t.name === state.winner);
    winningTeam.members.forEach(name => { if (career[name.trim()]) career[name.trim()].wins++; });
    state.teams.forEach(team => {
        team.members.forEach(name => { if (career[name.trim()]) career[name.trim()].sets += team.setCount; });
    });
    localStorage.setItem('spades_career_stats', JSON.stringify(career));
    state.statsRecorded = true; save();
}

window.clearAllStats = () => {
    if (confirm("Delete ALL career records?")) {
        localStorage.removeItem('spades_career_stats');
        state.view = 'setup'; render();
    }
};

// --- 3. Scoring Engine (Includes Renegade Logic) ---
function getTotalsAtStep(historyArray) {
    let t = [
        { score: 0, bags: 0, setCount: 0, consecutive: 0, instantLoss: false, lossReason: "" },
        { score: 0, bags: 0, setCount: 0, consecutive: 0, instantLoss: false, lossReason: "" }
    ];

    historyArray.forEach(round => {
        const hands = [round.t1, round.t2];
        hands.forEach((hand, i) => {
            const team = t[i];
            const oppHand = hands[i === 0 ? 1 : 0];
            let isSet = false;

            // Nil Logic
            if (hand.isNil) {
                if (hand.nilGot === 0) team.score += state.nilValue;
                else { team.score -= state.nilValue; isSet = true; }
            }

            // Standard Bid Logic
            const teammateTricks = hand.teamGot - (hand.isNil ? hand.nilGot : 0);
            if (hand.bid > 0) {
                // Renegade check: Offending team is automatically set
                if (teammateTricks >= hand.bid && !hand.reneg) {
                    const extras = teammateTricks - hand.bid;
                    if (oppHand.reneg) {
                        // House Rule: Bonus tricks from opponent renegade = 10pts each, NO bags
                        team.score += (hand.bid * 10) + (extras * 10);
                    } else {
                        team.score += (hand.bid * 10) + extras;
                        team.bags += extras;
                    }
                } else {
                    team.score -= (hand.bid * 10);
                    isSet = true;
                }
            } else if (!hand.isNil) {
                // If they didn't bid and didn't nil, they just collect bags
                team.bags += teammateTricks;
            }

            if (isSet) { team.setCount++; team.consecutive++; } else { team.consecutive = 0; }
            if (team.bags >= state.bagLimit) { team.score -= state.bagPenalty; team.bags -= state.bagLimit; }
            
            if (team.setCount >= state.setLimit) { team.instantLoss = true; team.lossReason = "Hit set limit."; }
            if (team.consecutive >= 2) { team.instantLoss = true; team.lossReason = "Back-to-back sets."; }
        });
    });
    return t;
}

function calculateScores() {
    const final = getTotalsAtStep(state.history);
    [0, 1].forEach(i => {
        state.teams[i].score = final[i].score;
        state.teams[i].bags = final[i].bags;
        state.teams[i].setCount = final[i].setCount;
    });

    state.winner = null;
    if (final[0].instantLoss) { state.winner = state.teams[1].name; state.winReason = `${state.teams[0].members.join(' & ')}: ${final[0].lossReason}`; }
    else if (final[1].instantLoss) { state.winner = state.teams[0].name; state.winReason = `${state.teams[1].members.join(' & ')}: ${final[1].lossReason}`; }
    else if (state.teams[0].score >= state.goal) { state.winner = state.teams[0].name; state.winReason = "Goal Reached!"; }
    else if (state.teams[1].score >= state.goal) { state.winner = state.teams[1].name; state.winReason = "Goal Reached!"; }

    if (state.winner) recordCareerStats();
    save();
}

// --- 4. Actions ---
window.autoFillTricks = (val) => {
    const otherVal = 13 - (parseInt(val) || 0);
    const target = document.getElementById('t1Got');
    if (target) target.value = Math.max(0, Math.min(13, otherVal));
};

window.submitHand = () => {
    let t0Got = parseInt(document.getElementById('t0Got').value) || 0;
    let t1Got = parseInt(document.getElementById('t1Got').value) || 0;
    const t0Reneg = document.getElementById('t0Reneg').checked;
    const t1Reneg = document.getElementById('t1Reneg').checked;

    if (t0Got + t1Got !== 13) return alert(`Total tricks must be 13. Current: ${t0Got + t1Got}`);

    // Apply 3-book Renegade penalty
    if (t0Reneg) { let p = Math.min(t0Got, 3); t0Got -= p; t1Got += p; }
    if (t1Reneg) { let p = Math.min(t1Got, 3); t1Got -= p; t0Got += p; }

    const getData = (id, got, reneg) => ({
        bid: parseInt(document.getElementById(`${id}Bid`).value) || 0,
        teamGot: got,
        isNil: document.getElementById(`${id}Nil`).checked,
        nilGot: parseInt(document.getElementById(`${id}NilGot`).value) || 0,
        reneg: reneg
    });

    state.history.push({ t1: getData('t0', t0Got, t0Reneg), t2: getData('t1', t1Got, t1Reneg) });
    calculateScores(); render();
};

window.exportGame = () => {
    const t1N = state.teams[0].members.join(' & ');
    const t2N = state.teams[1].members.join(' & ');
    const now = new Date().toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'});
    let txt = `♠️ SPADES SUMMARY (${now}) ♠️\nWINNERS: ${state.winner}\nREASON: ${state.winReason}\n\n`;
    state.history.forEach((h, i) => {
        const n1 = h.t1.isNil ? (h.t1.nilGot===0?" [N✅]":" [N❌]") : "";
        const n2 = h.t2.isNil ? (h.t2.nilGot===0?" [N✅]":" [N❌]") : "";
        const r1 = h.t1.reneg ? " [🚩]" : ""; const r2 = h.t2.reneg ? " [🚩]" : "";
        txt += `R${i+1}: ${t1N}(${h.t1.bid}/${h.t1.teamGot}${n1}${r1}) | ${t2N}(${h.t2.bid}/${h.t2.teamGot}${n2}${r2})\n`;
    });
    navigator.clipboard.writeText(txt); alert("History Copied!");
};

window.toggleDarkMode = () => { state.darkMode = !state.darkMode; document.body.classList.toggle('dark-mode', state.darkMode); save(); };
window.updatePlayer = (i, v) => { state.players[i] = v; const sel = document.getElementById('firstDealerSelect'); if (sel) sel.options[i].text = v || `Player ${i+1}`; };
window.resetGame = () => { if(confirm("Reset scores?")) { state.view='setup'; state.history=[]; state.winner=null; state.statsRecorded=false; state.teams.forEach(t=>{t.score=0;t.bags=0;t.setCount=0;}); save(); render(); }};

window.startGame = () => {
    if (state.players.some(p => !p.trim())) return alert("Names required");
    if (state.history.length === 0) {
        const dName = state.players[parseInt(document.getElementById('firstDealerSelect').value)];
        let shuff = [...state.players].sort(() => Math.random() - 0.5);
        state.players = shuff; state.dealerIndex = shuff.indexOf(dName);
        state.teams[0].members = [shuff[0], shuff[2]]; state.teams[1].members = [shuff[1], shuff[3]];
    }
    state.view = 'play'; calculateScores(); render();
};

// --- 5. Render ---
function render() {
    const container = document.getElementById('view-container'); if (!container) return;

    if (state.view === 'stats') {
        const career = JSON.parse(localStorage.getItem('spades_career_stats')) || {};
        const sorted = Object.entries(career).map(([name, d]) => ({ name, ...d, pct: d.games>0?(d.wins/d.games)*100:0 })).sort((a,b)=>b.pct-a.pct);
        container.innerHTML = `<div class="card"><h2>🏆 Leaderboard</h2>
            <table><thead><tr><th>Player</th><th>Win %</th><th>Sets</th></tr></thead>
            <tbody>${sorted.map((p,i)=>`<tr class="${i<3?`rank-${i+1}`:''}"><td>${p.name}</td><td>${p.pct.toFixed(1)}%</td><td>${p.sets}</td></tr>`).join('')}</tbody></table>
            <button onclick="state.view='setup';render()" style="margin-top:10px;">Back</button>
            <button onclick="clearAllStats()" style="background:none; color:var(--danger); border:1px solid var(--danger); font-size:0.7rem; margin-top:10px;">🗑️ Clear All Stats</button></div>`;
        return;
    }

    if (state.winner) {
        container.innerHTML = `<div class="card" style="text-align:center; border:4px solid var(--success);">
            <h1>🏆 VICTORY</h1><h3>${state.winner}</h3><p>${state.winReason}</p>
            <button onclick="exportGame()">Copy Results</button><button onclick="resetGame()" style="margin-top:10px;">New Game</button></div>`;
        return;
    }

    if (state.view === 'setup') {
        container.innerHTML = `<div class="card">
            <div class="flex-row"><h2>Setup</h2><button onclick="toggleDarkMode()">🌙</button></div>
            ${state.history.length === 0 ? `
                <label>Players:</label>${state.players.map((p, i) => `<input type="text" oninput="updatePlayer(${i}, this.value)" value="${p}">`).join('')}
                <label>First Dealer:</label><select id="firstDealerSelect">${state.players.map((n, i) => `<option value="${i}" ${state.dealerIndex===i?'selected':''}>${n||`Player ${i+1}`}</option>`).join('')}</select>
            ` : `<p>Game in progress.</p>`}
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; padding:10px; background:rgba(0,0,0,0.05); border-radius:8px;">
                <div>Goal: <select onchange="state.goal=parseInt(this.value)"><option value="250" ${state.goal==250?'selected':''}>250</option><option value="500" ${state.goal==500?'selected':''}>500</option></select></div>
                <div>Bags: <select onchange="state.bagLimit=parseInt(this.value)"><option value="5" ${state.bagLimit==5?'selected':''}>5</option><option value="10" ${state.bagLimit==10?'selected':''}>10</option></select></div>
                <div>Penalty: <select onchange="state.bagPenalty=parseInt(this.value)"><option value="50" ${state.bagPenalty==50?'selected':''}>50</option><option value="100" ${state.bagPenalty==100?'selected':''}>100</option></select></div>
                <div>Set Out: <select onchange="state.setLimit=parseInt(this.value)"><option value="2" ${state.setLimit==2?'selected':''}>2</option><option value="3" ${state.setLimit==3?'selected':''}>3</option></select></div>
            </div>
            <button onclick="startGame()" style="margin-top:20px;">${state.history.length>0?'Resume':'Start'}</button>
            <button onclick="state.view='stats';render()" style="background:#9b59b6;margin-top:10px;">Leaderboard</button></div>`;
    } else {
        const dealer = state.players[(state.dealerIndex + state.history.length) % 4];
        container.innerHTML = `
            <div class="flex-row card" style="padding:10px; font-size:0.75rem;">
                <span>🎯<b>${state.goal}</b> | 🎒<b>${state.bagLimit}</b> | ❌<b>${state.setLimit}</b></span>
                <button onclick="state.view='setup';render()" style="width:auto;padding:2px 8px;margin:0;background:#95a5a6;">⚙️</button>
            </div>
            <div class="team-grid">${state.teams.map(t => `<div class="card">
                <h3>${t.members.join(' & ')}</h3><small>${t.members.map(m=>m===dealer?`🃏 ${m}`:m).join(' & ')}</small>
                <div style="margin:5px 0;">${"❌".repeat(t.setCount)}</div>
                <div class="score-display">${t.score}</div><small>Bags: ${t.bags}/${state.bagLimit}</small>
            </div>`).join('')}</div>
            <div class="card"><h3>Record Hand <small style="float:right; opacity:0.6;">Dealer: ${dealer}</small></h3>
                <div class="team-grid">${[0,1].map(i=>`<div><b>T${i+1}</b>
                    <input type="number" id="t${i}Bid" placeholder="Bid">
                    <input type="number" id="t${i}Got" placeholder="Got" ${i===0?'oninput="autoFillTricks(this.value)"':''}>
                    <div style="margin-top:5px; font-size:0.7rem; background:#fff0f0; padding:5px; border-radius:4px; border:1px solid #ffcccc;">
                        <label style="color:#e74c3c;"><input type="checkbox" id="t${i}Reneg"> 🚩 RENEGE</label>
                    </div>
                    <div style="margin-top:5px; background:rgba(0,0,0,0.03); padding:5px;">
                        <label><input type="checkbox" id="t${i}Nil"> Nil?</label><input type="number" id="t${i}NilGot" placeholder="N-Got" style="width:40px">
                    </div>
                </div>`).join('')}</div>
                <button onclick="submitHand()" style="margin-top:10px;">Submit Hand</button>
            </div>
            <div class="card"><h3>History</h3>
                <table><thead><tr><th>#</th><th>T1</th><th>T2</th></tr></thead>
                <tbody>${state.history.map((h,i)=>`<tr><td>${i+1}</td><td>${h.t1.bid}/${h.t1.teamGot}</td><td>${h.t2.bid}/${h.t2.teamGot}</td></tr>`).reverse().join('')}</tbody></table>
                <button onclick="state.history.pop();calculateScores();render();" style="background:var(--warning); margin-top:10px;">Undo Last Round</button>
            </div>`;
    }
}
render();
