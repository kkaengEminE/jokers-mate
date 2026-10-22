"""Design-only R3 oracle. Does NOT change the running game's older ledger."""
import json
from pathlib import Path

def settle(b, c, chess, poker):
    assert min(b)>=20 and all(20<=c[i]<=b[i] for i in (0,1))
    m=min(c)
    returned=[x-m for x in c]
    chess_award=[30 if chess==i else 0 for i in (0,1)]
    pot=2*m-sum(chess_award)
    poker_award=[pot if poker==i else 0 for i in (0,1)]
    final=[b[i]-c[i]+returned[i]+chess_award[i]+poker_award[i] for i in (0,1)]
    assert sum(final)==sum(b) and min(final)>=0
    return dict(start=b,committed=c,chess=chess,poker=poker,returned=returned,
                chess_award=chess_award,poker_pot=pot,poker_award=poker_award,
                final=final,net=[final[i]-b[i] for i in (0,1)])

cases=[]
for chess in (0,1,None):
    for poker in (0,1):
        cases.append(settle([1000,1000],[20,20],chess,poker))
assert [x['final'][0] for x in cases]==[1020,1010,990,980,1020,980]
count=0
for b in ([20,1980],[25,1975],[39,1961],[40,1960],[1000,1000],[1000,2100000000],[2100000000,1000]):
    for cw in sorted(set([20,b[0],(20+b[0])//2])):
        for cb in sorted(set([20,b[1],(20+b[1])//2])):
            for chess in (0,1,None):
                for poker in (0,1):
                    result=settle(b,[cw,cb],chess,poker)
                    reverse=settle(b[::-1],[cb,cw],None if chess is None else 1-chess,1-poker)
                    assert result['final']==reverse['final'][::-1]
                    count+=1
assert settle([1000,1000],[60,100],0,1)['final']==[970,1030]
assert settle([1000,2100000000],[1000,2100000000],None,0)['final']==[2000,2099999000]
out=Path(__file__).resolve().parents[2]/'docs'/'23_R3_VERIFICATION.json'
out.write_text(json.dumps(dict(status='design_only_not_runtime',cases_checked=count,basic_cases=cases),ensure_ascii=False,indent=2)+'\n')
print(f'R3 design ledger: {count} cases + symmetry and named assertions passed')
