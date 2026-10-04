"""Conservative checks. Passing is NOT a factual correctness guarantee."""
import re
import unicodedata
from .schemas import FactSheet, Generated


def normal(text):
    return ' '.join(unicodedata.normalize('NFKC', text).split())


def numbers(text):
    t=''.join(str(unicodedata.decimal(c)) if c.isdecimal() else c for c in text)
    # Commas in 1,00,000 are ignored. Units and attribution need semantic review.
    return set(x.replace(',','') for x in re.findall(r'(?<!\w)[+-]?\d+(?:,\d+)*(?:\.\d+)?%?',t))


def validate_facts(sheet:FactSheet, sources):
    errors=[]; ids=set(); source_map={s['id']:s for s in sources}
    for f in sheet.facts:
        if f.id in ids: errors.append(f'Duplicate fact ID: {f.id}')
        ids.add(f.id)
        quotes=[]
        for e in f.evidence:
            src=source_map.get(e.source_id)
            if not src or normal(e.quote) not in normal(src['text']):
                errors.append(f'{f.id}: evidence quote is not present in {e.source_id}.')
            quotes.append(e.quote)
        extra=numbers(f.statement)-numbers(' '.join(quotes))
        if extra: errors.append(f'{f.id}: numbers absent from evidence: {sorted(extra)}')
    return errors


def validate_output(out:Generated, sheet:FactSheet, kind):
    errors=[]; facts={f.id:f for f in sheet.facts}
    if kind != 'mermaid' and out.mermaid:
        errors.append('Unexpected diagram returned for a non-diagram request.')
    for i,b in enumerate(out.blocks,1):
        if any(fid not in facts for fid in b.fact_ids):
            errors.append(f'Block {i}: unknown fact reference.')
        allowed=' '.join(facts[fid].statement for fid in b.fact_ids if fid in facts)
        extra=numbers(b.text)-numbers(allowed)
        if extra: errors.append(f'Block {i}: numbers absent from cited facts: {sorted(extra)}')
    extra=numbers(out.title)-numbers(' '.join(f.statement for f in sheet.facts))
    if extra: errors.append(f'Title contains numbers absent from facts: {sorted(extra)}')
    if kind=='mermaid':
        if not out.mermaid.strip().startswith(('flowchart TD','graph TD')):
            errors.append('Diagram must be a top-down Mermaid flowchart.')
        if re.search(r'(?i)(click\s|<|>|%%\{|javascript:|https?://)',out.mermaid.replace('-->','').replace('-.->','')):
            errors.append('Diagram contains disallowed HTML, links or directives.')
    return errors
