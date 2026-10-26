import re,sys,os
src,out=sys.argv[1],sys.argv[2]
W,H=262,140
# (inset t r b l, file) in DOM order, from get_design_context of node 84:4424
items='''83.79 89.22 10.45 0.81 9b97f
83.79 71.32 10.47 21.49 5a7dc
84.16 52.63 10.47 42.32 45b8c
86.16 47.2 8.52 47.72 ad836
83.79 78.78 10.26 17.8 333ca
83.79 60.49 10.49 36.27 76f6d
85.95 64.08 8.44 33.89 4312c
86.17 82.77 10.47 13.6 31687
83.78 88.05 10.5 11.37 af0a9
83.78 66.51 10.5 32.91 792cc
83.79 59.32 10.5 40.08 3702e
86.35 67.78 10.5 30.57 703b7
90.25 95.99 8.61 3.4 8dee6
85 83.85 13.86 15.53 c2ee8
85 84.58 13.86 14.8 21803
90.25 95.26 8.6 4.17 6dd7d
84.07 55.86 14.79 43.52 de4df
84.07 97.36 14.79 2.02 691cc
90.25 93.99 8.6 5.4 d4134
84.13 56.63 14.79 42.79 cf38b
84.13 98.14 14.79 1.29 e9ce9
83.92 75.1 15 24.32 b60de
84.21 48.76 14.86 50.74 013af
83.2 48.45 15.86 51.05 71e02
84.21 48.14 14.85 51.36 9e64f
86.16 47.76 13.78 52.21 0e4bf
86.86 92.53 13.07 7.42 3225f
83.79 81.6 16.15 18.37 0e425
88.61 78.48 11.34 21.49 c7459
88.61 63.69 11.34 36.27 b72aa
83.79 82.16 16.15 17.81 ecfb6
94.11 97.56 0.92 0.83 7dfee
94.11 95.76 0.92 3.01 87f24
96.49 94.68 2.88 4.49 253bc
94.11 92.54 0.92 5.97 4434a
94.11 90.42 0.92 7.96 8012e
94.11 87.69 0.92 9.92 82233
94.11 85.75 0.92 12.63 f3ac6
94.11 83.73 0.92 14.66 65b43
94.11 80.14 0.92 17.82 baaaf
94.11 78.15 0.92 20.58 24ef1
94.11 76.02 0.92 22.5 d8994
94.11 74.83 0.92 24.68 104cb
94 72.65 0.81 25.87 35717
94.11 70.56 0.92 27.82 d55a9
94.11 68.77 0.92 30 c7489
94 65.79 0.81 32.74 65c10
94.11 63.88 0.92 34.86 6bb2c
94.11 61.71 0.89 36.77 1b292
94.11 59.62 0.92 38.74 d1fe4
94.11 58.56 0.92 40.94 104cb
93.99 56.38 0.81 42.14 a5906
94.11 54.47 0.92 44.27 6bb2c
94 52.44 0.81 46.09 97f76
94 49.36 0.81 49.17 3910f
94 47.23 0.81 51.27 9132f
5.81 47.2 68.96 45.32 47583
0.81 57.05 60.08 0.81 6c9ea
44.86 76.82 30.63 11.15 6414a
44.32 47.2 29.88 45.38 58813
44.32 57.05 29.88 35.52 46e9b
44.4 66.41 29.88 25.44 b0543
44.86 91.35 30.52 0.81 88356'''
def load(name,pfx):
    s=open(os.path.join(src,name+'.svg'),encoding='utf-8').read()
    m=re.search(r'<svg([^>]*)>(.*)</svg>',s,re.S)
    attrs,body=m.group(1),m.group(2)
    vb=re.search(r'viewBox="([^"]+)"',attrs).group(1)
    ids=set(re.findall(r'\bid="([^"]+)"',body))
    for i in sorted(ids,key=len,reverse=True):
        body=body.replace(f'id="{i}"',f'id="{pfx}{i}"').replace(f'url(#{i})',f'url(#{pfx}{i})').replace(f'href="#{i}"',f'href="#{pfx}{i}"')
    return vb,body.strip()
f=lambda v:f'{v:.3f}'.rstrip('0').rstrip('.')
parts=[]
for n,l in enumerate(items.split('\n')):
    t,r,b,le,name=l.split(); t,r,b,le=map(float,(t,r,b,le))
    x,y=le/100*W,t/100*H; w,h=W*(1-le/100-r/100),H*(1-t/100-b/100)
    vb,body=load(name,f'v{n}_')
    parts.append(f'<svg x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(h)}" viewBox="{vb}" preserveAspectRatio="none" overflow="visible">{body}</svg>')
# Clip path group: gradient (74a48) masked by alpha of b0a40
x,y=0.6005*W,0.0085*H; w,h=W*(1-0.6005-0.0065),H*(1-0.0085-0.0039)
mvb,mbody=load('b0a40','m_'); gvb,gbody=load('74a48','g_')
parts.append(f'<svg x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(h)}" overflow="visible"><mask id="logo-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="{f(w)}" height="{f(h)}" style="mask-type:alpha"><svg x="0.658" y="0" width="101.896" height="137.641" viewBox="{mvb}" preserveAspectRatio="none" overflow="visible">{mbody}</svg></mask><g mask="url(#logo-mask)"><svg width="{f(w)}" height="{f(h)}" viewBox="{gvb}" preserveAspectRatio="none">{gbody}</svg></g></svg>')
svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" fill="none">\n'+'\n'.join(parts)+'\n</svg>\n'
open(out,'w',encoding='utf-8',newline='\n').write(svg)
print(len(items.split('\n')),'vectors +1 masked group;',len(svg),'bytes')
