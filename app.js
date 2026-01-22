// --- 1. State ---
const savedState = localStorage.getItem('spades_game_state');
let initialState = savedState ? JSON.parse(savedState) : null;

const state = {
    view: initialState?.view || 'setup',
    players: initialState?.players || ['', '', '', ''],
    teamMode: initialState?.teamMode || 'random',
    goal: initialState?.goal || 300,
    nilValue: 100,
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

// --- 2. Stats ---
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

// --- 3. Logic ---
function getTotalsAtStep(historyArray) {
    let t = [{ score: 0, bags: 0, setCount: 0, consecutive: 0 }, { score: 0, bags: 0, setCount: 0, consecutive: 0 }];
    historyArray.forEach(round => {
        const hands = [round.t1, round.t2];
        hands.forEach((hand, i) => {
            const team = t[i]; const oppHand = hands[i === 0 ? 1 : 0];
            let isSet = false;
            if (hand.isNil) {
                if (hand.nilGot === 0) team.score += state.nilValue;
                else { team.score -= state.nilValue; isSet = true; }
            }
            const tricks = hand.teamGot - (hand.isNil ? hand.nilGot : 0);
            if (hand.bid > 0) {
                if (tricks >= hand.bid && !hand.reneg) {
                    const extras = tricks - hand.bid;
                    if (oppHand.reneg) { team.score += (hand.bid * 10) + (extras * 10); } 
                    else { team.score += (hand.bid * 10) + extras; team.bags += extras; }
                } else { team.score -= (hand.bid * 10); isSet = true; }
            } else if (!hand.isNil) { team.bags += tricks; }
            if (isSet) { team.setCount++; team.consecutive++; } else { team.consecutive = 0; }
            if (team.bags >= state.bagLimit) { team.score -= state.bagPenalty; team.bags -= state.bagLimit; }
        });
    });
    return t;
}

function calculateScores() {
    const final = getTotalsAtStep(state.history);
    [0, 1].forEach(i => {
        state.teams[i].score = final[i].score; state.teams[i].bags = final[i].bags; state.teams[i].setCount = final[i].setCount;
    });
    state.winner = null;
    if (state.teams[0].setCount >= state.setLimit) { state.winner = state.teams[1].name; state.winReason = "Team 1 hit set limit."; }
    else if (state.teams[1].setCount >= state.setLimit) { state.winner = state.teams[0].name; state.winReason = "Team 2 hit set limit."; }
    else if (state.teams[0].score >= state.goal) { state.winner = state.teams[0].name; state.winReason = "Goal Reached!"; }
    else if (state.teams[1].score >= state.goal) { state.winner = state.teams[1].name; state.winReason = "Goal Reached!"; }
    if (state.winner) recordCareerStats();
    save();
}

// --- 4. Actions ---
window.toggleDarkMode = () => { state.darkMode = !state.darkMode; document.body.classList.toggle('dark-mode', state.darkMode); save(); };
window.autoFillTricks = (val) => { const other = 13 - (parseInt(val) || 0); const target = document.getElementById('t1Got'); if (target) target.value = Math.max(0, Math.min(13, other)); };

window.startGame = () => {
    if (state.players.some(p => !p.trim())) return alert("Names required");
    if (state.history.length === 0) {
        const dealerSelect = document.getElementById('firstDealerSelect');
        const selectedValue = parseInt(dealerSelect.value);
        let firstDealerName = selectedValue === -1 ? null : state.players[selectedValue];

        if (state.teamMode === 'random') {
            state.players = [...state.players].sort(() => Math.random() - 0.5);
            state.teams[0].members = [state.players[0], state.players[2]];
            state.teams[1].members = [state.players[1], state.players[3]];
        } else {
            state.teams[0].members = [state.players[0], state.players[1]];
            state.teams[1].members = [state.players[2], state.players[3]];
        }
        state.dealerIndex = (selectedValue === -1) ? Math.floor(Math.random() * 4) : state.players.indexOf(firstDealerName);
    }
    state.view = 'play'; calculateScores(); render();
};

window.submitHand = () => {
    let t0Got = parseInt(document.getElementById('t0Got').value) || 0;
    let t1Got = parseInt(document.getElementById('t1Got').value) || 0;
    const t0R = document.getElementById('t0Reneg').checked;
    const t1R = document.getElementById('t1Reneg').checked;
    if (t0Got + t1Got !== 13) return alert("Total must be 13");
    if (t0R) { let p = Math.min(t0Got, 3); t0Got -= p; t1Got += p; }
    if (t1R) { let p = Math.min(t1Got, 3); t1Got -= p; t0Got += p; }
    const getData = (id, got, reneg) => ({
        bid: parseInt(document.getElementById(`${id}Bid`).value) || 0, teamGot: got,
        isNil: document.getElementById(`${id}Nil`).checked, nilGot: parseInt(document.getElementById(`${id}NilGot`).value) || 0, reneg: reneg
    });
    state.history.push({ t1: getData('t0', t0Got, t0R), t2: getData('t1', t1Got, t1R) });
    calculateScores(); render();
};

window.exportGame = () => {
    const now = new Date().toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'});
    let txt = `♠️ SPADES SUMMARY (${now}) ♠️\nWINNER: ${state.winner}\n\n`;
    state.history.forEach((h, i) => { txt += `R${i+1}: T1(${h.t1.bid}/${h.t1.teamGot}) | T2(${h.t2.bid}/${h.t2.teamGot})\n`; });
    navigator.clipboard.writeText(txt); alert("Copied!");
};

window.resetGame = () => { if(confirm("Reset scores?")) { state.view='setup'; state.history=[]; state.winner=null; state.statsRecorded=false; state.teams.forEach(t=>{t.score=0;t.bags=0;t.setCount=0;}); save(); render(); }};

// --- 5. Render ---
function render() {
    const container = document.getElementById('view-container'); if (!container) return;
    if (state.view === 'stats') {
        const career = JSON.parse(localStorage.getItem('spades_career_stats')) || {};
        const sorted = Object.entries(career).map(([name, d]) => ({ name, ...d, pct: d.games>0?(d.wins/d.games)*100:0 })).sort((a,b)=>b.pct-a.pct);
        container.innerHTML = `<div class="card"><h2>Leaderboard</h2><table><thead><tr><th>Player</th><th>Win %</th></tr></thead><tbody>${sorted.map(p=>`<tr><td>${p.name}</td><td>${p.pct.toFixed(1)}%</td></tr>`).join('')}</tbody></table><button onclick="state.view='setup';render()">Back</button></div>`;
        return;
    }
    if (state.winner) {
        container.innerHTML = `<div class="card" style="text-align:center;"><h1>🏆 ${state.winner} Wins!</h1><p>${state.winReason}</p><button onclick="exportGame()">Export</button><button onclick="resetGame()">New Game</button></div>`;
        return;
    }
    if (state.view === 'setup') {
        container.innerHTML = `<div class="card">
            <div class="flex-row"><h2>Setup</h2><button onclick="toggleDarkMode()">🌙</button></div>
            <label>Players:</label>${state.players.map((p, i) => `<input type="text" oninput="state.players[${i}]=this.value" value="${p}">`).join('')}
            <div style="margin:10px 0; padding:10px; background:rgba(0,0,0,0.05); border-radius:8px;">
                <label>Team Mode:</label><div class="flex-row" style="margin-top:5px;">
                <button onclick="state.teamMode='random';render()" style="background:${state.teamMode==='random'?'var(--accent)':'#95a5a6'}">🎲 Random</button>
                <button onclick="state.teamMode='manual';render()" style="background:${state.teamMode==='manual'?'var(--accent)':'#95a5a6'}">✍️ Manual</button></div>
            </div>
            <label>First Dealer:</label><select id="firstDealerSelect"><option value="-1">🎲 Randomize Dealer</option>${state.players.map((n, i) => `<option value="${i}">${n || `P${i+1}`}</option>`).join('')}</select>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:15px;">
                <div>Goal: <select onchange="state.goal=parseInt(this.value)"><option value="300" ${state.goal==300?'selected':''}>300</option><option value="500" ${state.goal==500?'selected':''}>500</option></select></div>
                <div>Bags: <select onchange="state.bagLimit=parseInt(this.value)"><option value="5" ${state.bagLimit==5?'selected':''}>5</option><option value="10" ${state.bagLimit==10?'selected':''}>10</option></select></div>
                <div>Penalty: <select onchange="state.bagPenalty=parseInt(this.value)"><option value="50" ${state.bagPenalty==50?'selected':''}>50</option><option value="100" ${state.bagPenalty==100?'selected':''}>100</option></select></div>
                <div>Set Out: <select onchange="state.setLimit=parseInt(this.value)"><option value="2" ${state.setLimit==2?'selected':''}>2</option><option value="3" ${state.setLimit==3?'selected':''}>3</option></select></div>
            </div>
            <button onclick="startGame()">Start Game</button><button onclick="state.view='stats';render()" style="background:#9b59b6;">Stats</button></div>`;
    } else {
        const dealer = state.players[(state.dealerIndex + state.history.length) % 4];
        container.innerHTML = `
            <div class="flex-row card" style="padding:10px; font-size:0.75rem;">
                <span>🎯<b>${state.goal}</b> | 🎒<b>${state.bagLimit}/-${state.bagPenalty}</b> | ❌<b>${state.setLimit}</b></span>
                <button onclick="state.view='setup';render()">⚙️</button>
            </div>
            <div class="team-grid">${state.teams.map(t => `<div class="card">
                <h3>${t.members.join(' & ')}</h3><small>${t.members.map(m=>m===dealer?`🃏 ${m}`:m).join(' & ')}</small>
                <div class="score-display">${t.score}</div><small>Bags: ${t.bags}/${state.bagLimit} | Sets: ${t.setCount}</small>
            </div>`).join('')}</div>
            <div class="card"><h3>Record Hand</h3>
                <div class="team-grid">${[0,1].map(i=>`<div><b>T${i+1}</b><input type="number" id="t${i}Bid" placeholder="Bid"><input type="number" id="t${i}Got" placeholder="Got" ${i===0?'oninput="autoFillTricks(this.value)"':''}>
                <label style="color:var(--danger); font-size:0.7rem;"><input type="checkbox" id="t${i}Reneg"> Renegade?</label><br>
                <label style="font-size:0.7rem;"><input type="checkbox" id="t${i}Nil"> Nil?</label><input type="number" id="t${i}NilGot" placeholder="N" style="width:30px"></div>`).join('')}</div>
                <button onclick="submitHand()">Submit</button>
            </div>
            <div class="card"><table><thead><tr><th>#</th><th>T1</th><th>T2</th></tr></thead><tbody>${state.history.map((h,i)=>`<tr><td>${i+1}</td><td>${h.t1.bid}/${h.t1.teamGot}</td><td>${h.t2.bid}/${h.t2.teamGot}</td></tr>`).reverse().join('')}</tbody></table>
            <button onclick="state.history.pop();calculateScores();render();" style="background:var(--warning);">Undo</button><button onclick="resetGame()" style="background:var(--danger);">Reset</button></div>`;
    }
}
render();
