"""Proposal only: 50G entry, 40/60 payout, winner floor from opponent award."""
import json
from pathlib import Path

def settle(b, c, chess, poker):
    assert min(b) >= 50 and all(50 <= c[i] <= b[i] for i in range(2))
    m = min(c)
    a = [40 if chess == i else 0 for i in range(2)]
    p = 2*m-sum(a)
    f = [b[i]-m+a[i]+(p if poker == i else 0) for i in range(2)]
    protection = 0 if chess is None else max(0,50-f[chess])
    if chess is not None:
        f[chess] += protection
        f[1-chess] -= protection
    assert sum(f) == sum(b) and min(f) >= 0 and protection <= 10
    assert chess is None or f[chess] >= 50
    return f, protection

cases = 0
for b in ([50,50],[51,1949],[59,1941],[60,1940],[1000,1000],[1000,2100000000]):
    for c0 in sorted(set([50,b[0]])):
        for c1 in sorted(set([50,b[1]])):
            for chess in (None,0,1):
                for poker in (0,1):
                    f,q=settle(b,[c0,c1],chess,poker)
                    swapped,_=settle(b[::-1],[c1,c0],None if chess is None else 1-chess,1-poker)
                    assert swapped == f[::-1]
                    cases += 1
rows=[]
for start in (1000,60,59,51,50):
    final,q=settle([start,2000-start],[50,50],0,1)
    rows.append(dict(player_start=start,player_final=final[0],opponent_final=final[1],protection=q,net=final[0]-start))
assert rows[-1]['net']==0
Path('docs/25_PROPOSAL_50G_CASES.json').write_text(json.dumps({'status':'proposal-not-approved','cases_checked':cases,'chess_win_poker_fold':rows},ensure_ascii=False,indent=2)+'\n')
print(f'Proposal: {cases} cases + symmetry passed; floor stall confirmed')
