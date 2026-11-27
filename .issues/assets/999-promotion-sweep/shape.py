import json,collections,sys
rows=collections.defaultdict(list); hdr={}
cols={}
for line in open(sys.argv[1],encoding='utf-8',errors='replace'):
    line=line.rstrip('\n')
    if not line or line.startswith('-'): continue
    f=line.split('|')
    if f[0]=='k': cols_cur=f; continue
    if f[0] in 'HPCM' and len(f)>2: rows[f[0]].append(f)
off={}
for f in rows['H']:
    off[f[1]]=dict(bby=f[1],offerId=f[2] or f[1],desc=f[3],lb=f[4],lg=f[5],minV=float(f[6] or 0),maxV=float(f[7] or 0),lim=int(float(f[8] or 0)),tt=f[9],origin=f[10],inc=f[11],exc=f[12],pre={},conds={})
for f in rows['P']:
    o=off.get(f[1]); 
    if not o: continue
    g=o['pre'].setdefault(f[2],dict(qty=0,asTotal=False,mats=[],minV=0))
    if f[4]: g['mats'].append(dict(m=f[4],qty=float(f[5]),uom=f[6]))
    else: g['qty']=float(f[5]); g['asTotal']=f[7]=='X'
    if f[7]=='X': g['asTotal']=True; g['qty']=float(f[5])
    g['minV']=max(g['minV'],float(f[8] or 0))
for f in rows['C']:
    o=off.get(f[1])
    if o: o['conds'][f[2]]=dict(dt=f[3],v=float(f[4]),vp=float(f[5]),qty=float(f[6]),uom=f[7],scale=f[8],ref=f[9],asTotal=f[10]=='X',mats=[],cnt=0)
for f in rows['M']:
    o=off.get(f[1])
    if o and f[2] in o['conds']:
        c=o['conds'][f[2]]; c['mats'].append(f[3]); c['cnt']=int(f[5])
def key(o):
    pre=list(o['pre'].values())
    coupon=any(m['m'].startswith('COUP') for g in pre for m in g['mats'])
    if coupon: b='coupon'
    elif not pre: b='noBuy'
    else:
        g=pre[0]; nm=len(g['mats'])
        b=f"buy{len(pre)}g {'group' if (g['asTotal'] or nm>1) else 'item'} q{int(max(g['qty'],max([m['qty'] for m in g['mats']] or [0])))}"+(' minV' if any(x['minV'] for x in pre) else '')
    cs=list(o['conds'].values())
    gk=f"{len(cs)}c "+'/'.join(sorted({c['dt'] for c in cs}))+' s'+'/'.join(sorted({c['scale'] for c in cs}))+' r'+'/'.join(sorted({c['ref'] for c in cs}))+(' many' if any(c['cnt']>1 for c in cs) else (' one' if all(c['cnt']==1 for c in cs) else ' none'))+' q'+str(int(max([c['qty'] for c in cs] or [0])))
    h=(' min' if o['minV'] else '')+(' max' if o['maxV'] else '')+(' lim' if o['lim'] else '')+' tt'+o['tt']+(' inc' if o['inc'] else '')
    return f"{b} | {gk} |{h}"
by=collections.defaultdict(list)
for o in off.values(): by[key(o)].append(o)
out=[]
for k,lst in sorted(by.items(),key=lambda kv:-len(kv[1])):
    lst.sort(key=lambda o:(o['origin'] not in ('','C'), bool(o['inc']), -int(o['bby'][3:])))
    out.append(dict(shape=k,count=len(lst),cands=lst[:6]))
    print(f"{len(lst):4} {k}  e.g. {lst[0]['bby']} {lst[0]['desc'][:40]}")
json.dump(out,open(sys.argv[2],'w'),separators=(',',':'))
