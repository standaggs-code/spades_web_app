// --- 1. State & Persistence ---
const savedState = localStorage.getItem('spades_game_state');
let initialState = savedState ? JSON.parse(savedState) : null;

const state = {
    view: initialState?.view || 'setup',
    players: initialState?.players || ['', '', '', ''],
    goal: initialState?.goal || 300,
    nilValue: initialState?.nilValue || 50,
    bagLimit: initialState?.bagLimit || 5,
    bagPenalty: initialState?.bagPenalty || 50,
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

// --- 2. Career Stats Logic ---
function recordCareerStats() {
    if (state.statsRecorded || !state.winner) return;
    let career = JSON.parse(localStorage.getItem('spades_career_stats')) || {};
    state.players.forEach(name => {
        const n = name.trim();
        if (!n) return;
        if (!career[n]) career[n] = { wins: 0, games: 0, sets: 0 };
        career[n].games++;
    });
    const winningTeam = state.teams.find(t => t.name === state.winner);
    winningTeam.members.forEach(name => { 
        const n = name.trim();
        if (career[n]) career[n].wins++; 
    });
    state.teams.forEach(team => {
        team.members.forEach(name => { 
            const n = name.trim();
            if (career[n]) career[n].sets += team.setCount; 
        });
    });
    localStorage.setItem('spades_career_stats', JSON.stringify(career));
    state.statsRecorded = true;
    save();
}

window.clearAllStats = () => {
    if (confirm("Delete ALL career records?")) {
        if (confirm("REALLY? This cannot be undone.")) {
            localStorage.removeItem('spades_career_stats');
            state.view = 'setup';
            render();
            alert("Leaderboard wiped.");
        }
    }
};

// --- 3. Scoring Engine ---
function getTotalsAtStep(historyArray) {
    let t1 = { score: 0, bags: 0, setCount: 0, consecutive: 0, instantLoss: false, lossReason: "" };
    let t2 = { score: 0, bags: 0, setCount: 0, consecutive: 0, instantLoss: false, lossReason: "" };
    historyArray.forEach(round => {
        [round.t1, round.t2].forEach((hand, i) => {
            const team = i === 0 ? t1 : t2;
            const teammateTricks = hand.teamGot - (hand.isNil ? hand.nilGot : 0);
            let isSet = false;
            if (hand.isNil) {
                if (hand.nilGot === 0) team.score += state.nilValue;
                else { team.score -= state.nilValue; isSet = true; }
            }
            if (hand.bid > 0) {
                if (teammateTricks >= hand.bid) {
                    team.score += (hand.bid * 10) + (teammateTricks - hand.bid);
                    team.bags += (teammateTricks - hand.bid);
                } else { team.score -= (hand.bid * 10); isSet = true; }
            } else if (!hand.isNil) { team.bags += teammateTricks; }
            if (isSet) { team.setCount++; team.consecutive++; } else { team.consecutive = 0; }
            if (team.bags >= state.bagLimit) { team.score -= state.bagPenalty; team.bags -= state.bagLimit; }
            if (team.setCount >= state.setLimit) { team.instantLoss = true; team.lossReason = `${state.teams[i].members.join(' & ')} hit ${state.setLimit} sets.`; }
            if (team.consecutive >= 2) { team.instantLoss = true; team.lossReason = `${state.teams[i].members.join(' & ')} got back-to-back sets.`; }
        });
    });
    return { t1, t2 };
}

function calculateScores() {
    const final = getTotalsAtStep(state.history);
    [0, 1].forEach(i => {
        const f = i === 0 ? final.t1 : final.t2;
        state.teams[i].score = f.score;
        state.teams[i].bags = f.bags;
        state.teams[i].setCount = f.setCount;
    });
    state.winner = null;
    if (final.t1.instantLoss) { state.winner = state.teams[1].name; state.winReason = final.t1.lossReason; }
    else if (final.t2.instantLoss) { state.winner = state.teams[0].name; state.winReason = final.t2.lossReason; }
    else if (state.teams[0].score >= state.goal) { state.winner = state.teams[0].name; state.winReason = "Goal Reached!"; }
    else if (state.teams[1].score >= state.goal) { state.winner = state.teams[1].name; state.winReason = "Goal Reached!"; }
    if (state.winner) recordCareerStats();
    save();
}

// --- 4. Actions ---
window.toggleDarkMode = () => {
    state.darkMode = !state.darkMode;
    document.body.classList.toggle('dark-mode', state.darkMode);
    save();
};

window.updatePlayer = (i, v) => { 
    state.players[i] = v; 
    const sel = document.getElementById('firstDealerSelect');
    if (sel) sel.options[i].text = v || `Player ${i+1}`;
};

window.startGame = () => {
    if (state.players.some(p => !p.trim())) return alert("All players need names!");
    if (state.history.length === 0) {
        const dealerName = state.players[parseInt(document.getElementById('firstDealerSelect').value)];
        let shuff = [...state.players].sort(() => Math.random() - 0.5);
        state.players = shuff;
        state.dealerIndex = shuff.indexOf(dealerName);
        state.teams[0].members = [shuff[0], shuff[2]];
        state.teams[1].members = [shuff[1], shuff[3]];
    }
    state.view = 'play';
    calculateScores();
    render();
};

window.submitHand = () => {
    const getData = (p) => ({
        bid: parseInt(document.getElementById(`${p}Bid`).value) || 0,
        teamGot: parseInt(document.getElementById(`${p}Got`).value) || 0,
        isNil: document.getElementById(`${p}Nil`).checked,
        nilGot: parseInt(document.getElementById(`${p}NilGot`).value) || 0
    });
    state.history.push({ t1: getData('t0'), t2: getData('t1') });
    calculateScores();
    render();
};

window.undoLastHand = () => {
    if (state.history.length > 0 && confirm("Undo last round?")) {
        state.history.pop(); calculateScores(); render();
    }
};

window.resetGame = () => {
    if (confirm("Reset current scores? Player names and career stats are safe.")) {
        state.view = 'setup'; state.history = []; state.winner = null; state.statsRecorded = false;
        state.teams.forEach(t => { t.score = 0; t.bags = 0; t.setCount = 0; });
        save(); render();
    }
};

window.exportGame = () => {
    const t1Names = state.teams[0].members.join(' & ');
    const t2Names = state.teams[1].members.join(' & ');
    const winnerTeam = state.teams.find(t => t.name === state.winner);
    
    let txt = `♠️ SPADES GAME SUMMARY ♠️\n`;
    txt += `🏆 WINNERS: ${winnerTeam.members.join(' & ')}\n`;
    txt += `🏁 REASON: ${state.winReason}\n\n`;
    
    txt += `FINAL SCORES:\n`;
    txt += `🔹 ${t1Names}: ${state.teams[0].score} pts (${state.teams[0].setCount} sets)\n`;
    txt += `🔹 ${t2Names}: ${state.teams[1].score} pts (${state.teams[1].setCount} sets)\n\n`;
    
    txt += `ROUND BY ROUND:\n`;
    state.history.forEach((h, i) => {
        const getNil = (hand) => hand.isNil ? (hand.nilGot === 0 ? " (Nil ✅)" : ` (Nil ❌:${hand.nilGot})`) : "";
        txt += `${i + 1}. ${t1Names}: [${h.t1.bid}/${h.t1.teamGot}${getNil(h.t1)}] | `;
        txt += `${t2Names}: [${h.t2.bid}/${h.t2.teamGot}${getNil(h.t2)}]\n`;
    });
    
    txt += `\nGenerated by your Spades App`;
    
    navigator.clipboard.writeText(txt);
    alert("Full game history with names copied to clipboard!");
};

// --- 5. Render Engine ---
function render() {
    const container = document.getElementById('view-container');
    if (!container) return;

    if (state.view === 'stats') {
        const career = JSON.parse(localStorage.getItem('spades_career_stats')) || {};
        const sorted = Object.entries(career).map(([name, d]) => ({ name, ...d, pct: d.games > 0 ? (d.wins/d.games)*100 : 0 }))
            .sort((a,b) => b.pct - a.pct || b.wins - a.wins);
        container.innerHTML = `<div class="card">
            <div class="flex-row"><h2>🏆 Leaderboard</h2><button onclick="state.view='setup';render()" style="width:auto;padding:5px 10px;">Back</button></div>
            <table>
                <thead><tr><th>Player</th><th>Win %</th><th>Sets</th></tr></thead>
                <tbody>${sorted.map((p, i) => `<tr class="${i<3?`rank-${i+1}`:''}"><td>${p.name}</td><td>${p.pct.toFixed(1)}%</td><td>${p.sets}</td></tr>`).join('')}</tbody>
            </table>
            <button onclick="clearAllStats()" style="background:none; color:var(--danger); border:1px solid var(--danger); font-size:0.7rem; margin-top:20px;">🗑️ Reset All Career Stats</button>
        </div>`;
        return;
    }

    if (state.winner) {
        const winTeam = state.teams.find(t => t.name === state.winner);
        container.innerHTML = `<div class="card" style="text-align:center; border: 4px solid var(--success);">
            <h1>🏆 VICTORY</h1><h3>${winTeam.members.join(' & ')}</h3>
            <p>${state.winReason}</p><button onclick="exportGame()" style="margin-bottom:10px;">Export Results</button>
            <button onclick="resetGame()">New Game</button>
        </div>`;
        return;
    }

    if (state.view === 'setup') {
        container.innerHTML = `<div class="card">
            <div class="flex-row"><h2>Setup</h2><button onclick="toggleDarkMode()" style="width:auto;padding:5px 10px;">🌙</button></div>
            ${state.history.length === 0 ? `
                <label><b>Players:</b></label>${state.players.map((p, i) => `<input type="text" oninput="updatePlayer(${i}, this.value)" value="${p}">`).join('')}
                <label><b>First Dealer:</b></label><select id="firstDealerSelect" style="margin-bottom:15px;">${state.players.map((n, i) => `<option value="${i}" ${state.dealerIndex===i?'selected':''}>${n||`Player ${i+1}`}</option>`).join('')}</select>
            ` : `<p style="color:var(--text-secondary); font-size:0.8rem;">Game in progress. Player names locked.</p>`}
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; background:rgba(0,0,0,0.03); padding:10px; border-radius:8px;">
                <div>Goal: <select onchange="state.goal=parseInt(this.value)"><option value="300" ${state.goal==300?'selected':''}>300</option><option value="500" ${state.goal==500?'selected':''}>500</option></select></div>
                <div>Bag Limit: <select onchange="state.bagLimit=parseInt(this.value)"><option value="5" ${state.bagLimit==5?'selected':''}>5</option><option value="10" ${state.bagLimit==10?'selected':''}>10</option></select></div>
                <div>Penalty: <select onchange="state.bagPenalty=parseInt(this.value)"><option value="50" ${state.bagPenalty==50?'selected':''}>50</option><option value="100" ${state.bagPenalty==100?'selected':''}>100</option></select></div>
                <div>Set Out: <select onchange="state.setLimit=parseInt(this.value)"><option value="2" ${state.setLimit==2?'selected':''}>2</option><option value="3" ${state.setLimit==3?'selected':''}>3</option></select></div>
            </div>
            <button onclick="startGame()" style="margin-top:20px;">${state.history.length>0?'Save & Resume':'Randomize & Start'}</button>
            <button onclick="state.view='stats';render()" style="background:#9b59b6;margin-top:10px;">View Leaderboard</button>
        </div>`;
    } else {
        const dealerIdx = (state.dealerIndex + state.history.length) % 4;
        const dealerName = state.players[dealerIdx];
        container.innerHTML = `
            <div class="flex-row card" style="padding:10px; font-size:0.75rem;">
                <div style="display:flex; gap:8px;"><span>🎯<b>${state.goal}</b></span><span>🎒<b>${state.bagLimit}</b></span><span>❌<b>${state.setLimit}</b></span></div>
                <div style="display:flex; gap:5px;">
                    <button onclick="resetGame()" style="width:auto;padding:2px 8px;margin:0;background:var(--danger);font-size:0.6rem;">🔄 Reset Game</button>
                    <button onclick="state.view='setup';render()" style="width:auto;padding:2px 8px;margin:0;background:#95a5a6;">⚙️ Rules</button>
                </div>
            </div>
            <div class="team-grid">${state.teams.map(t => `<div class="card">
                <h3>${t.members.join(' & ')}</h3>
                <small>${t.members.map(m=>m===dealerName?`🃏 ${m}`:m).join(' & ')}</small>
                <div style="margin:5px 0;">${"❌".repeat(t.setCount)}</div>
                <div class="score-display">${t.score}</div>
                <small>Bags: ${t.bags}/${state.bagLimit}</small>
            </div>`).join('')}</div>
            <div class="card">
                <h3>Record Hand <small style="float:right; opacity:0.6;">Dealer: ${dealerName}</small></h3>
                <div class="team-grid">${[0,1].map(i=>`<div><b>T${i+1}</b><input type="number" id="t${i}Bid" placeholder="Bid"><input type="number" id="t${i}Got" placeholder="Got"><br><label><input type="checkbox" id="t${i}Nil"> Nil?</label><input type="number" id="t${i}NilGot" placeholder="Tricks" style="width:40px"></div>`).join('')}</div>
                <button onclick="submitHand()">Submit Hand</button>
            </div>
            <div class="card">
                <h3>History</h3>
                <table><thead><tr><th>#</th><th>T1</th><th>T2</th></tr></thead>
                <tbody>${state.history.map((h,i)=>`<tr><td>${i+1}</td><td>${h.t1.bid}/${h.t1.teamGot}</td><td>${h.t2.bid}/${h.t2.teamGot}</td></tr>`).reverse().join('')}</tbody></table>
                <button onclick="undoLastHand()" style="background:var(--warning); margin-top:10px;">Undo Last Round</button>
            </div>`;
    }
}
render();
