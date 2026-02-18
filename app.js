// --- 1. State Management ---
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
    setLimit: initialState?.setLimit || 3, // Total sets to lose
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

const getInitials = (namesArray) => namesArray.map(n => n.trim().split(' ').map(p => p[0] ? p[0].toUpperCase() : '').join('')).join(' & ');

// --- 2. Scoring Engine ---
function getTotalsAtStep(historyArray) {
    let t = [
        { score: 0, bags: 0, setCount: 0, consecutiveSets: 0, penaltyThisRound: false, setThisRound: false }, 
        { score: 0, bags: 0, setCount: 0, consecutiveSets: 0, penaltyThisRound: false, setThisRound: false }
    ];
    
    historyArray.forEach(round => {
        const hands = [round.t1, round.t2];
        hands.forEach((hand, i) => {
            const team = t[i]; 
            const oppHand = hands[i === 0 ? 1 : 0];
            team.penaltyThisRound = false;
            team.setThisRound = false;

            // Nil Calculation
            if (hand.isNil) {
                if (hand.nilGot === 0) {
                    team.score += state.nilValue;
                } else { 
                    team.score -= state.nilValue; 
                    // FIX: Tricks taken by a failed Nil count as bags (+1 pt each)
                    team.score += hand.nilGot;
                    team.bags += hand.nilGot;
                }
            }

            // Bid Calculation (This is what determines a Set)
            const tricks = hand.teamGot - (hand.isNil ? hand.nilGot : 0);
            if (hand.bid > 0) {
                if (tricks >= hand.bid && !hand.reneg) {
                    const extras = tricks - hand.bid;
                    if (oppHand.reneg) { 
                        team.score += (hand.bid * 10) + (extras * 10); 
                    } else { 
                        team.score += (hand.bid * 10) + extras; 
                        team.bags += extras; 
                    }
                } else { 
                    // Failed board bid = SET
                    team.score -= (hand.bid * 10); 
                    team.setCount++; 
                    team.setThisRound = true; 
                }
            } else if (!hand.isNil) { 
                team.score += tricks; 
                team.bags += tricks; 
            }

            // Bag Penalty
            if (team.bags >= state.bagLimit) { 
                team.score -= (state.bagPenalty + state.bagLimit); 
                team.bags -= state.bagLimit;
                team.penaltyThisRound = true;
            }

            // Streak Calculation (The "Back-to-Back" Rule)
            if (team.setThisRound) {
                team.consecutiveSets++;
            } else {
                team.consecutiveSets = 0; // Reset streak if they make their board bid
            }
        });
    });
    return t;
}

function calculateScores() {
    const final = getTotalsAtStep(state.history);
    
    // Update State
    [0, 1].forEach(i => {
        state.teams[i].score = final[i].score;
        state.teams[i].bags = final[i].bags;
        state.teams[i].setCount = final[i].setCount;
    });
    
    state.winner = null;
    const t1N = state.teams[0].members.join(' & ');
    const t2N = state.teams[1].members.join(' & ');
    const s1 = state.teams[0].score;
    const s2 = state.teams[1].score;

    // --- WIN/LOSS LOGIC ---

    // 1. Back-to-Back Set Rule (Immediate Loss)
    if (final[0].consecutiveSets >= 2) { state.winner = t2N; state.winReason = `${t1N} set twice in a row!`; }
    else if (final[1].consecutiveSets >= 2) { state.winner = t1N; state.winReason = `${t2N} set twice in a row!`; }
    
    // 2. Total Set Limit Rule (3 Sets total)
    else if (state.teams[0].setCount >= state.setLimit) { state.winner = t2N; state.winReason = `${t1N} hit set limit (${state.setLimit}).`; }
    else if (state.teams[1].setCount >= state.setLimit) { state.winner = t1N; state.winReason = `${t2N} hit set limit (${state.setLimit}).`; }
    
    // 3. Goal Check
    else if (s1 >= state.goal || s2 >= state.goal) {
        if (s1 > s2) { state.winner = t1N; state.winReason = "Goal reached!"; }
        else if (s2 > s1) { state.winner = t2N; state.winReason = "Goal reached!"; }
        else { state.winner = null; } 
    }
    
    // Career Stats
    if (state.winner && !state.statsRecorded) {
        let career = JSON.parse(localStorage.getItem('spades_career_stats')) || {};
        state.players.forEach(name => {
            const n = name.trim(); if (!n) return;
            if (!career[n]) career[n] = { wins: 0, games: 0, sets: 0 };
            career[n].games++;
        });
        state.winner.split(' & ').forEach(n => { if (career[n.trim()]) career[n.trim()].wins++; });
        state.teams.forEach(team => {
            team.members.forEach(n => { if (career[n.trim()]) career[n.trim()].sets += team.setCount; });
        });
        localStorage.setItem('spades_career_stats', JSON.stringify(career));
        state.statsRecorded = true;
    }
    save();
}

// --- 3. Interactions ---
window.submitHand = () => {
    let t0G = parseInt(document.getElementById('t0Got').value) || 0;
    let t1G = parseInt(document.getElementById('t1Got').value) || 0;
    if (t0G + t1G !== 13) return alert("Total tricks must equal 13.");
    const t0R = document.getElementById('t0Reneg').checked;
    const t1R = document.getElementById('t1Reneg').checked;
    if (t0R) { t0G = Math.max(0, t0G - 3); t1G += 3; }
    if (t1R) { t1G = Math.max(0, t1G - 3); t0G += 3; }
    const getData = (id, got, reneg) => ({
        bid: parseInt(document.getElementById(`${id}Bid`).value) || 0, 
        teamGot: got,
        isNil: document.getElementById(`${id}Nil`).checked, 
        nilGot: parseInt(document.getElementById(`${id}NilGot`).value) || 0, 
        reneg: reneg
    });
    state.history.push({ t1: getData('t0', t0G, t0R), t2: getData('t1', t1G, t1R) });
    calculateScores(); render();
};

window.exportGame = () => {
    const t1Full = state.teams[0].members.join(' & ');
    const t2Full = state.teams[1].members.join(' & ');
    const t1I = getInitials(state.teams[0].members);
    const t2I = getInitials(state.teams[1].members);
    const now = new Date().toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'});
    
    let txt = `♠️ SPADES SUMMARY (${now}) ♠️\n⚔️ MATCHUP: ${t1Full} vs ${t2Full}\n🏆 WINNER: ${state.winner}\n📊 FINAL: ${state.teams[0].score} to ${state.teams[1].score}\n\nHISTORY\n\t\t [${t1I}] | [${t2I}]\n`;
    
    state.history.forEach((h, i) => {
        const snap = getTotalsAtStep(state.history.slice(0, i + 1));
        const n1 = h.t1.isNil ? (h.t1.nilGot === 0 ? " N✅" : " N❌") : "";
        const n2 = h.t2.isNil ? (h.t2.nilGot === 0 ? " N✅" : " N❌") : "";
        const p1 = (snap[0].penaltyThisRound ? "🎒" : "") + (snap[0].setThisRound ? "❌" : "") + n1;
        const p2 = (snap[1].penaltyThisRound ? "🎒" : "") + (snap[1].setThisRound ? "❌" : "") + n2;
        txt += `R${i+1}: \t${snap[0].score}${p1} (${h.t1.bid}/${h.t1.teamGot}) | ${snap[1].score}${p2} (${h.t2.bid}/${h.t2.teamGot})\n`;
    });
    
    txt += `\nGenerated by Standaggs Spades Scorekeeper \nhttps://standaggs-code.github.io/spades_web_app/`;
    navigator.clipboard.writeText(txt); 
    alert("It is Done!");
};

window.continueGame = () => {
    state.winner = null; 
    state.statsRecorded = false;
    state.view = 'setup'; 
    render();
};

window.updateRule = (key, val) => {
    state[key] = val;
    calculateScores(); 
    render();
};

window.startGame = () => {
    if (state.players.some(p => !p.trim())) return alert("Names required");
    const sel = document.getElementById('firstDealerSelect');
    const sVal = parseInt(sel.value);
    const dName = sVal === -1 ? null : state.players[sVal];
    if (state.teamMode === 'random') {
        state.players = [...state.players].sort(() => Math.random() - 0.5);
        state.teams[0].members = [state.players[0], state.players[2]];
        state.teams[1].members = [state.players[1], state.players[3]];
    } else {
        state.teams[0].members = [state.players[0], state.players[1]];
        state.teams[1].members = [state.players[2], state.players[3]];
    }
    state.dealerIndex = (sVal === -1) ? Math.floor(Math.random() * 4) : state.players.indexOf(dName);
    state.view = 'play'; calculateScores(); render();
};

window.autoFillTricks = (val) => { 
    const other = 13 - (parseInt(val) || 0); 
    const target = document.getElementById('t1Got'); 
    if (target) target.value = Math.max(0, Math.min(13, other)); 
};

window.resetGame = () => { 
    if(confirm("Reset current game?")) { 
        state.view='setup'; state.history=[]; state.winner=null; state.statsRecorded=false; 
        state.teams.forEach(t=>{t.score=0;t.bags=0;t.setCount=0;}); 
        save(); render(); 
    }
};

// --- 4. Render Engine ---
function render() {
    const container = document.getElementById('view-container'); if (!container) return;

    if (state.view === 'stats') {
        const career = JSON.parse(localStorage.getItem('spades_career_stats')) || {};
        const sorted = Object.entries(career).map(([name, d]) => ({ name, ...d, pct: d.games>0?(d.wins/d.games)*100:0 })).sort((a,b)=>b.pct-a.pct);
        container.innerHTML = `<div class="card"><h2>🏆 Leaderboard</h2><table><thead><tr><th>Player</th><th>Win %</th></tr></thead><tbody>${sorted.map(p=>`<tr><td>${p.name}</td><td>${p.pct.toFixed(1)}%</td></tr>`).join('')}</tbody></table><button onclick="state.view='setup';render()">Back</button></div>`;
        return;
    }

    if (state.winner) {
        container.innerHTML = `<div class="card" style="text-align:center;">
            <h1>🏆 Winner!</h1><h2>${state.winner}</h2><p>${state.winReason}</p>
            <button onclick="exportGame()">Copy Results</button>
            <button onclick="window.continueGame()" style="background:#3498db; margin-top:10px;">Continue Game</button>
            <button onclick="resetGame()" style="background:#e74c3c; margin-top:10px;">New Game</button>
            <p style="font-size:0.7rem; color:#888; margin-top:15px;">Hit "Continue" to change goal/score.</p>
        </div>`;
        return;
    }

    if (state.view === 'setup') {
        container.innerHTML = `<div class="card">
            <div class="flex-row"><h2>Setup</h2><button onclick="state.darkMode=!state.darkMode; document.body.classList.toggle('dark-mode'); save();">🌙</button></div>
            ${state.players.map((p, i) => `<input type="text" oninput="state.players[${i}]=this.value" value="${p}" placeholder="Player ${i+1}">`).join('')}
            <div style="margin:10px 0; display:flex; gap:10px;">
                <button onclick="state.teamMode='random';render()" style="background:${state.teamMode==='random'?'var(--accent)':'#95a5a6'}">🎲 Random</button>
                <button onclick="state.teamMode='manual';render()" style="background:${state.teamMode==='manual'?'var(--accent)':'#95a5a6'}">✍️ Manual</button>
            </div>
            <select id="firstDealerSelect"><option value="-1">🎲 Random Dealer</option>${state.players.map((n, i) => `<option value="${i}">${n || `P${i+1}`}</option>`).join('')}</select>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px; background:rgba(0,0,0,0.03); padding:10px; border-radius:8px;">
                <div><label style="font-size:0.7rem">Goal</label><select onchange="window.updateRule('goal', parseInt(this.value))"><option value="300" ${state.goal===300?'selected':''}>300</option><option value="500" ${state.goal===500?'selected':''}>500</option></select></div>
                <div><label style="font-size:0.7rem">Bag Limit</label><select onchange="window.updateRule('bagLimit', parseInt(this.value))"><option value="5" ${state.bagLimit===5?'selected':''}>5</option><option value="10" ${state.bagLimit===10?'selected':''}>10</option></select></div>
                <div><label style="font-size:0.7rem">Penalty</label><select onchange="window.updateRule('bagPenalty', parseInt(this.value))"><option value="50" ${state.bagPenalty===50?'selected':''}>-50</option><option value="100" ${state.bagPenalty===100?'selected':''}>-100</option></select></div>
                <div><label style="font-size:0.7rem">Set Out</label><select onchange="window.updateRule('setLimit', parseInt(this.value))"><option value="2" ${state.setLimit===2?'selected':''}>2 Sets</option><option value="3" ${state.setLimit===3?'selected':''}>3 Sets</option></select></div>
            </div>
            <button onclick="startGame()" style="background:var(--success); margin-top:15px;">${state.history.length > 0 ? 'Resume Game' : 'Start Game'}</button>
            <button onclick="state.view='stats';render()" style="background:#9b59b6; margin-top:10px;">Leaderboard</button>
        </div>`;
    } 
    else {
        let dealerName;
        if (state.teamMode === 'manual') {
            const manualRotation = [0, 2, 1, 3];
            const startIndex = manualRotation.indexOf(state.dealerIndex);
            const safeStart = startIndex === -1 ? 0 : startIndex;
            const currentIndex = manualRotation[(safeStart + state.history.length) % 4];
            dealerName = state.players[currentIndex];
        } else {
            dealerName = state.players[(state.dealerIndex + state.history.length) % 4];
        }

        const t1Score = state.teams[0].score;
        const t2Score = state.teams[1].score;
        
        container.innerHTML = `
            <div class="card" style="padding:10px;">
                <div style="display:flex; justify-content:space-between; font-size:0.7rem; margin-bottom:5px;">
                    <span><b>Goal:</b> ${state.goal}</span>
                    <span><b>Bags:</b> ${state.bagLimit} (-${state.bagPenalty})</span>
                </div>
                <div style="display:flex; height:15px; background:#eee; border-radius:10px; overflow:hidden; margin-bottom:5px;">
                    <div style="width:${Math.max(0, (t1Score/state.goal)*100)}%; background:var(--accent); transition:0.5s;"></div>
                </div>
                <div style="display:flex; height:15px; background:#eee; border-radius:10px; overflow:hidden;">
                    <div style="width:${Math.max(0, (t2Score/state.goal)*100)}%; background:var(--success); transition:0.5s;"></div>
                </div>
            </div>
            
            <div class="team-grid">${state.teams.map((t,i) => `<div class="card" style="border-left:5px solid ${i===0?'var(--accent)':'var(--success)'}">
                <h3>${t.members.join(' & ')}</h3><small>${t.members.includes(dealerName)?'🃏 Dealer':''}</small>
                <div class="score-display">${t.score}</div><small>Bags: ${t.bags}/${state.bagLimit} | Sets: ${t.setCount}</small>
            </div>`).join('')}</div>
            
            <div class="card"><h3>Record Hand</h3>
                <div class="team-grid">${[0,1].map(i=>`<div><b>${getInitials(state.teams[i].members)}</b>
                <input type="number" id="t${i}Bid" placeholder="Bid"><input type="number" id="t${i}Got" placeholder="Got" ${i===0?'oninput="window.autoFillTricks(this.value)"':''}>
                <label style="font-size:0.7rem;"><input type="checkbox" id="t${i}Reneg"> Renegade?</label><br>
                <label style="font-size:0.7rem;"><input type="checkbox" id="t${i}Nil"> Nil?</label><input type="number" id="t${i}NilGot" placeholder="N" style="width:30px"></div>`).join('')}</div>
                <button onclick="submitHand()">Submit</button>
            </div>
            
            <div class="card"><table><thead><tr><th>#</th><th>${getInitials(state.teams[0].members)}</th><th>${getInitials(state.teams[1].members)}</th></tr></thead>
            <tbody>${state.history.map((h,i)=> {
                const snap = getTotalsAtStep(state.history.slice(0, i + 1));
                
                const n1 = h.t1.isNil ? (h.t1.nilGot === 0 ? " N✅" : " N❌") : "";
                const n2 = h.t2.isNil ? (h.t2.nilGot === 0 ? " N✅" : " N❌") : "";
                
                const p1 = (snap[0].penaltyThisRound ? "🎒" : "") + (snap[0].setThisRound ? "❌" : "") + n1;
                const p2 = (snap[1].penaltyThisRound ? "🎒" : "") + (snap[1].setThisRound ? "❌" : "") + n2;
                return `<tr><td>${i+1}</td><td>${h.t1.bid}/${h.t1.teamGot} ${p1}</td><td>${h.t2.bid}/${h.t2.teamGot} ${p2}</td></tr>`;
            }).reverse().join('')}</tbody></table>
            <button onclick="state.history.pop();calculateScores();render();" style="background:var(--warning); margin-top:10px;">Undo</button>
            <button onclick="state.view='setup';render()" style="background:#95a5a6; margin-top:10px;">⚙️ Settings</button>
            </div>`;
    }
}
render();
    
