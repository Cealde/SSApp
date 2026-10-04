from html import escape

FONTS=['Georgia','Arial','Verdana','Times New Roman','Trebuchet MS']
PALETTES={
 'ocean':{'background':'#f3f7fb','text':'#152c43','accent':'#145f91'},
 'forest':{'background':'#f5f8f3','text':'#203c2d','accent':'#326f43'},
 'plum':{'background':'#faf5fb','text':'#39253f','accent':'#793a8c'},
 'ink':{'background':'#fafafa','text':'#222222','accent':'#444444'}}


def markdown(out):
    return '# '+out['title']+'\n\n'+'\n\n'.join(b['text']+'\n\nSources: '+', '.join(b['fact_ids']) for b in out['blocks'])


def mermaid_webpage(mermaid_code, title="Diagram Preview"):
    return f'''<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{escape(title)}</title>
<script src="/js/mermaid.min.js"></script>
<script>
  document.addEventListener("DOMContentLoaded", function() {{
    try {{
      mermaid.initialize({{ startOnLoad: true, theme: "dark" }});
    }} catch (e) {{
      console.error(e);
    }}
  }});
</script>
<style>
  body {{ margin: 0; background: #110e08; color: #fbf7ee; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: system-ui, sans-serif; padding: 24px; box-sizing: border-box; }}
  h1 {{ font-size: 22px; margin-bottom: 20px; color: #e2a221; text-align: center; }}
  .mermaid {{ width: 100%; display: flex; justify-content: center; overflow: auto; }}
  .draft {{ position: absolute; top: 12px; left: 16px; font-size: 12px; color: #e2a221; opacity: 0.7; }}
</style>
</head><body>
<div class="draft">SatyaSetu • Generated Diagram • Review before publication</div>
<h1>{escape(title)}</h1>
<div class="mermaid">
{escape(mermaid_code)}
</div>
</body></html>'''


def webpage(out, settings):
    if settings.get('kind') == 'mermaid' or (out.get('mermaid') and not out.get('blocks')):
        return mermaid_webpage(out.get('mermaid', ''), out.get('title', 'Diagram'))
    p=PALETTES[settings['palette']]
    title=escape(out['title']); tf=settings['title_font']; bf=settings['body_font']
    layout=settings['layout']; width='760px' if layout=='article' else '1060px'
    blocks=''.join('<section><p>'+escape(b['text']).replace('\n','<br>')+'</p><small>Sources: '+
        escape(', '.join(b['fact_ids']))+'</small></section>' for b in out['blocks'])
    grid='display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:20px;' if layout=='briefing' else ''
    return f'''<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'">
<title>{title}</title><style>body{{margin:0;background:{p['background']};color:{p['text']};font:18px/1.7 "{bf}",sans-serif}}
main{{max-width:{width};margin:auto;padding:48px 24px}}h1{{font-family:"{tf}",serif;font-size:clamp(32px,6vw,56px);line-height:1.15}}
header{{border-bottom:4px solid {p['accent']};padding-bottom:24px}}article{{{grid}}}section{{padding:20px 0;border-bottom:1px solid #ccd2d7}}
small{{color:{p['accent']}}}.draft{{font:14px Arial;color:{p['accent']}}}</style></head><body><main>
<div class="draft">SatyaSetu • Generated draft • Review before publication</div><header><h1>{title}</h1></header>
<article>{blocks}</article></main></body></html>'''
